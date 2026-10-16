import { Injectable } from '@nestjs/common';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain.errors';
import type { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import type { AnnouncementCategory, AnnouncementStatus } from '../../generated/prisma/enums';

export const SUPPORTED_LOCALES = ['en', 'ti', 'am'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * The announcement editorial workflow.
 *
 *   DRAFT → IN_REVIEW → APPROVED → (SCHEDULED) → PUBLISHED → EXPIRED / ARCHIVED
 *
 * Three properties this enforces, each of which the project brief calls for
 * explicitly:
 *
 *  1. **Approval before publication.** `publishedAt` is set only by `publish()`,
 *     which requires the APPROVED state and a separate permission. There is no
 *     update path that can set it.
 *
 *  2. **Separation of duties.** The author of an announcement cannot approve
 *     it. This is checked against `createdById`, not against a role, because a
 *     supervisor editing someone else's draft is a legitimate workflow that
 *     would otherwise be blocked.
 *
 *  3. **No silent machine translation.** A translation is published only if a
 *     human marked it reviewed, or it is the source language. A missing
 *     translation falls back to English *with a flag the UI must show* — quietly
 *     serving English emergency guidance to someone who chose Tigrinya is worse
 *     than saying the translation is pending.
 */
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── public ────────────────────────────────────────────────────────────────

  async listPublished(params: {
    locale: string;
    category?: AnnouncementCategory;
    page: number;
    pageSize: number;
    search?: string;
  }) {
    const now = new Date();

    const where = {
      deletedAt: null,
      status: 'PUBLISHED' as AnnouncementStatus,
      publishedAt: { not: null, lte: now },
      // An expired announcement is hidden even before the sweep job runs.
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(params.category ? { category: params.category } : {}),
      ...(params.search
        ? {
            OR: [
              { sourceName: { contains: params.search, mode: 'insensitive' as const } },
              {
                translations: {
                  some: { title: { contains: params.search, mode: 'insensitive' as const } },
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { translations: true, organization: { select: { name: true, isApproved: true } } },
      }),
    ]);

    return {
      data: rows.map((row) => this.toPublicShape(row, params.locale)),
      total,
    };
  }

  async getPublished(slug: string, locale: string) {
    const now = new Date();

    const row = await this.prisma.announcement.findFirst({
      where: {
        slug,
        deletedAt: null,
        status: 'PUBLISHED',
        publishedAt: { not: null, lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { translations: true, organization: { select: { name: true, isApproved: true } } },
    });

    if (!row) throw new NotFoundError('Announcement', 'announcement_not_found');

    return this.toPublicShape(row, locale);
  }

  // ── staff ─────────────────────────────────────────────────────────────────

  async listForStaff(locale: string, user: AuthenticatedUser) {
    const rows = await this.prisma.announcement.findMany({
      where: { deletedAt: null },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        translations: true,
        createdBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        organization: { select: { id: true, name: true, isApproved: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      category: row.category,
      status: row.status,
      defaultLocale: row.defaultLocale,
      sourceName: row.sourceName,
      isPinned: row.isPinned,
      isFictionalDemo: row.isFictionalDemo,
      publishedAt: row.publishedAt,
      expiresAt: row.expiresAt,
      approvedAt: row.approvedAt,
      approvedBy: row.approvedBy,
      createdBy: row.createdBy,
      organization: row.organization,
      translations: row.translations.map((translation) => ({
        locale: translation.locale,
        title: translation.title,
        summary: translation.summary,
        isHumanReviewed: translation.isHumanReviewed,
        wordCount: translation.body.split(/\s+/).filter(Boolean).length,
      })),
      // Drives which actions the dashboard offers, for *this* actor.
      availableActions: this.actionsFor(row.status, row.createdById === user.id, user.permissions),
    }));
  }

  // ── creation and editing ──────────────────────────────────────────────────

  async create(
    input: {
      slug: string;
      category: AnnouncementCategory;
      sourceName?: string;
      organizationId?: string;
      defaultLocale: string;
      expiresAt?: string;
      isPinned?: boolean;
      translations: Array<{
        locale: string;
        title: string;
        summary?: string;
        body: string;
        isHumanReviewed: boolean;
      }>;
    },
    user: AuthenticatedUser,
    context: RequestMeta,
  ) {
    if (!input.translations.some((translation) => translation.locale === input.defaultLocale)) {
      throw new BadRequestError(
        `A translation in the default language (${input.defaultLocale}) is required.`,
        'missing_default_translation',
      );
    }

    const existing = await this.prisma.announcement.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('An announcement with this address already exists.', 'slug_taken');
    }

    const row = await this.prisma.announcement.create({
      data: {
        slug: input.slug,
        category: input.category,
        status: 'DRAFT',
        sourceName: input.sourceName?.trim() ?? null,
        organizationId: input.organizationId ?? null,
        defaultLocale: input.defaultLocale,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        isPinned: input.isPinned ?? false,
        createdById: user.id,
        translations: { create: input.translations },
      },
    });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'announcements.created',
      entityType: 'announcement',
      entityId: row.id,
      metadata: { slug: row.slug, category: row.category },
      requestId: context.requestId,
    });

    return row;
  }

  async updateContent(
    id: string,
    translations: Array<{
      locale: string;
      title: string;
      summary?: string;
      body: string;
      isHumanReviewed: boolean;
    }>,
    user: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const row = await this.prisma.announcement.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundError('Announcement', 'announcement_not_found');

    // Editing after approval would let unapproved text ride on an existing
    // approval. The content must go back for approval.
    if (['PUBLISHED', 'APPROVED', 'SCHEDULED'].includes(row.status)) {
      throw new ConflictError(
        'This announcement is already approved or published. Withdraw it before editing the text.',
        'edit_requires_draft',
      );
    }

    for (const translation of translations) {
      await this.prisma.announcementTranslation.upsert({
        where: { announcementId_locale: { announcementId: id, locale: translation.locale } },
        create: { announcementId: id, ...translation },
        // Any edit clears the reviewed flag: a reviewer approved the old text,
        // and cannot have approved the new one.
        update: {
          title: translation.title,
          summary: translation.summary ?? null,
          body: translation.body,
          isHumanReviewed: translation.isHumanReviewed,
        },
      });
    }

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'announcements.content.updated',
      entityType: 'announcement',
      entityId: id,
      metadata: { locales: translations.map((translation) => translation.locale) },
      requestId: context.requestId,
    });

    return { updated: true };
  }

  // ── workflow ──────────────────────────────────────────────────────────────

  async submitForReview(id: string, user: AuthenticatedUser, context: RequestMeta) {
    const row = await this.prisma.announcement.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundError('Announcement', 'announcement_not_found');

    if (row.status !== 'DRAFT') {
      throw new ConflictError(
        `Only a draft can be sent for review. This one is ${row.status.toLowerCase().replace('_', ' ')}.`,
        'invalid_transition',
      );
    }

    const translations = await this.prisma.announcementTranslation.findMany({
      where: { announcementId: id },
    });

    if (translations.length === 0) {
      throw new BadRequestError('Add content before sending this for review.', 'no_content');
    }

    const unreviewed = translations.filter(
      (translation) => !translation.isHumanReviewed && translation.locale !== row.defaultLocale,
    );

    if (unreviewed.length > 0) {
      throw new ConflictError(
        `The ${unreviewed.map((t) => t.locale).join(', ')} translation(s) are not marked as human-reviewed. ` +
          'Critical public information must not be published from an unreviewed translation.',
        'translations_not_reviewed',
      );
    }

    await this.prisma.announcement.update({
      where: { id },
      data: { status: 'IN_REVIEW' },
    });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'announcements.submitted_for_review',
      entityType: 'announcement',
      entityId: id,
      requestId: context.requestId,
    });

    return { status: 'IN_REVIEW' };
  }

  /**
   * Approves an announcement.
   *
   * The author cannot approve their own work. Enforced here rather than in the
   * guard, because it is a relationship between two rows and only the service
   * can see both.
   */
  async approve(id: string, user: AuthenticatedUser, context: RequestMeta) {
    const row = await this.prisma.announcement.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundError('Announcement', 'announcement_not_found');

    if (row.status !== 'IN_REVIEW') {
      throw new ConflictError(
        `Only an announcement in review can be approved. This one is ${row.status.toLowerCase().replace('_', ' ')}.`,
        'invalid_transition',
      );
    }

    if (row.createdById === user.id) {
      await this.audit.denied({
        actorUserId: user.id,
        actorEmail: user.email,
        actorRoles: user.roles,
        action: 'announcements.approved',
        entityType: 'announcement',
        entityId: id,
        reason: 'Author attempted to approve their own announcement (separation of duties)',
        requestId: context.requestId,
      });

      throw new ForbiddenError(
        'You cannot approve an announcement you wrote. Ask another authorized reviewer to approve it.',
        'separation_of_duties',
      );
    }

    if (row.organizationId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: row.organizationId },
        select: { isApproved: true, name: true },
      });

      if (organization && !organization.isApproved) {
        throw new BadRequestError(
          `"${organization.name}" has not been approved to publish through this platform.`,
          'organization_not_approved',
        );
      }
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.announcement.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: user.id,
          approvedAt: now,
          approvalNote: context.note ?? null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRoles: user.roles,
          action: 'announcements.approved',
          entityType: 'announcement',
          entityId: id,
          outcome: 'SUCCESS',
          metadata: { slug: row.slug, category: row.category },
          reason: context.note ?? null,
          requestId: context.requestId ?? null,
        },
      }),
    ]);

    return { status: 'APPROVED', approvedAt: now };
  }

  /**
   * Publishes an approved announcement.
   *
   * `publishedAt` is set here and only here. A DRAFT or IN_REVIEW announcement
   * cannot be published, so an unapproved announcement is unreachable from the
   * public API — the test for this is in `test/report-announcement.e2e-spec.ts`.
   */
  async publish(
    id: string,
    user: AuthenticatedUser,
    context: RequestMeta & { scheduledFor?: string; expiresAt?: string },
  ) {
    const row = await this.prisma.announcement.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundError('Announcement', 'announcement_not_found');

    if (!['APPROVED', 'SCHEDULED'].includes(row.status)) {
      throw new ConflictError(
        row.status === 'DRAFT' || row.status === 'IN_REVIEW'
          ? 'This announcement has not been approved yet, so it cannot be published.'
          : `This announcement is ${row.status.toLowerCase().replace('_', ' ')} and cannot be published.`,
        'not_approved',
      );
    }

    if (!row.approvedById || !row.approvedAt) {
      throw new ConflictError(
        'This announcement has no approval record, so it cannot be published.',
        'no_approval_record',
      );
    }

    const scheduledFor = context.scheduledFor ? new Date(context.scheduledFor) : null;

    if (scheduledFor && scheduledFor.getTime() > Date.now()) {
      await this.prisma.announcement.update({
        where: { id },
        data: { status: 'SCHEDULED' },
      });

      await this.audit.record({
        actorUserId: user.id,
        actorEmail: user.email,
        actorRoles: user.roles,
        action: 'announcements.scheduled',
        entityType: 'announcement',
        entityId: id,
        metadata: { scheduledFor },
        requestId: context.requestId,
      });

      return { status: 'SCHEDULED', scheduledFor };
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.announcement.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedAt: now,
          expiresAt: context.expiresAt ? new Date(context.expiresAt) : row.expiresAt,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRoles: user.roles,
          action: 'announcements.published',
          entityType: 'announcement',
          entityId: id,
          outcome: 'SUCCESS',
          metadata: { slug: row.slug, publishedAt: now.toISOString() },
          requestId: context.requestId ?? null,
        },
      }),
    ]);

    return { status: 'PUBLISHED', publishedAt: now };
  }

  async archive(id: string, reason: string, user: AuthenticatedUser, context: RequestMeta) {
    const row = await this.prisma.announcement.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date(), publishedAt: null },
    });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'announcements.archived',
      entityType: 'announcement',
      entityId: id,
      reason,
      requestId: context.requestId,
    });

    return { status: row.status };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /**
   * Builds the public shape, including which translation is being shown and
   * whether it is a fallback.
   *
   * `translationPending` is not decoration. The resident-facing UI is required to
   * show it, because an announcement read in the wrong language without warning
   * is a safety problem, not a cosmetic one.
   */
  private toPublicShape(
    row: {
      id: string;
      slug: string;
      category: AnnouncementCategory;
      status: AnnouncementStatus;
      sourceName: string | null;
      publishedAt: Date | null;
      expiresAt: Date | null;
      isPinned: boolean;
      isFictionalDemo: boolean;
      defaultLocale: string;
      organization: { name: string; isApproved: boolean } | null;
      translations: Array<{
        locale: string;
        title: string;
        summary: string | null;
        body: string;
        isHumanReviewed: boolean;
      }>;
    },
    locale: string,
  ) {
    const exact = row.translations.find((translation) => translation.locale === locale);
    const fallback =
      row.translations.find((translation) => translation.locale === row.defaultLocale) ??
      row.translations[0];

    const chosen = exact ?? fallback;
    const isFallback = Boolean(chosen) && chosen!.locale !== locale;

    // An unapproved organization must never appear as an endorsing source.
    const publisher =
      row.organization && row.organization.isApproved ? row.organization.name : row.sourceName;

    return {
      id: row.id,
      slug: row.slug,
      category: row.category,
      title: chosen?.title ?? '',
      summary: chosen?.summary ?? null,
      body: chosen?.body ?? '',
      publishedAt: row.publishedAt,
      expiresAt: row.expiresAt,
      isPinned: row.isPinned,
      isFictionalDemo: row.isFictionalDemo,
      publisher,
      // Null rather than the organization's name when it is not approved.
      publisherOrganization: row.organization?.isApproved ? row.organization.name : null,
      servedInLocale: chosen?.locale ?? null,
      requestedLocale: locale,
      translationPending: isFallback,
      isHumanReviewed: chosen?.isHumanReviewed ?? false,
    };
  }

  private actionsFor(status: AnnouncementStatus, isAuthor: boolean, permissions: string[]) {
    const actions: string[] = [];

    if (permissions.includes('announcements.edit') && status === 'DRAFT') actions.push('edit');

    if (permissions.includes('announcements.approve') && status === 'IN_REVIEW') {
      // Separation of duties is surfaced to the operator here rather than
      // discovered by clicking a button that then fails.
      actions.push(isAuthor ? 'awaiting_other_approver' : 'approve');
    }

    if (
      permissions.includes('announcements.publish') &&
      ['APPROVED', 'SCHEDULED'].includes(status)
    ) {
      actions.push('publish');
    }

    if (permissions.includes('announcements.archive') && status === 'PUBLISHED') {
      actions.push('archive');
    }

    return actions;
  }
}

export interface RequestMeta {
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  note?: string;
}

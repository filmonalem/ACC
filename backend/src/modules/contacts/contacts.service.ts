import { Injectable, Logger } from '@nestjs/common';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain.errors';
import type { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import type {
  ContactStatus,
  ContactVerificationOutcome,
  ServiceCategory,
  VerificationMethod,
} from '../../generated/prisma/enums';
import { localise } from '../../common/i18n/localise';

/**
 * Service contact management and the verification ledger.
 *
 * The single rule everything else serves: **a contact is public only while it is
 * verified and its verification has not expired.** Publishing, unpublishing and
 * expiry all funnel through this service so the rule cannot be satisfied by
 * forgetting a field.
 *
 * Nothing here invents or infers a phone number, and no listing may claim
 * real-time availability. `availabilityNotes` is free text a human wrote; the
 * interface labels it as information rather than a guarantee.
 */
@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── public directory ──────────────────────────────────────────────────────

  /**
   * Published contacts only.
   *
   * The `verificationExpiresAt > now` predicate is applied here as well as at
   * publish time, so an expiry that passes while the service is running takes
   * effect without waiting for a sweep job.
   */
  async listPublished(params: {
    locale: string;
    category?: ServiceCategory;
    search?: string;
    emergencyOnly?: boolean;
  }) {
    const now = new Date();

    const contacts = await this.prisma.serviceContact.findMany({
      where: {
        deletedAt: null,
        isPublished: true,
        status: 'VERIFIED',
        verificationExpiresAt: { gt: now },
        ...(params.category ? { category: params.category } : {}),
        ...(params.emergencyOnly ? { isEmergency: true } : {}),
        ...(params.search
          ? {
              OR: [
                { name: { contains: params.search, mode: 'insensitive' } },
                { coverageArea: { contains: params.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ isEmergency: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        verifications: {
          where: { outcome: 'CONFIRMED', revokedAt: null },
          orderBy: { verifiedAt: 'desc' },
          take: 1,
          select: { verifiedAt: true, expiresAt: true, method: true },
        },
      },
    });

    return contacts.map((contact) => ({
      id: contact.id,
      name: localise(contact.nameI18n, params.locale) ?? contact.name,
      description:
        localise(contact.descriptionI18n, params.locale) ?? contact.description ?? null,
      category: contact.category,
      isEmergency: contact.isEmergency,
      phoneNumber: contact.phoneNumber,
      phoneE164: contact.phoneE164,
      alternatePhone: contact.alternatePhone,
      coverageArea: contact.coverageArea,
      availabilityNotes: contact.availabilityNotes,
      alternativeInstructions: contact.alternativeInstructions,
      // Rendered as "Last verified on <date>", never as a currency of accuracy.
      lastVerifiedAt: contact.verifications[0]?.verifiedAt ?? contact.verifiedAt,
      verificationExpiresAt: contact.verificationExpiresAt,
      // Surfaced so the UI can badge seeded rows. Never suppressed.
      isFictionalDemo: contact.isFictionalDemo,
    }));
  }

  // ── staff listing ─────────────────────────────────────────────────────────

  async listForStaff(locale: string) {
    const contacts = await this.prisma.serviceContact.findMany({
      where: { deletedAt: null },
      orderBy: [{ status: 'asc' }, { isEmergency: 'desc' }, { sortOrder: 'asc' }],
      include: {
        organization: { select: { id: true, name: true, isApproved: true } },
        verifications: {
          orderBy: { verifiedAt: 'desc' },
          take: 5,
          include: { verifiedBy: { select: { id: true, fullName: true } } },
        },
      },
    });

    const now = new Date();

    return contacts.map((contact) => ({
      id: contact.id,
      name: localise(contact.nameI18n, locale) ?? contact.name,
      category: contact.category,
      status: contact.status,
      isEmergency: contact.isEmergency,
      isPublished: contact.isPublished,
      phoneNumber: contact.phoneNumber,
      coverageArea: contact.coverageArea,
      verifiedAt: contact.verifiedAt,
      verificationExpiresAt: contact.verificationExpiresAt,
      nextReviewDueAt: contact.nextReviewDueAt,
      // Computed, not stored: "this looks fine" and "this is expired" can never
      // disagree.
      isExpired: contact.verificationExpiresAt !== null && contact.verificationExpiresAt <= now,
      organization: contact.organization,
      isFictionalDemo: contact.isFictionalDemo,
      recentVerifications: contact.verifications.map((verification) => ({
        id: verification.id,
        outcome: verification.outcome,
        method: verification.method,
        verifiedAt: verification.verifiedAt,
        evidenceNote: verification.evidenceNote,
        expiresAt: verification.expiresAt,
        revokedAt: verification.revokedAt,
        verifiedBy: verification.verifiedBy,
      })),
    }));
  }

  // ── creation ──────────────────────────────────────────────────────────────

  async create(
    input: {
      name: string;
      description?: string;
      category: ServiceCategory;
      phoneNumber: string;
      alternatePhone?: string;
      coverageArea?: string;
      availabilityNotes?: string;
      alternativeInstructions?: string;
      isEmergency: boolean;
      organizationId?: string;
      verificationCycleDays?: number;
    },
    user: AuthenticatedUser,
    context: RequestMeta,
  ) {
    if (input.isEmergency && !user.permissions.includes('contacts.publish_emergency')) {
      throw new ForbiddenError(
        'You do not have permission to create contacts marked as emergency services.',
        'missing_permission',
      );
    }

    if (input.organizationId) {
      await this.assertOrganizationApproved(input.organizationId);
    }

    const contact = await this.prisma.serviceContact.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        category: input.category,
        phoneNumber: input.phoneNumber.trim(),
        phoneE164: this.normalisePhone(input.phoneNumber),
        alternatePhone: input.alternatePhone?.trim() ?? null,
        coverageArea: input.coverageArea?.trim() ?? null,
        availabilityNotes: input.availabilityNotes?.trim() ?? null,
        alternativeInstructions: input.alternativeInstructions?.trim() ?? null,
        isEmergency: input.isEmergency,
        organizationId: input.organizationId ?? null,
        verificationCycleDays: input.verificationCycleDays ?? 180,
        // Starts as DRAFT. Publication is a separate, permissioned act.
        status: 'DRAFT',
        isPublished: false,
      },
    });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'contacts.created',
      entityType: 'service_contact',
      entityId: contact.id,
      metadata: { category: contact.category, isEmergency: contact.isEmergency },
      requestId: context.requestId,
    });

    return contact;
  }

  // ── verification ──────────────────────────────────────────────────────────

  /**
   * Records a verification attempt.
   *
   * Failures are recorded too, in the same immutable ledger. A ledger that only
   * holds successes cannot answer "did anyone try to publish this number before
   * checking it?" — and that question is the whole point.
   */
  async recordVerification(
    contactId: string,
    input: {
      outcome: ContactVerificationOutcome;
      method: VerificationMethod;
      evidenceNote?: string;
      cycleDays?: number;
    },
    user: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const contact = await this.prisma.serviceContact.findFirst({
      where: { id: contactId, deletedAt: null },
    });

    if (!contact) throw new NotFoundError('Service contact', 'contact_not_found');

    const now = new Date();
    const cycleDays = input.cycleDays ?? contact.verificationCycleDays;

    const confirmed = input.outcome === 'CONFIRMED';
    const expiresAt = confirmed ? new Date(now.getTime() + cycleDays * 86_400_000) : null;

    const [, verification] = await this.prisma.$transaction([
      contact.status === 'SUSPENDED' || contact.status === 'EXPIRED'
        ? this.prisma.serviceContact.update({
            where: { id: contactId },
            data: {
              status: confirmed ? 'VERIFIED' : 'DRAFT',
              verifiedAt: confirmed ? now : null,
              verificationExpiresAt: expiresAt,
              nextReviewDueAt: expiresAt,
              // A failed re-verification must remove the contact from the public
              // directory immediately, not at the next sweep.
              isPublished: confirmed ? contact.isPublished : false,
            },
          })
        : confirmed
          ? this.prisma.serviceContact.update({
              where: { id: contactId },
              data: {
                status: 'VERIFIED',
                verifiedAt: now,
                verificationExpiresAt: expiresAt,
                nextReviewDueAt: expiresAt,
              },
            })
          : this.prisma.serviceContact.update({
              where: { id: contactId },
              data: { status: 'EXPIRED', isPublished: false },
            }),

      this.prisma.contactVerification.create({
        data: {
          contactId,
          outcome: input.outcome,
          method: input.method,
          verifiedById: user.id,
          verifiedAt: now,
          evidenceNote: input.evidenceNote?.trim() ?? null,
          expiresAt,
        },
      }),
    ]);

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'contacts.verification.recorded',
      entityType: 'service_contact',
      entityId: contactId,
      metadata: { outcome: input.outcome, method: input.method, expiresAt },
      requestId: context.requestId,
    });

    if (!confirmed) {
      this.logger.warn(
        `Verification attempt on contact ${contactId} returned ${input.outcome}; contact is no longer published`,
      );
    }

    return verification;
  }

  // ── publication ───────────────────────────────────────────────────────────

  /**
   * Publishes a contact, refusing anything that is not currently verified.
   *
   * The checks are evaluated here rather than at the controller so that every
   * future path to publication — a script, an admin panel, an import — is subject
   * to the same rules.
   */
  async publish(contactId: string, user: AuthenticatedUser, context: RequestMeta) {
    const contact = await this.prisma.serviceContact.findFirst({
      where: { id: contactId, deletedAt: null },
    });

    if (!contact) throw new NotFoundError('Service contact', 'contact_not_found');

    if (contact.isEmergency && !user.permissions.includes('contacts.publish_emergency')) {
      throw new ForbiddenError(
        'Publishing a contact marked as an emergency service requires a separate permission.',
        'missing_permission',
      );
    }

    if (contact.status !== 'VERIFIED') {
      throw new ConflictError(
        'This contact has not been verified, so it cannot be published. Record a successful verification first.',
        'contact_not_verified',
      );
    }

    if (!contact.verificationExpiresAt || contact.verificationExpiresAt <= new Date()) {
      throw new ConflictError(
        'This contact\'s verification has expired. Re-verify it before publishing.',
        'contact_verification_expired',
      );
    }

    if (contact.organizationId) {
      await this.assertOrganizationApproved(contact.organizationId);
    }

    if (contact.isFictionalDemo) {
      // Not an error — seeded demo data is published for demonstration — but it
      // is recorded, so a pilot review can see exactly which public numbers are
      // placeholders.
      this.logger.warn(
        `Publishing FICTIONAL DEMO contact ${contactId} ("${contact.name}") to the public directory`,
      );
    }

    await this.prisma.serviceContact.update({
      where: { id: contactId },
      data: { isPublished: true },
    });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'contacts.published',
      entityType: 'service_contact',
      entityId: contactId,
      metadata: {
        name: contact.name,
        isEmergency: contact.isEmergency,
        isFictionalDemo: contact.isFictionalDemo,
        verifiedAt: contact.verifiedAt,
      },
      requestId: context.requestId,
    });

    return { published: true };
  }

  async unpublish(contactId: string, reason: string, user: AuthenticatedUser, context: RequestMeta) {
    await this.prisma.serviceContact.updateMany({
      where: { id: contactId, deletedAt: null },
      data: { isPublished: false },
    });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'contacts.unpublished',
      entityType: 'service_contact',
      entityId: contactId,
      reason,
      requestId: context.requestId,
    });

    return { published: false };
  }

  async deactivate(contactId: string, reason: string, user: AuthenticatedUser, context: RequestMeta) {
    await this.prisma.serviceContact.update({
      where: { id: contactId },
      data: { status: 'SUSPENDED', isPublished: false },
    });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'contacts.deactivated',
      entityType: 'service_contact',
      entityId: contactId,
      reason,
      requestId: context.requestId,
    });

    return { active: false };
  }

  // ── expiry sweep ──────────────────────────────────────────────────────────

  /**
   * Unpublishes and marks every contact whose verification has lapsed.
   *
   * Returns what it changed so the operator sees the effect, rather than a
   * silent job that "probably ran".
   */
  async expireLapsedVerifications(): Promise<{ expired: number }> {
    const now = new Date();

    const { count } = await this.prisma.serviceContact.updateMany({
      where: {
        deletedAt: null,
        OR: [
          {
            verificationExpiresAt: { not: null, lte: now },
            status: { in: ['VERIFIED', 'DRAFT'] },
          },
          { isPublished: true, verificationExpiresAt: { lte: now } },
        ],
      },
      data: { status: 'EXPIRED', isPublished: false },
    });

    if (count > 0) {
      this.logger.warn(`${count} service contact(s) expired and were withdrawn from the public directory`);
    }

    return { expired: count };
  }

  /** Contacts approaching re-verification, for the staff dashboard. */
  async listDueForReview(daysAhead = 30) {
    const horizon = new Date(Date.now() + daysAhead * 86_400_000);

    return this.prisma.serviceContact.findMany({
      where: {
        deletedAt: null,
        status: { not: 'SUSPENDED' },
        OR: [
          { verificationExpiresAt: { lte: horizon } },
          { nextReviewDueAt: { lte: horizon } },
        ],
      },
      select: {
        id: true,
        name: true,
        status: true,
        isPublished: true,
        verificationExpiresAt: true,
        nextReviewDueAt: true,
      },
      orderBy: { verificationExpiresAt: 'asc' },
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async assertOrganizationApproved(organizationId: string): Promise<void> {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true, name: true, isApproved: true, isActive: true },
    });

    if (!organization) throw new NotFoundError('Organization', 'organization_not_found');

    if (!organization.isApproved || !organization.isActive) {
      throw new BadRequestError(
        `"${organization.name}" has not been approved to participate in the platform, so nothing can be published on its behalf. A governance administrator must approve it first.`,
        'organization_not_approved',
      );
    }
  }

  /**
   * Best-effort E.164 normalisation for tap-to-call.
   *
   * Accepts the shapes an Ethiopian number is actually written in. Returns null
   * rather than a guess when the input does not clearly parse — a wrong
   * `tel:` link that silently fails to dial is worse than no link.
   */
  private normalisePhone(input: string): string | null {
    const digits = input.replace(/[^\d+]/g, '');

    if (/^\+251\d{9}$/.test(digits)) return digits;
    if (/^09\d{8}$/.test(digits)) return `+251${digits.slice(1)}`;
    if (/^9\d{8}$/.test(digits)) return `+251${digits}`;
    if (/^0\d{9}$/.test(digits)) return `+251${digits.slice(1)}`;

    return null;
  }

  }

export interface RequestMeta {
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export type { ContactStatus };

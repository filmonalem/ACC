import { Injectable } from '@nestjs/common';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors/domain.errors';
import type { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import type {
  SupportServiceCategory,
  ServiceVerificationStatus,
} from '../../generated/prisma/enums';
import { localise } from '../../common/i18n/localise';

/**
 * Community support directory.
 *
 * Mirrors the contact-verification rule: only a currently `VERIFIED` service
 * whose verification has not expired appears publicly, and the organization
 * behind a listing must itself be approved. Eligibility text matters here more
 * than elsewhere — a resident deciding whether they qualify for support is
 * exactly the person harmed by a vague or wrong description, so eligibility is
 * a first-class translated field rather than a footnote.
 */
@Injectable()
export class SupportServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPublished(locale: string, category?: SupportServiceCategory, search?: string) {
    const now = new Date();

    const rows = await this.prisma.supportService.findMany({
      where: {
        deletedAt: null,
        isPublished: true,
        verificationStatus: 'VERIFIED',
        OR: [{ verificationExpiresAt: null }, { verificationExpiresAt: { gt: now } }],
        ...(category ? { category } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { serviceArea: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { organization: { select: { name: true, isApproved: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: localise(row.nameI18n, locale) ?? row.name,
      description: localise(row.descriptionI18n, locale) ?? row.description,
      category: row.category,
      serviceArea: row.serviceArea,
      eligibility: localise(row.eligibilityI18n, locale) ?? row.eligibility,
      contactName: row.contactName,
      phoneNumber: row.phoneNumber,
      phoneE164: row.phoneE164,
      email: row.email,
      websiteUrl: row.websiteUrl,
      hoursNotes: row.hoursNotes,
      verificationStatus: row.verificationStatus,
      verifiedAt: row.verifiedAt,
      isFictionalDemo: row.isFictionalDemo,
      // An unapproved organization is not shown as the provider of a service.
      organizationName: row.organization?.isApproved ? row.organization.name : null,
    }));
  }

  async listForStaff() {
    const now = new Date();

    const rows = await this.prisma.supportService.findMany({
      where: { deletedAt: null },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { organization: { select: { id: true, name: true, isApproved: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: row.category,
      serviceArea: row.serviceArea,
      phoneNumber: row.phoneNumber,
      email: row.email,
      verificationStatus: row.verificationStatus,
      isPublished: row.isPublished,
      verifiedAt: row.verifiedAt,
      verificationExpiresAt: row.verificationExpiresAt,
      isExpired: row.verificationExpiresAt !== null && row.verificationExpiresAt <= now,
      isFictionalDemo: row.isFictionalDemo,
      organization: row.organization,
    }));
  }

  async create(
    input: {
      slug: string;
      name: string;
      description: string;
      category: SupportServiceCategory;
      serviceArea?: string;
      eligibility?: string;
      contactName?: string;
      phoneNumber?: string;
      email?: string;
      websiteUrl?: string;
      hoursNotes?: string;
      organizationId?: string;
    },
    user: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const existing = await this.prisma.supportService.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('A support service with this address already exists.', 'slug_taken');
    }

    if (input.organizationId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { isApproved: true, name: true },
      });
      if (!organization) throw new NotFoundError('Organization', 'organization_not_found');
    }

    const row = await this.prisma.supportService.create({
      data: {
        slug: input.slug,
        name: input.name.trim(),
        description: input.description.trim(),
        category: input.category,
        serviceArea: input.serviceArea?.trim() ?? null,
        eligibility: input.eligibility?.trim() ?? null,
        contactName: input.contactName?.trim() ?? null,
        phoneNumber: input.phoneNumber?.trim() ?? null,
        email: input.email?.toLowerCase() ?? null,
        websiteUrl: input.websiteUrl ?? null,
        hoursNotes: input.hoursNotes?.trim() ?? null,
        organizationId: input.organizationId ?? null,
        // Starts PENDING. A listing is not public until someone verified it.
        verificationStatus: 'PENDING',
        isPublished: false,
      },
    });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'support_services.created',
      entityType: 'support_service',
      entityId: row.id,
      metadata: { slug: row.slug, category: row.category },
      requestId: context.requestId,
    });

    return row;
  }

  async verify(
    id: string,
    input: { expiresAt?: string; status: ServiceVerificationStatus; note?: string },
    user: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const row = await this.prisma.supportService.update({
      where: { id },
      data: {
        verificationStatus: input.status,
        verifiedAt: input.status === 'VERIFIED' ? new Date() : null,
        verificationExpiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        // Withdrawing verification withdraws publication in the same step.
        isPublished: input.status === 'VERIFIED' ? undefined : false,
      },
    });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'support_services.verification.changed',
      entityType: 'support_service',
      entityId: id,
      metadata: { from: 'previous', to: input.status },
      reason: input.note,
      requestId: context.requestId,
    });

    return row;
  }

  async publish(
    id: string,
    user: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const row = await this.prisma.supportService.findFirst({
      where: { id, deletedAt: null },
      include: { organization: { select: { isApproved: true, name: true } } },
    });

    if (!row) throw new NotFoundError('Support service', 'service_not_found');

    if (row.verificationStatus !== 'VERIFIED') {
      throw new ConflictError(
        'This listing has not been verified, so it cannot be published.',
        'service_not_verified',
      );
    }

    if (row.verificationExpiresAt && row.verificationExpiresAt <= new Date()) {
      throw new ConflictError(
        'This listing\'s verification has expired. Re-verify it before publishing.',
        'service_verification_expired',
      );
    }

    if (row.organization && !row.organization.isApproved) {
      throw new BadRequestError(
        `"${row.organization.name}" has not been approved to appear as a service provider.`,
        'organization_not_approved',
      );
    }

    await this.prisma.supportService.update({ where: { id }, data: { isPublished: true } });

    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'support_services.published',
      entityType: 'support_service',
      entityId: id,
      metadata: { slug: row.slug, isFictionalDemo: row.isFictionalDemo },
      requestId: context.requestId,
    });

    return { published: true };
  }

  }

export interface RequestMeta {
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

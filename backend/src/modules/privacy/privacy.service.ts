import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/domain.errors';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import type { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PageMetaDto, PaginationQueryDto } from '../../common/dto/pagination.dto';
import type {
  PrivacyRequestStatus,
  PrivacyRequestType,
} from '../../generated/prisma/enums';

/** Default response window, per the 30-day norm in Proclamation 1321/2024. */
const DEFAULT_DUE_DAYS = 30;

/**
 * Personal data access, correction and deletion requests.
 *
 * Built against the process described in Ethiopia's Personal Data Protection
 * Proclamation No. 1321/2024, subject to qualified local legal review — see
 * docs/03-milestones.md (M12) for the assumptions made and what still needs
 * a lawyer rather than an engineer.
 *
 * Identity verification is modelled explicitly. A deletion request from someone
 * who has merely guessed a reference code must not be able to erase a stranger's
 * report, so no request can reach FULFILLED without a recorded verification.
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async submit(input: {
    requestType: PrivacyRequestType;
    requesterName?: string;
    requesterEmail?: string;
    requesterPhone?: string;
    details: string;
    reportReferenceCode?: string;
  }): Promise<{ reference: string }> {
    const dueAt = new Date(Date.now() + DEFAULT_DUE_DAYS * 86_400_000);

    const row = await this.prisma.privacyRequest.create({
      data: {
        requestType: input.requestType,
        requesterName: input.requesterName?.trim() ?? null,
        requesterEmail: input.requesterEmail?.toLowerCase() ?? null,
        requesterPhone: input.requesterPhone?.trim() ?? null,
        details: input.details.trim(),
        reportReferenceCode: input.reportReferenceCode?.trim().toUpperCase() ?? null,
        dueAt,
      },
      select: { id: true, requestType: true },
    });

    await this.audit.record({
      action: 'privacy_request.received',
      entityType: 'privacy_request',
      entityId: row.id,
      metadata: {
        requestType: input.requestType,
        hasReportReference: Boolean(input.reportReferenceCode),
      },
    });

    // The id is the only handle a resident gets. No status page is exposed in
    // v0.1, because verifying who is asking is a human process.
    return { reference: row.id };
  }

  async list(query: PaginationQueryDto & { status?: PrivacyRequestStatus }) {
    const where = query.status ? { status: query.status } : {};

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.privacyRequest.count({ where }),
      this.prisma.privacyRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          handledBy: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        requestType: row.requestType,
        status: row.status,
        reportReferenceCode: row.reportReferenceCode,
        // Contact details are shown to staff who need to respond, and to nobody
        // else — this endpoint is permission-gated.
        requesterEmail: row.requesterEmail,
        requesterName: row.requesterName,
        details: row.details,
        identityVerifiedAt: row.identityVerifiedAt,
        verificationMethod: row.verificationMethod,
        dueAt: row.dueAt,
        completedAt: row.completedAt,
        // Overdue is computed, so it cannot go stale between refreshes.
        isOverdue: row.status !== 'FULFILLED' && row.dueAt < new Date(),
        handledBy: row.handledBy,
        createdAt: row.createdAt,
      })),
      meta: PageMetaDto.build(query.page, query.pageSize, total),
    };
  }

  /**
   * Records an identity verification decision.
   *
   * Separate from the status change because verification is the part that needs
   * evidence, and a status field alone would let someone mark a request handled
   * without ever having checked who they were dealing with.
   */
  async verifyIdentity(
    id: string,
    verified: boolean,
    method: string,
    actor: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const row = await this.prisma.privacyRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Privacy request', 'privacy_request_not_found');

    await this.prisma.privacyRequest.update({
      where: { id },
      data: {
        identityVerifiedAt: verified ? new Date() : null,
        verificationMethod: verified ? method : null,
        status: verified ? 'IN_PROGRESS' : row.status,
      },
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRoles: actor.roles,
      action: verified ? 'privacy_request.identity.verified' : 'privacy_request.identity.rejected',
      entityType: 'privacy_request',
      entityId: id,
      reason: method,
      requestId: context.requestId,
    });

    return { identityVerified: verified };
  }

  /**
   * Places or releases a legal hold.
   *
   * A RESTRICTION request pins the related report so the retention job cannot
   * purge it while the objection is being considered. Releasing it lets the
   * normal schedule resume.
   */
  async setRestriction(
    id: string,
    restrict: boolean,
    reason: string,
    actor: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const request = await this.prisma.privacyRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundError('Privacy request', 'privacy_request_not_found');

    if (!request.reportReferenceCode) {
      throw new NotFoundError('Report for this request', 'request_has_no_report');
    }

    const report = await this.prisma.report.findUnique({
      where: { referenceCode: request.reportReferenceCode },
      select: { id: true },
    });

    if (!report) throw new NotFoundError('Report', 'report_not_found');

    await this.prisma.$transaction(async (tx) => {
      if (restrict) {
        await tx.legalHold.create({
          data: { reportId: report.id, privacyRequestId: id, reason, placedById: actor.id },
        });
      } else {
        await tx.legalHold.updateMany({
          where: { reportId: report.id, releasedAt: null },
          data: { releasedAt: new Date() },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorEmail: actor.email,
          actorRoles: actor.roles,
          action: restrict ? 'privacy_request.restriction.placed' : 'privacy_request.restriction.released',
          entityType: 'report',
          entityId: report.id,
          outcome: 'SUCCESS',
          reason,
          requestId: context.requestId ?? null,
        },
      });
    });

    return { restricted: restrict };
  }

  async complete(
    id: string,
    status: 'FULFILLED' | 'REJECTED',
    resolutionNote: string,
    actor: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const row = await this.prisma.privacyRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Privacy request', 'privacy_request_not_found');

    // Fulfilment requires verified identity. Without this check anyone who can
    // reach the endpoint could mark a stranger's deletion request complete and
    // close the ticket.
    if (status === 'FULFILLED' && !row.identityVerifiedAt) {
      throw new NotFoundError(
        'Verified identity for this privacy request',
        'identity_not_verified',
      );
    }

    await this.prisma.privacyRequest.update({
      where: { id },
      data: {
        status,
        resolutionNote,
        handledById: actor.id,
        completedAt: new Date(),
      },
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      actorRoles: actor.roles,
      action: `privacy_request.${status.toLowerCase()}`,
      entityType: 'privacy_request',
      entityId: id,
      reason: resolutionNote,
      requestId: context.requestId,
    });

    return { status };
  }
}

export interface RequestMeta {
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

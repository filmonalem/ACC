import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain.errors';
import {
  assertAssignmentAllowed,
  assertEscalationAllowed,
  assertTransitionAllowed,
  assertUrgencyChangeAllowed,
  assertVerificationChangeAllowed,
  availableTransitions,
  TERMINAL_STATUSES,
} from '../../common/authorization/report-lifecycle';
import {
  assertCanReadReport,
  buildReportScope,
  canViewPreciseLocation,
  canViewReporterIdentity,
} from '../../common/authorization/policy';
import type { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../database/prisma.service';
import { publicStatusMessage } from '../../common/i18n/status-messages';
import {
  DEFAULT_LOCALE,
  hasTranslation,
  localise,
  toSupportedLocale,
} from '../../common/i18n/localise';
import { CryptoService } from '../../common/services/crypto.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationService } from '../notifications/notification.service';
import type {
  LinkDuplicateDto,
  SubmitReportDto,
  TriageReportDto,
  UpdateReportStatusDto,
} from './dto/report.dto';
import type {
  Prisma,
  Report,
  ReportStatus,
  Urgency,
  VerificationStatus,
  EscalationState,
} from '../../generated/prisma/client';
import type { PermissionCode } from '../../common/permissions';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Env } from '../../config/env.schema';

/**
 * Attempts at generating a collision-free reference code before giving up.
 *
 * The collision probability with 8 characters from a 31-symbol alphabet is
 * roughly 1 in 800 million per attempt, so this loop realistically runs once.
 * It exists because "1 in 800 million" is still a number, and a report that
 * fails to submit for want of a code is a real harm to a real resident.
 */
const MAX_REFERENCE_ATTEMPTS = 5;

export interface SubmissionResult {
  referenceCode: string;
  statusToken: string;
  submittedAt: Date;
  status: ReportStatus;
  /** True when an idempotent replay returned the original report. */
  replayed: boolean;
}

export interface StatusLookupResult {
  referenceCode: string;
  status: ReportStatus;
  urgency: Urgency;
  submittedAt: Date;
  firstReviewedAt: Date | null;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  categoryKey: string;

  /** The category name, already resolved to `locale`. */
  categoryLabel: string | null;

  /** The language actually served, so the interface never has to guess. */
  locale: string;

  /**
   * True when the requested language had no reviewed translation and English was
   * served instead. The interface surfaces this: silently substituting a language
   * the reader did not ask for leaves them unable to tell that they are not
   * understanding what they are reading.
   */
  categoryTranslationPending: boolean;

  /**
   * A plain-language statement of what is happening. Deliberately free of
   * internal notes, assignee names, urgency rationale and verification
   * reasoning — a resident gets the state of their own report and nothing about
   * how staff are thinking about it.
   *
   * This is one of the few strings on the site a resident may act on emotionally
   * (it tells them whether their report was received), so it is translated rather
   * than left in English. See `common/i18n/status-messages.ts`.
   */
  publicMessage: string;

  /** The language `publicMessage` was written in. */
  messageLocale: string;

  /** True when `publicMessage` fell back to English. */
  translationPending: boolean;
}

export interface AdminReportQuery {
  page: number;
  pageSize: number;
  search?: string;
  categoryKey?: string;
  status?: ReportStatus;
  urgency?: Urgency;
  verificationStatus?: VerificationStatus;
  escalationState?: EscalationState;
  assignedToMe?: boolean;
  unassigned?: boolean;
  organizationId?: string;
  submittedFrom?: Date;
  submittedTo?: Date;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    @Inject('ACC_ENV') private readonly env: Env,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // Public submission
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Accepts a report from a resident.
   *
   * Anonymous submissions are refused unless `ALLOW_ANONYMOUS_REPORTS` is on,
   * which it is not by default. The reason is not technical caution — it is
   * that the platform cannot honour the promise: access logs, request metadata
   * and attachment EXIF can all identify a submitter, and telling a frightened
   * resident their report is anonymous when it is not would be the worst thing
   * this system could do.
   */
  async submit(
    dto: SubmitReportDto,
    context: RequestMeta,
    idempotencyKey?: string,
  ): Promise<SubmissionResult> {
    const isAnonymous = dto.isAnonymous === true;

    if (isAnonymous && !this.env.ALLOW_ANONYMOUS_REPORTS) {
      throw new ForbiddenError(
        'Anonymous reporting is not currently available. Submitting without contact ' +
          'details would not actually make the report anonymous, so we do not offer it.',
        'anonymous_reporting_disabled',
      );
    }

    // Replay protection: a retry after a dropped connection must return the
    // original report, never create a second one.
    if (idempotencyKey) {
      const existing = await this.prisma.report.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        this.logger.log(
          `Idempotent replay for a previously accepted submission (ref=${existing.referenceCode})`,
        );
        // The token cannot be re-derived — only its hash was stored — so the
        // caller is told to use their saved token rather than given a new one.
        return {
          referenceCode: existing.referenceCode,
          statusToken: '',
          submittedAt: existing.submittedAt,
          status: existing.status,
          replayed: true,
        };
      }
    }

    const category = await this.prisma.reportCategory.findFirst({
      where: { key: dto.categoryKey, isActive: true, deletedAt: null },
    });

    if (!category) {
      throw new BadRequestError(
        'That report category is not available. Please choose one of the listed options.',
        'unknown_category',
      );
    }

    this.assertLocationPolicy(dto);
    this.assertContactConsistency(dto, isAnonymous);

    const statusToken = this.crypto.statusToken();
    const referenceCode = await this.generateUniqueReferenceCode();

    const report = await this.prisma.report.create({
      data: {
        referenceCode,
        statusTokenHash: this.crypto.sha256(statusToken),
        categoryId: category.id,
        description: dto.description.trim(),
        language: dto.language,
        urgency: category.requiresUrgentReview ? 'HIGH' : 'NORMAL',
        incidentOccurredAt: dto.incidentOccurredAt ? new Date(dto.incidentOccurredAt) : null,
        incidentTimePrecision: dto.incidentTimePrecision ?? 'UNKNOWN',
        isAnonymous,
        reporterConsentGiven: dto.reporterConsentGiven,
        idempotencyKey: idempotencyKey ?? null,

        // Identity and location go to their own tables, never into Report.
        // A reader of the report queue cannot see a resident's name or number
        // without a separate, audited permission.
        reporterIdentity: {
          create: {
            isAnonymous,
            fullName: isAnonymous ? null : dto.reporterName?.trim() || null,
            phone: isAnonymous ? null : dto.reporterPhone ?? null,
            email: isAnonymous ? null : dto.reporterEmail?.toLowerCase() ?? null,
            preferredContactMethod: isAnonymous
              ? 'NONE'
              : (dto.preferredContactMethod ?? 'NONE'),
            languagePreference: dto.language,
          },
        },

        location: dto.locationPrecision
          ? {
              create: {
                precision: dto.locationPrecision,
                subCityName: dto.subCityName?.trim() || null,
                woredaName: dto.woredaName?.trim() || null,
                kebeleName: dto.kebeleName?.trim() || null,
                landmarkDescription: dto.landmarkDescription?.trim() || null,
                latitude: dto.latitude ?? null,
                longitude: dto.longitude ?? null,
              },
            }
          : undefined,

        consents: {
          create: [
            {
              consentType: 'PERSONAL_DATA_PROCESSING',
              granted: dto.reporterConsentGiven,
              policyVersion: this.env.PRIVACY_POLICY_VERSION,
              ipHash: context.ipAddress
                ? this.crypto.hashWithPepper(context.ipAddress)
                : null,
            },
            {
              // Contact attempts are a separate decision from processing: a
              // resident may be happy for us to act on a report without wanting
              // to be called back.
              consentType: 'CONTACT_ATTEMPTS',
              granted: !isAnonymous && dto.preferredContactMethod !== 'NONE',
              policyVersion: this.env.PRIVACY_POLICY_VERSION,
              ipHash: context.ipAddress
                ? this.crypto.hashWithPepper(context.ipAddress)
                : null,
            },
          ],
        },
      },
      include: { category: true },
    });

    await this.audit.record({
      action: 'reports.submitted',
      entityType: 'report',
      entityId: report.id,
      metadata: {
        referenceCode: report.referenceCode,
        categoryKey: category.key,
        language: report.language,
        isAnonymous,
        hasContactDetails: Boolean(dto.reporterPhone || dto.reporterEmail),
      },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      // Deliberately no userAgent and no description: this is an unauthenticated
      // resident record, and the audit row is the most widely-read table here.
    });

    // Queued to the outbox, not sent. In the pilot no SMS or email provider is
    // configured, so this stays QUEUED and the UI says so.
    await this.notifications.queueReportReceived(report.id, report.referenceCode, report.language);

    return {
      referenceCode: report.referenceCode,
      statusToken,
      submittedAt: report.submittedAt,
      status: report.status,
      replayed: false,
    };
  }

  /**
   * Resident status lookup.
   *
   * Requires both the reference code and the status token. The code alone is
   * deliberately insufficient: reference codes are short enough to be read
   * aloud, and without the token a neighbour or a shoulder-surfer could walk
   * the code space and read other people's reports.
   *
   * On a wrong token the response is identical to a wrong code, and the lookup
   * rate limit keeps enumeration impractical even so.
   */
  async lookupStatus(
    referenceCode: string,
    statusToken: string,
    locale?: string,
  ): Promise<StatusLookupResult> {
    const normalised = referenceCode.trim().toUpperCase();

    const report = await this.prisma.report.findFirst({
      where: { referenceCode: normalised, deletedAt: null },
      include: { category: true },
    });

    const resolvedLocale = toSupportedLocale(locale) ?? DEFAULT_LOCALE;

    const suppliedHash = this.crypto.sha256(statusToken);

    if (!report || !this.crypto.timingSafeEqual(report.statusTokenHash, suppliedHash)) {
      // One message for both cases: "no such report" and "wrong token" must be
      // indistinguishable.
      throw new NotFoundError('Report', 'report_not_found');
    }

    // Computed after the check, so it cannot run against a null report — and,
    // more importantly, so no work is done for a request that is about to be
    // rejected.
    const { message: publicMessage, ...statusMessage } = this.publicStatusMessage(
      report,
      resolvedLocale,
    );

    return {
      referenceCode: report.referenceCode,
      status: report.status,
      urgency: report.urgency,
      submittedAt: report.submittedAt,
      firstReviewedAt: report.firstReviewedAt,
      updatedAt: report.updatedAt,
      resolvedAt: report.resolvedAt,
      closedAt: report.closedAt,
      categoryKey: report.category.key,
      // Resolved to one language rather than returned as a map: the interface
      // should not have to know the fallback rule, and shipping a map invites
      // it to silently pick the wrong key.
      categoryLabel: localise(report.category.labelI18n, resolvedLocale),
      locale: resolvedLocale,
      // Lets the interface say *why* it is showing a language the reader may not
      // have asked for, instead of substituting silently.
      categoryTranslationPending: !hasTranslation(
        report.category.labelI18n,
        resolvedLocale,
      ),
      publicMessage,
      // Renamed from the helper's `locale` so it cannot be mistaken for the
      // language of the whole response.
      messageLocale: statusMessage.locale,
      translationPending: statusMessage.translationPending,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Staff listing and detail
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Run `assertCanReadReport`, recording a refusal first.
   *
   * `AuditService` documents DENIED rows as being as important as SUCCESS ones:
   * a run of refusals against one account is the clearest signal that something
   * is wrong, and a trail containing only successes cannot show it. Without this
   * wrapper, every read refusal returned a 403 and left no trace at all.
   *
   * The permission check is then repeated and re-thrown unchanged — auditing must
   * not alter the response, and the message already reveals nothing about whether
   * the report exists.
   */
  private async assertReadable(
    report: { id: string; referenceCode: string },
    user: AuthenticatedUser,
    isAssignedToUser: boolean,
    requestId?: string | null,
  ): Promise<void> {
    try {
      assertCanReadReport(user.permissions, isAssignedToUser);
    } catch {
      await this.audit.denied({
        actorUserId: user.id,
        actorEmail: user.email,
        actorRoles: user.roles,
        organizationId: user.organizationIds[0] ?? null,
        action: 'reports.read',
        entityType: 'report',
        entityId: report.id,
        reason: 'Actor is neither the assignee nor authorized to view all reports',
        metadata: { referenceCode: report.referenceCode },
        requestId,
      });
      assertCanReadReport(user.permissions, isAssignedToUser);
    }
  }

  async listForStaff(query: AdminReportQuery, user: AuthenticatedUser) {
    const scope = buildReportScope(
      user.id,
      user.permissions,
      user.organizationIds,
      query.organizationId,
    );

    if (scope.mode === 'none') {
      throw new ForbiddenError(
        'You do not have permission to view reports.',
        'no_report_access',
      );
    }

    const where = this.buildAdminWhere(query, scope);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: {
          category: true,
          assignments: {
            where: { active: true },
            include: { assignee: { select: { id: true, fullName: true, email: true } } },
          },
        },
        orderBy: this.buildOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      // Note what is absent: `reporterIdentity`. The list endpoint never selects
      // it, so there is no way to expose a resident's details here by accident.
      data: rows.map((row) => this.toAdminSummary(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getForStaff(idOrReference: string, user: AuthenticatedUser, requestId?: string | null) {
    const report = await this.findReport(idOrReference);

    const assignment = await this.prisma.reportAssignment.findFirst({
      where: { reportId: report.id, active: true },
    });

    await this.assertReadable(report, user, assignment?.assigneeId === user.id, requestId);

    // Permission decides *whether* these are selected at all; the precision
    // check itself happens in the mapper, once the full row is loaded.
    const includeIdentity = canViewReporterIdentity(user.permissions);
    const includePrecise = canViewPreciseLocation(user.permissions);

    if (includeIdentity) {
      // Reading a resident's identity is logged on its own terms, separately
      // from opening the report, so the trail shows exactly when it happened.
      await this.audit.record({
        actorUserId: user.id,
        actorEmail: user.email,
        actorRoles: user.roles,
        organizationId: user.organizationIds[0] ?? null,
        action: 'reports.identity.viewed',
        entityType: 'report',
        entityId: report.id,
        metadata: { referenceCode: report.referenceCode },
        requestId,
      });
    }

    const fresh = await this.prisma.report.findUniqueOrThrow({
      where: { id: report.id },
      include: {
        category: true,
        location: true,
        reporterIdentity: includeIdentity,
        assignments: {
          include: {
            assignee: { select: { id: true, fullName: true, email: true } },
            assignedBy: { select: { id: true, fullName: true } },
          },
          orderBy: { assignedAt: 'desc' },
        },
        statusHistory: {
          include: { changedBy: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        notes: {
          where: { deletedAt: null },
          include: { author: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          // objectKey is deliberately not selected into the API response; the
          // download endpoint re-checks permission per file.
          select: {
            id: true,
            originalName: true,
            contentType: true,
            byteSize: true,
            scanStatus: true,
            createdAt: true,
          },
        },
      },
    });

    return this.toAdminDetail(fresh, {
      includeIdentity,
      includePreciseLocation: includePrecise,
      permissions: user.permissions,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle mutations
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Moves a report to a new status.
   *
   * The report update, the history row and the audit row are written in one
   * transaction. A committed status change with no history entry would be
   * indistinguishable from a bug, and an audit row for a change that rolled
   * back would be worse — so they are not separable.
   */
  async updateStatus(
    idOrReference: string,
    dto: UpdateReportStatusDto,
    user: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const report = await this.findReport(idOrReference);

    if (TERMINAL_STATUSES.has(report.status)) {
      throw new ConflictError(
        `This report is ${report.status.toLowerCase().replace('_', ' ')} and its status can no longer be changed.`,
        'report_terminal',
      );
    }

    const to = dto.status as ReportStatus;

    assertTransitionAllowed(report.status, to, {
      permissions: user.permissions,
      reason: dto.reason,
    });

    // Resolution is a distinct act with a distinct permission, checked here as
    // well as through the transition edge, so a future edge to RESOLVED cannot
    // accidentally bypass `reports.resolve`.
    if (to === 'RESOLVED') {
      if (!user.permissions.includes('reports.resolve')) {
        throw new ForbiddenError(
          'You do not have permission to resolve reports.',
          'missing_permission',
        );
      }
      if (!dto.resolutionNote?.trim()) {
        throw new BadRequestError(
          'Describe what was done before marking this report resolved.',
          'resolution_note_required',
        );
      }
    }

    const now = new Date();
    const isFirstReview =
      report.firstReviewedAt === null &&
      ['UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'REJECTED', 'DUPLICATE'].includes(to);

    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: report.id },
        data: {
          status: to,
          firstReviewedAt: isFirstReview ? now : report.firstReviewedAt,
          ...(to === 'RESOLVED' ? { resolvedAt: now, resolutionNote: dto.resolutionNote?.trim() } : {}),
          ...(to === 'CLOSED' ? { closedAt: now } : {}),
          ...(to === 'REJECTED' ? { rejectionReason: dto.reason?.trim() } : {}),
        },
      });

      await tx.reportStatusHistory.create({
        data: {
          reportId: report.id,
          fromStatus: report.status,
          toStatus: to,
          changedById: user.id,
          changedByName: user.fullName,
          reason: dto.reason?.trim() ?? null,
          requestId: context.requestId ?? null,
        },
      });

      await this.audit.recordInTransaction(tx, {
        actorUserId: user.id,
        actorEmail: user.email,
        actorRoles: user.roles,
        action: 'reports.status.changed',
        entityType: 'report',
        entityId: report.id,
        metadata: { from: report.status, to, referenceCode: report.referenceCode },
        reason: dto.reason?.trim(),
        requestId: context.requestId ?? null,
        ipAddress: context.ipAddress ?? null,
      });
    });

    if (isFirstReview) {
      this.logger.log(`First review of ${report.referenceCode} recorded`);
    }

    if (to === 'ASSIGNED') {
      // Auto-assignment is not implied by the status: the assignee must be set
      // explicitly via /assign. This only warns the operator.
      this.logger.debug(
        `Report ${report.referenceCode} marked ASSIGNED — confirm an assignee exists`,
      );
    }

    return this.getForStaff(report.id, user, context.requestId);
  }

  /** Assigns or reassigns a report. */
  async assign(
    idOrReference: string,
    dto: { assigneeId: string; organizationId?: string; note?: string },
    user: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const report = await this.findReport(idOrReference);

    const current = await this.prisma.reportAssignment.findFirst({
      where: { reportId: report.id, active: true },
    });

    assertAssignmentAllowed(user.permissions, current?.assigneeId === user.id);

    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assigneeId, deletedAt: null, status: 'ACTIVE' },
      include: {
        roles: { include: { role: { include: { permissions: true } } } },
      },
    });

    if (!assignee) {
      throw new NotFoundError('Staff member', 'assignee_not_found');
    }

    // An assignee must actually be able to act on reports. Without this check a
    // report can be parked with someone who can never open it.
    const assigneePermissions = new Set(
      assignee.roles.flatMap((grant) =>
        grant.role.permissions.map((permission) => permission.permissionCode),
      ),
    );

    if (!assigneePermissions.has('reports.view_assigned')) {
      throw new BadRequestError(
        'That staff member cannot be assigned reports: their role does not include report access.',
        'assignee_lacks_report_access',
      );
    }

    if (TERMINAL_STATUSES.has(report.status)) {
      throw new ConflictError(
        'This report is closed and cannot be reassigned.',
        'report_terminal',
      );
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (current) {
        await tx.reportAssignment.update({
          where: { id: current.id },
          data: { active: false, unassignedAt: now, unassignedById: user.id },
        });
      }

      await tx.reportAssignment.create({
        data: {
          reportId: report.id,
          assigneeId: assignee.id,
          organizationId: dto.organizationId ?? null,
          assignedById: user.id,
          note: dto.note?.trim() ?? null,
        },
      });

      // Assigning a SUBMITTED report moves it to ASSIGNED, because otherwise the
      // queue would show it as untouched while it already has an owner.
      if (report.status === 'SUBMITTED' || report.status === 'VERIFIED') {
        await tx.report.update({
          where: { id: report.id },
          data: { status: 'ASSIGNED', firstReviewedAt: report.firstReviewedAt ?? now },
        });

        await tx.reportStatusHistory.create({
          data: {
            reportId: report.id,
            fromStatus: report.status,
            toStatus: 'ASSIGNED',
            changedById: user.id,
            changedByName: user.fullName,
            reason: `Assigned to ${assignee.fullName}`,
            requestId: context.requestId ?? null,
          },
        });
      }

      await this.audit.recordInTransaction(tx, {
        actorUserId: user.id,
        actorEmail: user.email,
        actorRoles: user.roles,
        organizationId: dto.organizationId ?? null,
        action: 'reports.assigned',
        entityType: 'report',
        entityId: report.id,
        metadata: {
          referenceCode: report.referenceCode,
          previousAssigneeId: current?.assigneeId ?? null,
          newAssigneeId: assignee.id,
        },
        reason: dto.note?.trim(),
        requestId: context.requestId ?? null,
      });
    });

    await this.notifications.queueAssignment(
      report.id,
      assignee.id,
      report.referenceCode,
      report.language,
    );

    return this.getForStaff(report.id, user, context.requestId);
  }

  /** Changes urgency, verification and escalation independently of status. */
  async triage(
    idOrReference: string,
    dto: TriageReportDto,
    user: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const report = await this.findReport(idOrReference);

    if (TERMINAL_STATUSES.has(report.status)) {
      throw new ConflictError(
        'This report is closed and can no longer be triaged.',
        'report_terminal',
      );
    }

    if (dto.urgency) {
      assertUrgencyChangeAllowed(report.urgency, dto.urgency, user.permissions);
    }
    if (dto.verificationStatus) {
      assertVerificationChangeAllowed(dto.verificationStatus, dto.reason, user.permissions);
    }
    if (dto.escalationState) {
      assertEscalationAllowed(dto.escalationState, dto.reason, user.permissions);
    }

    const escalatedNow =
      dto.escalationState === 'ESCALATED_INTERNAL' &&
      report.escalationState !== 'ESCALATED_INTERNAL';

    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: report.id },
        data: {
          ...(dto.urgency ? { urgency: dto.urgency } : {}),
          ...(dto.verificationStatus ? { verificationStatus: dto.verificationStatus } : {}),
          ...(dto.escalationState ? { escalationState: dto.escalationState } : {}),
        },
      });

      // Triage is recorded as history too, even when the status did not move —
      // otherwise "why was this VERIFIED?" has no answer.
      if (dto.urgency || dto.verificationStatus || dto.escalationState) {
        await tx.reportStatusHistory.create({
          data: {
            reportId: report.id,
            fromStatus: report.status,
            toStatus: report.status,
            urgencyBefore: report.urgency,
            urgencyAfter: dto.urgency ?? report.urgency,
            verificationBefore: report.verificationStatus,
            verificationAfter: dto.verificationStatus ?? report.verificationStatus,
            escalationBefore: report.escalationState,
            escalationAfter: dto.escalationState ?? report.escalationState,
            changedById: user.id,
            changedByName: user.fullName,
            reason: dto.reason?.trim() ?? null,
            requestId: context.requestId ?? null,
          },
        });
      }

      await this.audit.recordInTransaction(tx, {
        actorUserId: user.id,
        actorEmail: user.email,
        actorRoles: user.roles,
        action: 'reports.triaged',
        entityType: 'report',
        entityId: report.id,
        metadata: {
          referenceCode: report.referenceCode,
          urgency: { from: report.urgency, to: dto.urgency ?? report.urgency },
          verification: {
            from: report.verificationStatus,
            to: dto.verificationStatus ?? report.verificationStatus,
          },
          escalation: {
            from: report.escalationState,
            to: dto.escalationState ?? report.escalationState,
          },
        },
        reason: dto.reason?.trim(),
        requestId: context.requestId ?? null,
      });
    });

    if (escalatedNow) {
      // Internal escalation only. No police, ambulance or other external service
      // is contacted, and none can be — there is no such integration. The
      // notification tells the reviewer exactly that.
      await this.notifications.queueEscalation(
        report.id,
        report.referenceCode,
        dto.reason ?? 'Escalated for review',
        report.language,
      );
    }

    return this.getForStaff(report.id, user, context.requestId);
  }

  async addNote(
    idOrReference: string,
    body: string,
    user: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const report = await this.findReport(idOrReference);

    const assignment = await this.prisma.reportAssignment.findFirst({
      where: { reportId: report.id, active: true },
    });

    await this.assertReadable(report, user, assignment?.assigneeId === user.id, context.requestId);

    const note = await this.prisma.reportNote.create({
      data: {
        reportId: report.id,
        authorId: user.id,
        body: body.trim(),
        requestId: context.requestId ?? null,
      },
      include: { author: { select: { id: true, fullName: true } } },
    });

    // Note *bodies* are never placed in metadata — they are free text about a
    // named person in most cases.
    await this.audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRoles: user.roles,
      action: 'reports.note.added',
      entityType: 'report',
      entityId: report.id,
      metadata: { referenceCode: report.referenceCode, noteId: note.id },
      requestId: context.requestId ?? null,
    });

    return note;
  }

  async linkDuplicate(
    idOrReference: string,
    dto: LinkDuplicateDto,
    user: AuthenticatedUser,
    context: RequestMeta,
  ) {
    const report = await this.findReport(idOrReference);
    const canonical = await this.findReport(dto.duplicateOfReferenceCode.trim().toUpperCase());

    if (canonical.id === report.id) {
      throw new BadRequestError(
        'A report cannot be a duplicate of itself.',
        'self_duplicate',
      );
    }

    const existingDuplicate = await this.prisma.report.findFirst({
      where: { duplicateOfReportId: canonical.id },
    });

    if (existingDuplicate && existingDuplicate.id !== report.id) {
      // Chaining duplicates (A→B→C) makes the queue confusing and the audit
      // trail harder to follow. Always link to the oldest.
      throw new ConflictError(
        'Another report is already recorded as a duplicate of that one. Link to the original report instead.',
        'duplicate_already_linked',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: report.id },
        data: { duplicateOfReportId: canonical.id },
      });

      await tx.reportStatusHistory.create({
        data: {
          reportId: report.id,
          fromStatus: report.status,
          toStatus: report.status,
          changedById: user.id,
          changedByName: user.fullName,
          reason: `Linked as duplicate of ${canonical.referenceCode}: ${dto.reason.trim()}`,
          requestId: context.requestId ?? null,
        },
      });

      await this.audit.recordInTransaction(tx, {
        actorUserId: user.id,
        actorEmail: user.email,
        actorRoles: user.roles,
        action: 'reports.duplicate.linked',
        entityType: 'report',
        entityId: report.id,
        metadata: {
          referenceCode: report.referenceCode,
          canonicalReference: canonical.referenceCode,
        },
        reason: dto.reason.trim(),
        requestId: context.requestId ?? null,
      });
    });

    return this.getForStaff(report.id, user, context.requestId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Internals
  // ═══════════════════════════════════════════════════════════════════════════

  private async findReport(idOrReference: string): Promise<Report> {
    const needle = idOrReference.trim();

    const report = await this.prisma.report.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(needle)
            ? [{ id: needle }]
            : []),
          { referenceCode: needle.toUpperCase() },
        ],
      },
    });

    if (!report) throw new NotFoundError('Report', 'report_not_found');
    return report;
  }

  /**
   * Retries on a reference-code collision rather than failing the submission.
   *
   * A resident who has described a problem in their own words should not lose
   * it because two requests happened to draw the same 8 characters.
   */
  private async generateUniqueReferenceCode(): Promise<string> {
    for (let attempt = 1; attempt <= MAX_REFERENCE_ATTEMPTS; attempt += 1) {
      const candidate = this.crypto.referenceCode();
      const exists = await this.prisma.report.findUnique({
        where: { referenceCode: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;

      this.logger.warn(`Reference code collision on attempt ${attempt}; regenerating`);
    }

    throw new ConflictError(
      'We could not generate a reference code for your report. Please try again.',
      'reference_generation_failed',
    );
  }

  /**
   * Refuses precise coordinates unless both the platform flag and the caller's
   * permission allow them.
   *
   * Precise location is treated as sensitive because it can identify a household
   * directly, which is why the default is a landmark description.
   */
  private assertLocationPolicy(dto: SubmitReportDto): void {
    if (dto.locationPrecision === 'PRECISE') {
      if (!this.env.ALLOW_PRECISE_LOCATIONS) {
        throw new ForbiddenError(
          'Precise location sharing is not currently available. Please describe a ' +
            'nearby landmark or name your kebele instead.',
          'precise_location_disabled',
        );
      }

      if (dto.latitude === undefined || dto.longitude === undefined) {
        throw new BadRequestError(
          'Provide both a latitude and a longitude, or use a landmark description.',
          'incomplete_coordinates',
        );
      }
    }

    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      if (dto.latitude !== undefined && (dto.latitude < -90 || dto.latitude > 90)) {
        throw new BadRequestError('Latitude is out of range.', 'invalid_latitude');
      }
      if (dto.longitude !== undefined && (dto.longitude < -180 || dto.longitude > 180)) {
        throw new BadRequestError('Longitude is out of range.', 'invalid_longitude');
      }
    }
  }

  /** Catches the contradictory combinations a form can easily produce. */
  private assertContactConsistency(dto: SubmitReportDto, isAnonymous: boolean): void {
    if (isAnonymous) {
      const supplied = [dto.reporterName, dto.reporterPhone, dto.reporterEmail].filter(Boolean);
      if (supplied.length > 0) {
        throw new BadRequestError(
          'Do not include contact details with an anonymous report, or submit without the anonymous option.',
          'anonymous_with_contact_details',
        );
      }
      return;
    }

    if (dto.preferredContactMethod && dto.preferredContactMethod !== 'NONE') {
      const method = dto.preferredContactMethod;
      const hasDetail =
        (method === 'PHONE' && dto.reporterPhone) ||
        (method === 'SMS' && dto.reporterPhone) ||
        (method === 'EMAIL' && dto.reporterEmail);

      if (!hasDetail) {
        throw new BadRequestError(
          `You chose ${method} as your contact method, so please provide the matching details.`,
          'contact_method_without_details',
        );
      }
    }
  }

  private buildAdminWhere(
    query: AdminReportQuery,
    scope: ReturnType<typeof buildReportScope>,
  ): Prisma.ReportWhereInput {
    const where: Prisma.ReportWhereInput = { deletedAt: null };

    switch (scope.mode) {
      case 'assigned':
        where.assignments = { some: { active: true, assigneeId: scope.userId } };
        break;
      case 'organization':
        where.assignments = {
          some: { active: true, organizationId: { in: scope.organizationIds } },
        };
        break;
      case 'all':
        if (query.organizationId) {
          where.assignments = {
            some: { active: true, organizationId: query.organizationId },
          };
        }
        break;
      default:
        // `mode === 'none'` throws before this is reached; belt and braces so a
        // future refactor cannot turn it into "return everything".
        where.id = '00000000-0000-0000-0000-000000000000';
    }

    if (query.search) {
      const needle = query.search.trim();
      where.OR = [
        { referenceCode: { contains: needle.toUpperCase(), mode: 'insensitive' } },
        {
          category: {
            is: { key: { contains: needle.toLowerCase(), mode: 'insensitive' } },
          },
        },
      ];
      // Only a reference code is searchable here. Deliberately *not* the
      // description: full-text search over resident free text would let anyone
      // with list access read report contents through the search box.
    }

    if (query.categoryKey) where.category = { is: { key: query.categoryKey } };
    if (query.status) where.status = query.status;
    if (query.urgency) where.urgency = query.urgency;
    if (query.verificationStatus) where.verificationStatus = query.verificationStatus;
    if (query.escalationState) where.escalationState = query.escalationState;

    if (query.assignedToMe) {
      where.assignments = { some: { active: true, assigneeId: scope.userId } };
    }
    if (query.unassigned) {
      where.assignments = { none: { active: true } };
    }

    if (query.submittedFrom || query.submittedTo) {
      where.submittedAt = {
        ...(query.submittedFrom ? { gte: query.submittedFrom } : {}),
        ...(query.submittedTo ? { lte: query.submittedTo } : {}),
      };
    }

    return where;
  }

  private buildOrderBy(query: AdminReportQuery): Prisma.ReportOrderByWithRelationInput[] {
    const direction = query.sortDirection ?? 'desc';

    // Whitelist rather than passing the query value through: an unvalidated
    // `orderBy` is a direct way to probe columns.
    const sortable: Record<string, Prisma.ReportOrderByWithRelationInput> = {
      submittedAt: { submittedAt: direction },
      updatedAt: { updatedAt: direction },
      urgency: { urgency: direction },
      status: { status: direction },
      referenceCode: { referenceCode: direction },
    };

    return [sortable[query.sortBy ?? 'submittedAt'] ?? sortable.submittedAt, { id: 'asc' }];
  }

  private toAdminSummary(row: {
    id: string;
    referenceCode: string;
    status: ReportStatus;
    urgency: Urgency;
    verificationStatus: VerificationStatus;
    escalationState: EscalationState;
    language: string;
    isAnonymous: boolean;
    submittedAt: Date;
    updatedAt: Date;
    firstReviewedAt: Date | null;
    resolvedAt: Date | null;
    closedAt: Date | null;
    duplicateOfReportId: string | null;
    category: { key: string; labelI18n: unknown };
    assignments: Array<{ assignee: { id: string; fullName: string; email: string } }>;
  }) {
    return {
      id: row.id,
      referenceCode: row.referenceCode,
      status: row.status,
      urgency: row.urgency,
      verificationStatus: row.verificationStatus,
      escalationState: row.escalationState,
      language: row.language,
      isAnonymous: row.isAnonymous,
      submittedAt: row.submittedAt,
      updatedAt: row.updatedAt,
      firstReviewedAt: row.firstReviewedAt,
      resolvedAt: row.resolvedAt,
      closedAt: row.closedAt,
      duplicateOfReportId: row.duplicateOfReportId,
      categoryKey: row.category.key,
      categoryLabel: (row.category.labelI18n as Record<string, string>) ?? {},
      assignedTo: row.assignments[0]?.assignee
        ? {
            id: row.assignments[0].assignee.id,
            fullName: row.assignments[0].assignee.fullName,
          }
        : null,
    };
  }

  private toAdminDetail(
    report: Report & {
      category: { key: string; labelI18n: unknown };
      location: {
        precision: string;
        subCityName: string | null;
        woredaName: string | null;
        kebeleName: string | null;
        landmarkDescription: string | null;
        latitude: unknown;
        longitude: unknown;
      } | null;
      reporterIdentity: {
        isAnonymous: boolean;
        fullName: string | null;
        phone: string | null;
        email: string | null;
        preferredContactMethod: string | null;
        languagePreference: string | null;
      } | null;
      assignments: Array<{
        id: string;
        active: boolean;
        assignedAt: Date;
        unassignedAt: Date | null;
        note: string | null;
        organizationId: string | null;
        assignee: { id: string; fullName: string; email: string };
        assignedBy: { id: string; fullName: string };
      }>;
      statusHistory: Array<{
        id: string;
        fromStatus: ReportStatus;
        toStatus: ReportStatus;
        urgencyBefore: Urgency | null;
        urgencyAfter: Urgency | null;
        verificationBefore: VerificationStatus | null;
        verificationAfter: VerificationStatus | null;
        escalationBefore: EscalationState | null;
        escalationAfter: EscalationState | null;
        reason: string | null;
        createdAt: Date;
        changedBy: { id: string; fullName: string } | null;
        changedByName: string;
      }>;
      notes: Array<{
        id: string;
        body: string;
        createdAt: Date;
        author: { id: string; fullName: string };
      }>;
      attachments: Array<{
        id: string;
        originalName: string;
        contentType: string;
        byteSize: number;
        scanStatus: string;
        createdAt: Date;
      }>;
    },
    flags: {
      includeIdentity: boolean;
      includePreciseLocation: boolean;
      permissions: PermissionCode[];
    },
  ) {
    const showPrecise =
      flags.includePreciseLocation && report.location?.precision === 'PRECISE';

    return {
      id: report.id,
      referenceCode: report.referenceCode,
      status: report.status,
      urgency: report.urgency,
      verificationStatus: report.verificationStatus,
      escalationState: report.escalationState,
      language: report.language,
      isAnonymous: report.isAnonymous,
      description: report.description,
      incidentOccurredAt: report.incidentOccurredAt,
      incidentTimePrecision: report.incidentTimePrecision,
      reporterConsentGiven: report.reporterConsentGiven,
      submittedAt: report.submittedAt,
      updatedAt: report.updatedAt,
      firstReviewedAt: report.firstReviewedAt,
      resolvedAt: report.resolvedAt,
      closedAt: report.closedAt,
      resolutionNote: report.resolutionNote,
      rejectionReason: report.rejectionReason,
      duplicateOfReportId: report.duplicateOfReportId,
      categoryKey: report.category.key,
      categoryLabel: (report.category.labelI18n as Record<string, string>) ?? {},

      location: report.location
        ? {
            precision: report.location.precision,
            subCityName: report.location.subCityName,
            woredaName: report.location.woredaName,
            kebeleName: report.location.kebeleName,
            landmarkDescription: report.location.landmarkDescription,
            // Coordinates are withheld rather than omitted, so the client can
            // show "withheld — you do not have permission" instead of an
            // ambiguous blank.
            latitude: showPrecise ? report.location.latitude : null,
            longitude: showPrecise ? report.location.longitude : null,
            preciseLocationWithheld:
              report.location.precision === 'PRECISE' && !showPrecise,
          }
        : null,

      // Explicitly null with a flag, not silently dropped.
      reporter: flags.includeIdentity
        ? {
            available: true,
            isAnonymous: report.reporterIdentity?.isAnonymous ?? true,
            fullName: report.reporterIdentity?.fullName ?? null,
            phone: report.reporterIdentity?.phone ?? null,
            email: report.reporterIdentity?.email ?? null,
            preferredContactMethod: report.reporterIdentity?.preferredContactMethod ?? null,
            languagePreference: report.reporterIdentity?.languagePreference ?? null,
          }
        : { available: false, withheld: true },

      assignments: report.assignments.map((assignment) => ({
        id: assignment.id,
        active: assignment.active,
        assignee: assignment.assignee,
        assignedBy: assignment.assignedBy,
        organizationId: assignment.organizationId,
        assignedAt: assignment.assignedAt,
        unassignedAt: assignment.unassignedAt,
        note: assignment.note,
      })),

      statusHistory: report.statusHistory.map((entry) => ({
        id: entry.id,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        urgencyBefore: entry.urgencyBefore,
        urgencyAfter: entry.urgencyAfter,
        verificationBefore: entry.verificationBefore,
        verificationAfter: entry.verificationAfter,
        escalationBefore: entry.escalationBefore,
        escalationAfter: entry.escalationAfter,
        reason: entry.reason,
        // System-driven entries have no changedBy row; the name snapshot covers
        // the rest, including deleted accounts.
        changedByName: entry.changedBy?.fullName ?? entry.changedByName,
        createdAt: entry.createdAt,
      })),

      notes: report.notes.map((note) => ({
        id: note.id,
        body: note.body,
        author: note.author,
        createdAt: note.createdAt,
      })),

      attachments: report.attachments.map((attachment) => ({
        id: attachment.id,
        originalName: attachment.originalName,
        contentType: attachment.contentType,
        byteSize: attachment.byteSize,
        scanStatus: attachment.scanStatus,
        createdAt: attachment.createdAt,
        downloadUrl: `/api/v1/admin/reports/${report.id}/attachments/${attachment.id}`,
      })),

      availableTransitions: availableTransitions(report.status, flags.permissions),
    };
  }

  /**
   * Resident-facing wording.
   *
   * Says what is happening without implying a response time or a judgement. A
   * resident reading "Under review" deserves to know it was received and is
   * being looked at, not to be told when to expect help.
   */
  private publicStatusMessage(report: Report, locale: string) {
    return publicStatusMessage(report.status, locale);
  }
}

export interface RequestMeta {
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

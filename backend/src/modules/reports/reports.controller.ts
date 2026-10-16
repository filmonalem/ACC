import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { Request } from 'express';
import { ReportsService, type AdminReportQuery } from './reports.service';
import {
  AddReportNoteDto,
  AssignReportDto,
  LinkDuplicateDto,
  ReferenceCodeParam,
  ReportStatusLookupDto,
  SubmitReportDto,
  TriageReportDto,
  UpdateReportStatusDto,
} from './dto/report.dto';
import {
  CurrentUser,
  Public,
  RequirePermissions,
  type AuthenticatedUser,
} from '../../common/decorators/auth.decorators';
import { PageMetaDto, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { BadRequestError } from '../../common/errors/domain.errors';
import { STATUS_TRANSITIONS } from '../../common/authorization/report-lifecycle';
import { ROUTE_LIMITS } from '../../config/rate-limits';
import {
  REPORTS_ADD_NOTES,
  REPORTS_ASSIGN,
  REPORTS_LINK_DUPLICATE,
  REPORTS_TRIAGE,
  REPORTS_VIEW_ASSIGNED,
} from '../../common/permissions';
import type {
  EscalationState,
  ReportStatus,
  Urgency,
  VerificationStatus,
} from '../../generated/prisma/enums';

/**
 * Derived from the lifecycle map so the query validator and the workflow can
 * never disagree about which statuses exist.
 *
 * Declared before the DTOs and controllers below because decorators run at class
 * definition time: a `const` further down the file would still be in its
 * temporal dead zone and the module would throw on import.
 */
const REPORT_STATUSES = [
  ...new Set<ReportStatus>([
    'SUBMITTED',
    ...Object.values(STATUS_TRANSITIONS).flatMap((rules) => rules.map((rule) => rule.to)),
  ]),
];

/**
 * Staff list filters.
 *
 * Every field is declared and validated: the global ValidationPipe runs with
 * `forbidNonWhitelisted`, so an unrecognised query parameter is an error rather
 * than a silently ignored typo that looks like a filter that did nothing.
 */
class AdminReportQueryParams extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(24)
  search!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoryKey!: string;

  @IsOptional()
  @IsEnum(REPORT_STATUSES)
  status!: ReportStatus;

  @IsOptional()
  @IsEnum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'])
  urgency!: Urgency;

  @IsOptional()
  @IsEnum(['UNVERIFIED', 'VERIFIED', 'DISPUTED', 'REJECTED'])
  verificationStatus!: VerificationStatus;

  @IsOptional()
  @IsEnum(['NONE', 'REVIEW_PENDING', 'ESCALATED_INTERNAL', 'ESCALATION_CLOSED'])
  escalationState!: EscalationState;

  @IsOptional()
  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  assignedToMe!: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unassigned!: boolean;

  @IsOptional()
  @IsISO8601()
  submittedFrom!: string;

  @IsOptional()
  @IsISO8601()
  submittedTo!: string;

  @IsOptional()
  @IsEnum(['submittedAt', 'updatedAt', 'urgency', 'status', 'referenceCode'])
  sortBy!: 'submittedAt' | 'updatedAt' | 'urgency' | 'status' | 'referenceCode';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDirection!: 'asc' | 'desc';
}

/**
 * Public report submission and resident status lookup.
 *
 * Split from the staff routes so the two can evolve independently and so it is
 * obvious at a glance which endpoints are reachable without a session.
 */
@ApiTags('Reports (public)')
@Controller('reports')
export class PublicReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Public()
  @Post()
  // The strictest rate limit in the system: this is the most abused and most
  // expensive endpoint, and the one a flood would do most damage to.
  @Throttle({ default: ROUTE_LIMITS.SUBMISSION })
  @ApiOperation({
    summary: 'Submit a report',
    description:
      'No account required. Returns a reference code and a single-use status ' +
      'token — the pair is the only way to check status later, so store both.',
  })
  @ApiResponse({ status: 201, description: 'Report accepted and assigned a reference code' })
  @ApiResponse({ status: 403, description: 'Anonymous reporting is not currently available' })
  @ApiResponse({ status: 429, description: 'Too many submissions from this connection' })
  async submit(
    @Body() dto: SubmitReportDto,
    @Req() request: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // Header length is bounded here as well as in the schema column, so an
    // oversized key is rejected before it reaches the database.
    if (idempotencyKey && idempotencyKey.length > 128) {
      throw new BadRequestError('That idempotency key is too long.', 'idempotency_key_too_long');
    }

    const result = await this.reports.submit(dto, this.meta(request), idempotencyKey);

    return {
      referenceCode: result.referenceCode,
      // Shown once. On an idempotent replay this is empty and the client is
      // told to use the token it already has.
      statusToken: result.statusToken || null,
      replayed: result.replayed,
      status: result.status,
      submittedAt: result.submittedAt,
    };
  }

  @Public()
  @Get(':referenceCode/status')
  // Discourages reference-code enumeration. The status token requirement does
  // the real work; this just keeps the log volume down.
  @Throttle({ default: ROUTE_LIMITS.STATUS_LOOKUP })
  @ApiOperation({
    summary: 'Check the status of a report you submitted',
    description:
      'Requires both the reference code and the status token issued at ' +
      'submission. Either alone reveals nothing.',
  })
  @ApiResponse({ status: 404, description: 'No matching report and token combination' })
  async lookup(
    // Validated as its own object: the reference code is a path segment, not a
    // query parameter, and `forbidNonWhitelisted` would otherwise reject every
    // request that does not also send it as one.
    @Param() params: ReferenceCodeParam,
    @Query() query: ReportStatusLookupDto,
  ) {
    return this.reports.lookupStatus(
      params.referenceCode,
      query.statusToken,
      query.locale,
    );
  }

  private meta(request: Request) {
    return {
      requestId: (request as Request & { requestId?: string }).requestId ?? null,
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    };
  }
}

/**
 * Staff report management.
 *
 * Every route is permission-declared. The class-level `view_assigned` is the
 * floor; individual routes add what they need, and `getForStaff` re-checks the
 * assignment itself rather than trusting the list scope.
 */
@ApiTags('Reports (staff)')
@ApiResponse({ status: 401, description: 'Not signed in' })
@ApiResponse({ status: 403, description: 'Signed in but not permitted' })
@Controller('admin/reports')
@RequirePermissions(REPORTS_VIEW_ASSIGNED)
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  // Only the class-level `view_assigned` floor applies here, deliberately.
  // Listing two permissions would demand *both* under the guard's AND
  // semantics, which would lock out a triage officer who may legitimately see
  // reports assigned to them. The scope itself — assigned-only, one
  // organization, or everything authorized — is decided by `buildReportScope`
  // from the caller's actual grants, so it is never widened by this decorator.
  @ApiOperation({
    summary: 'List reports within your authorized scope',
    description:
      'Returns reports assigned to you, or the full authorized scope if you hold ' +
      'reports.view_all_authorized. The response is always narrowed to your grants.',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'search', required: false, description: 'Reference code only' })
  @ApiQuery({ name: 'categoryKey', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'] })
  @ApiQuery({ name: 'urgency', required: false, enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] })
  @ApiQuery({ name: 'assignedToMe', required: false, type: Boolean })
  @ApiQuery({ name: 'unassigned', required: false, type: Boolean })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['submittedAt', 'updatedAt', 'urgency', 'status', 'referenceCode'] })
  @ApiQuery({ name: 'sortDirection', required: false, enum: ['asc', 'desc'] })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AdminReportQueryParams,
  ) {
    const parsed = this.parseQuery(query);
    const result = await this.reports.listForStaff(parsed, user);

    return {
      data: result.data,
      meta: PageMetaDto.build(result.page, result.pageSize, result.total),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Report detail with history, assignments, notes and attachments',
    description:
      'Accepts a UUID or a reference code. Reporter identity and precise ' +
      'coordinates are withheld unless separately permitted.',
  })
  async detail(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.reports.getForStaff(
      id,
      user,
      (request as Request & { requestId?: string }).requestId,
    );
  }

  @Patch(':id/status')
  // No extra `@RequirePermissions` here on purpose. The guard requires *every*
  // permission it is given, so adding `reports.update_status` on top of the
  // class floor would also lock out a triage officer who may legitimately move a
  // report to UNDER_REVIEW on `reports.triage` alone — the lifecycle map defines
  // both edges as valid for that role.
  //
  // The per-edge permission check therefore lives in `assertTransitionAllowed`,
  // where it is data rather than a decorator, and is enforced inside the same
  // database transaction as the state change. See report-lifecycle.ts.
  @ApiOperation({
    summary: 'Move a report to a new status',
    description:
      'Which transitions exist, and which permission each one requires, is defined ' +
      'centrally in the report lifecycle. An attempt to skip a step, or to act ' +
      'without the matching permission, is refused with 409 and audited.',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.reports.updateStatus(id, dto, user, this.meta(request));
  }

  @Post(':id/assign')
  @RequirePermissions(REPORTS_ASSIGN)
  @ApiOperation({ summary: 'Assign or reassign a report' })
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.reports.assign(id, dto, user, this.meta(request));
  }

  @Post(':id/triage')
  @RequirePermissions(REPORTS_TRIAGE)
  @ApiOperation({
    summary: 'Change urgency, verification status or escalation state',
    description:
      'These are independent of workflow status. Escalating notifies designated ' +
      'review personnel inside ACC only — it does not contact any external service.',
  })
  async triage(
    @Param('id') id: string,
    @Body() dto: TriageReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.reports.triage(id, dto, user, this.meta(request));
  }

  @Post(':id/notes')
  @RequirePermissions(REPORTS_ADD_NOTES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an internal note (never shown to the resident)' })
  async addNote(
    @Param('id') id: string,
    @Body() dto: AddReportNoteDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.reports.addNote(id, dto.body, user, this.meta(request));
  }

  @Post(':id/duplicate')
  @RequirePermissions(REPORTS_LINK_DUPLICATE)
  @ApiOperation({ summary: 'Link this report as a duplicate of an earlier one' })
  async linkDuplicate(
    @Param('id') id: string,
    @Body() dto: LinkDuplicateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.reports.linkDuplicate(id, dto, user, this.meta(request));
  }

  @Get(':id/available-transitions')
  @ApiOperation({
    summary: 'Transitions available from the current status, for this actor',
    description:
      'Lets the dashboard show only the actions that will actually succeed, ' +
      'without the client reimplementing the rules.',
  })
  async transitions(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const report = await this.reports.getForStaff(id, user);
    return { status: report.status, transitions: report.availableTransitions };
  }

  private meta(request: Request) {
    return {
      requestId: (request as Request & { requestId?: string }).requestId ?? null,
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    };
  }

  private parseQuery(query: AdminReportQueryParams): AdminReportQuery {
    const toDate = (value?: string) => {
      if (!value) return undefined;
      const parsed = new Date(value);
      // ValidationPipe has already rejected a malformed date, so this only
      // catches an out-of-range value the ISO check accepts.
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    };

    return {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      categoryKey: query.categoryKey,
      status: query.status as ReportStatus | undefined,
      urgency: query.urgency as Urgency | undefined,
      verificationStatus: query.verificationStatus as VerificationStatus | undefined,
      escalationState: query.escalationState as EscalationState | undefined,
      assignedToMe: query.assignedToMe,
      unassigned: query.unassigned,
      organizationId: query.organizationId,
      submittedFrom: toDate(query.submittedFrom),
      submittedTo: toDate(query.submittedTo),
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
    };
  }
}



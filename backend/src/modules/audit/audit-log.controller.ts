import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { AUDIT_VIEW } from '../../common/permissions';
import { PageMetaDto, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { NotFoundError } from '../../common/errors/domain.errors';

class AuditLogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityId?: string;

  @IsOptional()
  @IsEnum(['SUCCESS', 'DENIED', 'FAILURE'])
  outcome?: 'SUCCESS' | 'DENIED' | 'FAILURE';

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestId?: string;
}

/**
 * Read-only access to the audit trail.
 *
 * There is deliberately no POST, PATCH or DELETE on this controller. The trail
 * is written by `AuditService` and by nothing else, and the absence of a
 * mutation route here is what makes that claim checkable rather than aspirational.
 */
@ApiTags('Audit log')
@Controller('admin/audit-logs')
@RequirePermissions(AUDIT_VIEW)
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Audit trail',
    description:
      'Append-only. Failed and denied actions are recorded as well as ' +
      'successful ones — a pattern of denials is the clearest signal that ' +
      'something is wrong.',
  })
  @ApiQuery({ name: 'actorUserId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'action', required: false, description: 'Prefix match, e.g. `reports.`' })
  @ApiQuery({ name: 'outcome', required: false, enum: ['SUCCESS', 'DENIED', 'FAILURE'] })
  async list(@Query() query: AuditLogQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      // Prefix rather than equality, so `reports.` returns every report action.
      ...(query.action ? { action: { startsWith: query.action, mode: 'insensitive' } } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.outcome ? { outcome: query.outcome } : {}),
      ...(query.requestId ? { requestId: query.requestId } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { actor: { select: { id: true, fullName: true, status: true } } },
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        occurredAt: row.occurredAt,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        outcome: row.outcome,
        reason: row.reason,
        metadata: row.metadata,
        requestId: row.requestId,
        actor: row.actor
          ? { id: row.actor.id, fullName: row.actor.fullName, status: row.actor.status }
          : null,
        // Snapshot values, not a join on the live user: the record must show
        // what was true when the action happened.
        actorEmail: row.actorEmail,
        actorRoles: row.actorRoles,
        organizationId: row.organizationId,
        ipAddress: row.ipAddress,
      })),
      meta: PageMetaDto.build(query.page, query.pageSize, total),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Counts of denied actions in a window, for oversight' })
  @ApiQuery({ name: 'days', required: false })
  async deniedStats(@Query('days') days?: string) {
    const window = days ? Number(days) : 7;
    const since = new Date(Date.now() - (Number.isFinite(window) ? window : 7) * 86_400_000);

    const grouped = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: { outcome: 'DENIED', occurredAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { action: 'desc' } },
      take: 25,
    });

    return {
      windowDays: Number.isFinite(window) ? window : 7,
      deniedActions: grouped.map((entry) => ({ action: entry.action, count: entry._count._all })),
    };
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'The complete trail for one record' })
  async forEntity(
    @Query() _query: PaginationQueryDto,
    entityType: string,
    entityId: string,
  ) {
    const rows = await this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { occurredAt: 'desc' },
    });

    if (rows.length === 0) {
      throw new NotFoundError('Audit trail', 'audit_trail_not_found');
    }

    return { data: rows, total: rows.length };
  }
}


import { Injectable, Logger } from '@nestjs/common';
import { AuditOutcome, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { redact } from '../logger/redaction';

/**
 * The only writer of `AuditLog`.
 *
 * Exposed API is deliberately narrow: `record()` and `denied()`. There is no
 * update and no delete, by design — an audit trail that can be edited is a log,
 * not an audit trail.
 *
 * Two behaviours matter for the security checklist:
 *
 *  - **Failures are audited too.** `denied()` records a permission refusal.
 *    A pattern of denials against one account is the clearest available signal
 *    that something is wrong.
 *
 *  - **Writes never break the request.** An audit failure is logged and
 *    swallowed. Refusing a resident's report because the audit insert timed out
 *    would be worse than a gap in the trail, and the reverse — silently
 *    continuing without any trail — is avoided by the explicit warning log.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.write(entry, AuditOutcome.SUCCESS);
  }

  async denied(entry: AuditEntry & { reason?: string }): Promise<void> {
    await this.write(entry, AuditOutcome.DENIED);
  }

  /**
   * Writes inside an existing transaction when one is supplied.
   *
   * Status transitions call this with their transaction client so the audit row
   * and the state change commit together — a committed change with no audit row
   * would be indistinguishable from a bug.
   */
  async recordInTransaction(
    tx: Prisma.TransactionClient,
    entry: AuditEntry,
  ): Promise<void> {
    await tx.auditLog.create({ data: this.toData(entry, AuditOutcome.SUCCESS) });
  }

  private async write(entry: AuditEntry, outcome: AuditOutcome): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: this.toData(entry, outcome) });
    } catch (error) {
      this.logger.warn(
        `AUDIT WRITE FAILED action=${entry.action} entity=${entry.entityType} — the action itself is unaffected, but this event is missing from the audit trail`,
      );
      this.logger.error(error instanceof Error ? error.stack : String(error));
    }
  }

  private toData(entry: AuditEntry, outcome: AuditOutcome): Prisma.AuditLogUncheckedCreateInput {
    return {
      actorUserId: entry.actorUserId ?? null,
      actorEmail: entry.actorEmail ?? null,
      actorRoles: entry.actorRoles ?? [],
      organizationId: entry.organizationId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      outcome,
      // Redacted here rather than at the call site, so no caller can opt out.
      metadata: entry.metadata
        ? (redact(entry.metadata) as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      reason: entry.reason ?? null,
      requestId: entry.requestId ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    };
  }
}

export interface AuditEntry {
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRoles?: string[];
  organizationId?: string | null;
  /** Dotted verb phrase, e.g. `reports.status.changed`. */
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  reason?: string;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

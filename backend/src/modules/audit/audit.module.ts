import { Module } from '@nestjs/common';
import { AuditLogController } from './audit-log.controller';

/**
 * The read-only half of the audit trail. `AuditService`, which writes it, lives
 * in `common/` and is provided by the global `CommonModule`.
 */
@Module({ controllers: [AuditLogController] })
export class AuditModule {}

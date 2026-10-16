import { Global, Module } from '@nestjs/common';
import { CryptoService } from './services/crypto.service';
import { PasswordService } from './services/password.service';
import { StructuredLogger } from './logger/structured-logger';
import { AuditService } from './audit/audit.service';
import { StorageService } from './storage/storage.service';

/**
 * Cross-cutting singletons.
 *
 * Global because they are infrastructure, not business logic: there is one
 * hashing implementation, one redacting logger, one audit writer, one storage
 * root. Duplicating any of these per module is how a codebase ends up with two
 * subtly different redaction rules.
 */
@Global()
@Module({
  providers: [
    CryptoService,
    PasswordService,
    StructuredLogger,
    AuditService,
    StorageService,
  ],
  exports: [
    CryptoService,
    PasswordService,
    StructuredLogger,
    AuditService,
    StorageService,
  ],
})
export class CommonModule {}

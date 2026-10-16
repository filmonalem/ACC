import { Injectable, Logger, Scope } from '@nestjs/common';
import { isSensitiveRoute, redact } from './redaction';

/**
 * Structured JSON logging with redaction applied before serialisation.
 *
 * Hand-rolled rather than pulled from a library for one reason that matters
 * here: redaction has to happen inside this class, at the single point where a
 * log record is built. With a third-party logger it is tempting to pass an
 * object straight through and rely on its `redact` config, which is easy to
 * bypass with an ad-hoc `logger.info(someObject)` call somewhere in a service.
 * Here there is exactly one way to emit a record and it always redacts.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLogger {
  private readonly logger = new Logger('ACC');

  info(fields: Record<string, unknown>): void {
    this.emit('info', fields);
  }

  warn(fields: Record<string, unknown>): void {
    this.emit('warn', fields);
  }

  error(fields: Record<string, unknown>): void {
    this.emit('error', fields);
  }

  /**
   * Logs an inbound request.
   *
   * `body` is accepted for convenience and then thrown away on sensitive routes:
   * report content must not reach the log pipeline at all, not even partially
   * redacted, because "partially redacted personal data" is still personal data.
   */
  request(fields: {
    requestId: string;
    method: string;
    path: string;
    status?: number;
    durationMs?: number;
    userId?: string;
    body?: unknown;
    query?: unknown;
    userAgent?: string;
  }): void {
    const { body, query, path, ...rest } = fields;
    const sensitive = isSensitiveRoute(path);

    this.emit('info', {
      ...rest,
      path,
      userAgent: sensitive ? undefined : fields.userAgent,
      body: sensitive ? '[omitted: sensitive route]' : redact(body),
      query: sensitive ? '[omitted: sensitive route]' : redact(query),
    });
  }

  private emit(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>): void {
    const record = {
      level,
      time: new Date().toISOString(),
      ...(redact(fields) as Record<string, unknown>),
    };

    const line = JSON.stringify(record, (_key, value) =>
      value instanceof Error ? { name: value.name, message: value.message } : value,
    );

    if (level === 'error') this.logger.error(line);
    else if (level === 'warn') this.logger.warn(line);
    else this.logger.log(line);
  }
}

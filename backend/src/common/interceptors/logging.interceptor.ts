import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { StructuredLogger } from '../logger/structured-logger';

/**
 * Assigns a request id, exposes it on the response, and logs one line per
 * request.
 *
 * The id is generated here rather than taken from a header so a client cannot
 * inject a value that later ends up in a log line or an audit row. If an
 * upstream proxy sets `x-request-id`, it is recorded as a *separate* field so
 * the two are never confused.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly structured: StructuredLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string }>();
    const response = http.getResponse<Response>();

    const requestId = randomUUID();
    request.requestId = requestId;

    // Lets a resident quote one string when reporting a problem, without
    // revealing anything about their request.
    response.setHeader('x-request-id', requestId);
    response.setHeader('cache-control', 'no-store');

    const startedAt = process.hrtime.bigint();
    const upstreamRequestId = request.get('x-request-id') ?? undefined;

    const finish = (status: number) => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      this.structured.request({
        requestId,
        method: request.method,
        path: request.path,
        status,
        durationMs: Math.round(durationMs * 100) / 100,
        userId: (request as Request & { user?: { id?: string } }).user?.id,
        body: request.body,
        query: request.query,
        userAgent: request.get('user-agent') ?? '',
      });

      if (upstreamRequestId) {
        this.structured.info({ requestId, upstreamRequestId });
      }
    };

    return next.handle().pipe(
      tap({
        next: () => finish(response.statusCode),
        error: () => {
          // Error responses are logged by AllExceptionsFilter, which knows the
          // final status. Logging here as well would double every failure line.
        },
      }),
    ) as Observable<unknown>;
  }
}

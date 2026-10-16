import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from '../errors/domain.errors';
import { sanitizeErrorMessage } from '../logger/redaction';
import { StructuredLogger } from '../logger/structured-logger';

/**
 * The single place an error becomes an HTTP response.
 *
 * Centralising this is what makes the guarantees in the security checklist
 * hold: one code path decides what is disclosed, so a controller cannot
 * accidentally return a stack trace, a Prisma message, or a raw constraint
 * name to a resident.
 *
 * Disclosure rules:
 *  - `DomainError`      → its status, code and message. Messages on these are
 *                         written deliberately for residents.
 *  - `HttpException`    → its status and message, sanitised.
 *  - Anything else      → 500 with a generic message and the request id.
 *                         The real detail goes to the log, never to the client.
 *
 * Prisma error codes are translated deliberately: a resident who resubmits a
 * form should not learn the database's constraint names.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly structured: StructuredLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request as Request & { requestId?: string }).requestId ?? 'unknown';
    const { status, code, message, details } = this.toResponseBody(exception);

    const body: Record<string, unknown> = {
      error: {
        code,
        message,
        requestId,
      },
    };
    if (details && Object.keys(details).length > 0) {
      (body.error as Record<string, unknown>).details = details;
    }

    if (!response.headersSent) {
      response.status(status).json(body);
    }

    const isServerFault = status >= HttpStatus.INTERNAL_SERVER_ERROR;

    this.structured.error({
      requestId,
      method: request.method,
      // Path only. Query strings can carry search terms and, in a careless
      // implementation, identifiers — they are not logged.
      path: request.path,
      status,
      code,
      reason: isServerFault ? sanitizeErrorMessage(message) : undefined,
      stack: isServerFault && exception instanceof Error ? exception.stack : undefined,
      userAgent: request.get('user-agent') ?? '',
    });

    if (isServerFault && !(exception instanceof HttpException)) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.path} (requestId=${requestId})`,
      );
    }
  }

  private toResponseBody(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } {
    if (exception instanceof DomainError) {
      return {
        status: exception.status,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // class-validator errors arrive as an object with `message: string[]`.
      if (typeof payload === 'object' && payload !== null && 'message' in payload) {
        const message = (payload as { message: unknown }).message;
        const flattened = Array.isArray(message) ? message.join(' ') : String(message);

        return {
          status,
          code: status === HttpStatus.BAD_REQUEST ? 'bad_request' : 'request_failed',
          message: sanitizeErrorMessage(flattened),
          details: Array.isArray(message) ? { violations: message } : undefined,
        };
      }

      return {
        status,
        code: status === HttpStatus.TOO_MANY_REQUESTS ? 'rate_limited' : 'request_failed',
        message: sanitizeErrorMessage(typeof payload === 'string' ? payload : 'Request failed.'),
      };
    }

    if (isPrismaError(exception)) {
      return { ...mapPrismaError(exception) };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'internal_error',
      message:
        'Something went wrong on our side. Nothing you submitted has been lost — please try again or contact us with the reference below.',
    };
  }
}

// ── Prisma translation ───────────────────────────────────────────────────────

interface PrismaLikeError {
  code?: string;
  meta?: Record<string, unknown>;
  message?: string;
}

function isPrismaError(exception: unknown): exception is PrismaLikeError {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'code' in exception &&
    typeof (exception as PrismaLikeError).code === 'string' &&
    (exception as PrismaLikeError).code!.startsWith('P')
  );
}

/**
 * Translates Prisma error codes into resident-facing messages.
 *
 * The important part is what is *not* here: constraint names, column names and
 * table names never reach the client, because they describe the schema to
 * someone probing it.
 */
function mapPrismaError(error: PrismaLikeError): {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
} {
  switch (error.code) {
    case 'P2002': {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(', ')
        : 'a field';
      // The reference-code collision is handled by retrying in the service; if
      // it reaches here it is a different unique constraint.
      return {
        status: HttpStatus.CONFLICT,
        code: 'duplicate_value',
        message: `This submission could not be accepted because ${target} is already in use. Please review your entry and try again.`,
      };
    }

    case 'P2003':
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'invalid_reference',
        message: 'The request referred to a record that does not exist.',
      };

    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        code: 'not_found',
        message: 'The record was not found.',
      };

    case 'P2034':
      return {
        status: HttpStatus.CONFLICT,
        code: 'write_conflict',
        message:
          'Another update to this record happened at the same time. Please try again.',
      };

    default:
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'internal_error',
        message: 'Something went wrong on our side. Please try again.',
      };
  }
}

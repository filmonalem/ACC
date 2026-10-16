import { HttpStatus } from '@nestjs/common';

/**
 * Domain errors.
 *
 * The HTTP status and a stable machine-readable `code` live on the error, not
 * in the controller. Controllers therefore cannot accidentally return 200 for a
 * failed transition, and clients switch on `code` rather than parsing prose.
 *
 * The `message` here is safe to show a resident: the exception filter does not
 * invent messages for unexpected errors, it *redacts* them, and only for
 * internal failures. Domain errors are written deliberately with that in mind.
 */
export class DomainError extends Error {
  constructor(
    readonly status: HttpStatus,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends DomainError {
  constructor(message: string, code = 'bad_request', details?: Record<string, unknown>) {
    super(HttpStatus.BAD_REQUEST, code, message, details);
  }
}

export class ValidationFailedError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, 'validation_failed', message, details);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Authentication required.', code = 'unauthorized') {
    super(HttpStatus.UNAUTHORIZED, code, message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(
    message = 'You do not have permission to perform this action.',
    code = 'forbidden',
    details?: Record<string, unknown>,
  ) {
    super(HttpStatus.FORBIDDEN, code, message, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource = 'Resource', code = 'not_found') {
    super(HttpStatus.NOT_FOUND, code, `${resource} was not found.`);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, code = 'conflict', details?: Record<string, unknown>) {
    super(HttpStatus.CONFLICT, code, message, details);
  }
}

/**
 * 429 with an explicit retry hint.
 *
 * Used where retrying later is genuinely the right advice (report submission
 * under rate limiting) rather than where the client should change behaviour.
 */
export class RateLimitError extends DomainError {
  constructor(retryAfterSeconds: number) {
    super(
      HttpStatus.TOO_MANY_REQUESTS,
      'rate_limited',
      'Too many requests. Please wait before trying again.',
      { retryAfterSeconds },
    );
  }
}

/**
 * A workflow rule was broken — an illegal status transition, an attempt to
 * publish an unverified contact, an approval by the announcement's author.
 *
 * 409 rather than 400: the request was well-formed, but it conflicts with the
 * current state of the system.
 */
export class TransitionNotAllowedError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(HttpStatus.CONFLICT, 'transition_not_allowed', message, details);
  }
}

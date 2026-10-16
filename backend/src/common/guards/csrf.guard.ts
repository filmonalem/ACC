import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ForbiddenError } from '../errors/domain.errors';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { CryptoService } from '../services/crypto.service';
import type { Env } from '../../config/env.schema';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection by double-submit cookie.
 *
 * The access and refresh cookies are `SameSite=Strict`, which blocks the
 * classic cross-site POST outright. This guard is the second layer, covering the
 * cases SameSite does not: a browser that predates it, a same-site subdomain an
 * attacker controls, and configuration drift.
 *
 * Why the CSRF cookie is *not* httpOnly: the server's job is to compare two
 * values — the cookie and a header the browser client sets from it. Reading the
 * cookie in JavaScript is what lets the client attach the header, and it is
 * useless to an attacker precisely because a cross-origin script cannot read it.
 *
 * The token is HMAC-signed with the access secret, so a value the attacker
 * supplies in *both* the cookie and the header is still rejected.
 *
 * The refresh cookie is additionally path-scoped to `/api/v1/auth`, so it is
 * never attached to any other request and cannot be read by a successful
 * cross-site form post.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  /**
   * Cookie and header names are read from validated configuration rather than
   * hard-coded, so renaming either in the environment cannot leave this guard
   * checking two names the application no longer sends — which would fail open
   * in effect, since the comparison would never find a token to check.
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly crypto: CryptoService,
    @Inject('ACC_ENV') private readonly env: Env,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const csrfCookieName = this.env.CSRF_COOKIE_NAME;
    const csrfHeaderName = this.env.CSRF_HEADER_NAME;

    // Public routes are exempt, and must be: report submission and status
    // lookup are reached by residents with no session, so there is no CSRF
    // cookie to double-submit. Nothing to protect there either — these routes
    // act on a token or an anonymous payload, never on a browser-held session,
    // which is exactly the condition CSRF defends against.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const cookies = (request as Request & { cookies?: Record<string, string> }).cookies ?? {};
    const cookieToken = cookies[csrfCookieName];
    const headerValue = request.get(csrfHeaderName);

    if (!cookieToken || !headerValue) {
      throw new ForbiddenError(
        'This request could not be verified. Please refresh the page and try again.',
        'csrf_token_missing',
      );
    }

    if (!this.crypto.verifyCsrfToken(cookieToken) || !this.crypto.verifyCsrfToken(headerValue)) {
      throw new ForbiddenError(
        'This request could not be verified. Please refresh the page and try again.',
        'csrf_token_invalid',
      );
    }

    // Constant-time compare, so the two values cannot be matched byte by byte.
    if (!this.crypto.timingSafeEqual(cookieToken, headerValue)) {
      throw new ForbiddenError(
        'This request could not be verified. Please refresh the page and try again.',
        'csrf_token_mismatch',
      );
    }

    return true;
  }
}

import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../errors/domain.errors';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, type AuthenticatedUser } from '../decorators/auth.decorators';
import type { PermissionCode } from '../permissions';
import type { RoleKey } from '../../generated/prisma/enums';
import type { Env } from '../../config/env.schema';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  roles: RoleKey[];
  perms: PermissionCode[];
  /** Organization ids these grants are scoped to. Empty means global. */
  orgs: string[];
  mfa: boolean;
  /**
   * What this token is allowed to do.
   *
   * `enrolment` is a deliberately crippled session, issued when a privileged
   * account has not yet set up MFA. Without it there is a deadlock: login
   * refuses because MFA is missing, and the enrolment endpoints need a session
   * that login would have refused to issue.
   *
   * Such a token carries **no permissions**, so it reaches only the two
   * enrolment routes — every staff endpoint is gated by `@RequirePermissions`
   * and therefore refuses an empty permission set. The value is re-asserted here
   * as well as at issuance, so a hand-crafted token cannot widen itself.
   */
  scope: 'full' | 'enrolment';
  /** Session (refresh-token family) id. */
  sid: string;
  /**
   * `sessionsInvalidatedAt` at the moment the token was issued. Lets a disabled
   * account or a "sign out everywhere" action take effect immediately, instead
   * of waiting out the 15-minute access token.
   */
  siat: number;
  typ: 'access';
}

/**
 * Authenticates the request from the httpOnly access cookie.
 *
 * Every failure returns the same outward message, so a caller cannot tell
 * "no such user" from "bad signature" and cannot use the endpoint to discover
 * which accounts exist.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject('ACC_ENV') private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    if (isPublic) return true;

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedError('Sign in to continue.', 'no_credentials');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.env.JWT_ACCESS_SECRET,
        // Rejects an algorithm-substitution attempt: the token must be signed
        // with the algorithm we issued it with, not one an attacker prefers.
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedError(
        'Your session has expired. Please sign in again.',
        'invalid_token',
      );
    }

    if (payload.typ !== 'access') {
      throw new UnauthorizedError('Invalid token type.', 'invalid_token');
    }

    (request as Request & { user: AuthenticatedUser }).user = {
      id: payload.sub,
      email: payload.email,
      fullName: payload.name,
      roles: payload.roles,
      // Re-asserted here rather than trusted from the token: an enrolment
      // session must never carry a capability, however the token was minted.
      permissions: payload.scope === 'enrolment' ? [] : payload.perms,
      organizationIds: payload.orgs ?? [],
      mfaEnabled: payload.mfa === true,
      sessionId: payload.sid,
      scope: payload.scope ?? 'full',
    };

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
    const fromCookie = cookies?.[this.env.AUTH_COOKIE_NAME];
    if (fromCookie) return fromCookie;

    // Only honoured outside the browser client, which relies on the cookie.
    // Exists for scripted administrative access and the e2e suite.
    const auth = request.get('authorization');
    if (auth?.startsWith('Bearer ')) return auth.slice(7);

    return undefined;
  }
}

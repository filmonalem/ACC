import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PermissionCode } from '../permissions';
import type { RoleKey } from '../../generated/prisma/enums';

export const IS_PUBLIC_KEY = 'acc:isPublic';
export const PERMISSIONS_KEY = 'acc:permissions';
export const ROLES_KEY = 'acc:roles';

/**
 * Opts a route out of authentication.
 *
 * Only ever applied to genuinely public routes (submission, status lookup,
 * published content). It is deliberately explicit rather than default-off, so
 * the set of public routes is greppable from the controllers.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Requires *every* listed permission.
 *
 * Requiring all rather than any: an endpoint is one capability, and splitting
 * it into "needs A or B" invites a future edit that quietly widens it.
 */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Coarse role check, for the few places where a role really is the condition
 * (e.g. "only a supervisor may approve an announcement"). Permissions are the
 * primary mechanism; this is a secondary assertion, not a replacement.
 */
export const RequireRoles = (...roles: RoleKey[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  roles: RoleKey[];
  permissions: PermissionCode[];
  /** Organizations the user may act within, plus `null` for a global grant. */
  organizationIds: string[];
  mfaEnabled: boolean;
  sessionId: string;
  /**
   * `enrolment` marks a session that exists only so an account without MFA can
   * set MFA up. It carries no permissions — see `AccessTokenPayload`.
   */
  scope: 'full' | 'enrolment';
}

/**
 * Injects the authenticated principal.
 *
 * Throws rather than returning `undefined`, so a handler that forgets to guard a
 * route fails loudly in development instead of dereferencing null in
 * production.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new Error(
        'CurrentUser used on a route that is not authenticated. ' +
          'Add @Public() if the route is intentionally public.',
      );
    }
    return request.user;
  },
);

/** Same as CurrentUser, but `undefined` on a public route. */
export const OptionalUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined =>
    context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>().user,
);

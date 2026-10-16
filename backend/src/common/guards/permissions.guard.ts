import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ForbiddenError } from '../errors/domain.errors';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, ROLES_KEY, type AuthenticatedUser } from '../decorators/auth.decorators';
import type { PermissionCode } from '../permissions';
import type { RoleKey } from '../../generated/prisma/enums';

/**
 * Enforces the permissions declared on the route.
 *
 * This guard is the security boundary. The frontend hides buttons a user cannot
 * use, but that is a usability measure — every one of these checks is repeated
 * here, on the server, where a caller cannot reach around it.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredRoles = this.reflector.getAllAndOverride<RoleKey[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length && !requiredRoles?.length) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) {
      throw new ForbiddenError('Authentication required.', 'unauthenticated');
    }

    // Every required permission must be held. "Any" semantics would let a single
    // broad grant quietly satisfy a narrow endpoint.
    const missing = required?.filter((permission) => !user.permissions.includes(permission));

    if (missing && missing.length > 0) {
      throw new ForbiddenError(
        'You do not have permission to perform this action.',
        'missing_permission',
        { required: missing },
      );
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const holds = requiredRoles.some((role) => user.roles.includes(role));
      if (!holds) {
        throw new ForbiddenError(
          'Your role does not permit this action.',
          'missing_role',
          { requiredRoles },
        );
      }
    }

    return true;
  }
}

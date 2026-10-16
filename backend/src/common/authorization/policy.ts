import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from '../errors/domain.errors';
import { ALL_PERMISSION_CODES, MFA_REQUIRED_ROLES } from '../permissions';
import type { PermissionCode } from '../permissions';
import type { RoleKey } from '../../generated/prisma/enums';

/**
 * Effective-permission calculation.
 *
 * Kept as pure functions, separate from both the guards and the database, for
 * three reasons:
 *
 *  1. The authorization rules are the most security-critical logic in the
 *     codebase and deserve to be testable without a database or an HTTP server.
 *  2. The same calculation has to run in three places — token issuance, the
 *     permissions guard, and the "which reports may I see?" query — and one
 *     implementation means they cannot drift.
 *  3. It makes the rule "System administrators do not get report access" a
 *     visible, testable statement rather than an absence.
 */

export interface RoleGrant {
  roleKey: RoleKey;
  /** null = applies to every organization the user can reach. */
  organizationId: string | null;
  expiresAt: Date | null;
  permissions: PermissionCode[];
}

export interface Principal {
  userId: string;
  email: string;
  roles: RoleKey[];
  grants: RoleGrant[];
  mfaEnabled: boolean;
}

export interface EffectiveAccess {
  roles: RoleKey[];
  permissions: PermissionCode[];
  /** Empty means the user holds at least one global (unscoped) grant. */
  organizationIds: string[];
}

export function isGrantActive(grant: RoleGrant, now: Date): boolean {
  return grant.expiresAt === null || grant.expiresAt.getTime() > now.getTime();
}

/**
 * Flattens role grants into the permission set carried on the access token.
 *
 * Unknown permission codes are dropped rather than propagated, so a stale token
 * minted before a permission was renamed cannot carry a grant that no longer
 * means anything.
 */
export function effectiveAccess(principal: Principal, now = new Date()): EffectiveAccess {
  const active = principal.grants.filter((grant) => isGrantActive(grant, now));
  const known = new Set<string>(ALL_PERMISSION_CODES);

  const permissions = new Set<PermissionCode>();
  for (const grant of active) {
    for (const permission of grant.permissions) {
      if (known.has(permission)) permissions.add(permission);
    }
  }

  const roles = new Set<RoleKey>(active.map((grant) => grant.roleKey));

  return {
    roles: [...roles],
    permissions: [...permissions],
    organizationIds: active
      .map((grant) => grant.organizationId)
      .filter((id): id is string => id !== null),
  };
}

/**
 * Requires MFA.
 *
 * Derived from the roles that can change what the public sees — approve an
 * announcement, manage accounts, run retention — rather than from seniority
 * alone, so granting a supervisory role does not silently weaken the control.
 */
export function requiresMfa(roles: RoleKey[]): boolean {
  return roles.some((role) => MFA_REQUIRED_ROLES.has(role));
}

/**
 * The scope filter for a report listing.
 *
 * This is where "least privilege" becomes a query. Three cases:
 *
 *  - no permission to view anything → return nothing, never an empty page that
 *    implies "there is nothing here".
 *  - `reports.view_all_authorized` → every report, optionally narrowed to the
 *    user's organizations.
 *  - only `reports.view_assigned` → only reports assigned to this user.
 *
 * `organizationId` narrowing applies to the view-all case: a supervisor
 * appointed to one organization should not read every organization's reports
 * just because they hold the broad permission.
 */
export interface ReportScope {
  mode: 'none' | 'assigned' | 'organization' | 'all';
  userId: string;
  organizationIds: string[];
  /** Explicit filter from the request, intersected with the permitted set. */
  requestedOrganizationId?: string;
}

export function buildReportScope(
  userId: string,
  permissions: PermissionCode[],
  organizationIds: string[],
  requestedOrganizationId?: string,
): ReportScope {
  const canViewAll = permissions.includes('reports.view_all_authorized');
  const canViewAssigned = permissions.includes('reports.view_assigned');

  if (!canViewAll && !canViewAssigned) {
    return { mode: 'none', userId, organizationIds };
  }

  const requested = requestedOrganizationId?.trim();

  if (canViewAll) {
    // A global grant (no organizationIds) means the user is not scoped.
    const isGloballyScoped = organizationIds.length === 0;

    if (isGloballyScoped && !requested) {
      return { mode: 'all', userId, organizationIds };
    }

    const permitted = isGloballyScoped ? (requested ? [requested] : []) : organizationIds;

    if (requested && !permitted.includes(requested)) {
      throw new ForbiddenError(
        'You are not authorized to view reports for that organization.',
        'organization_out_of_scope',
      );
    }

    return { mode: 'organization', userId, organizationIds: permitted };
  }

  // Assigned-only. An organization filter cannot widen this, so ignore it
  // rather than returning something surprising.
  return { mode: 'assigned', userId, organizationIds, requestedOrganizationId: requested };
}

/**
 * Boolean form of the sensitive-read checks.
 *
 * The service layer needs the answer (to decide what to select from the
 * database) rather than an exception, and calling the `assert*` variant in a
 * try/catch to find out would be both ugly and wrong — a throw there would be
 * indistinguishable from a genuine denial. The `assert*` wrappers below are for
 * routes where the read is the entire point of the request.
 */
export function canViewReporterIdentity(permissions: PermissionCode[]): boolean {
  return permissions.includes('reports.view_reporter_identity');
}

export function canViewPreciseLocation(permissions: PermissionCode[]): boolean {
  return permissions.includes('reports.view_precise_location');
}

/** Guard for endpoints that require an actual assigned report. */
export function assertCanReadReport(
  permissions: PermissionCode[],
  isAssignedToUser: boolean,
): void {
  if (permissions.includes('reports.view_all_authorized')) return;
  if (permissions.includes('reports.view_assigned') && isAssignedToUser) return;

  // The same message either way: a staff member with no access must not be able
  // to confirm that a report exists.
  throw new ForbiddenError('You do not have access to this report.', 'report_not_visible');
}

/** Reporter identity is a separate, separately audited act. */
export function assertCanReadReporterIdentity(permissions: PermissionCode[]): void {
  if (!canViewReporterIdentity(permissions)) {
    throw new ForbiddenError(
      'You are not authorized to view the identity of the person who submitted this report.',
      'identity_access_denied',
    );
  }
}

export function assertCanReadPreciseLocation(permissions: PermissionCode[]): void {
  if (!canViewPreciseLocation(permissions)) {
    throw new ForbiddenError(
      'You are not authorized to view precise coordinates for this report.',
      'precise_location_denied',
    );
  }
}

/**
 * Account state required to hold any staff capability at all.
 *
 * Checked at token issuance; the short access-token lifetime plus the `siat`
 * claim bound how long a disabled account stays usable.
 */
export function assertAccountUsable(status: string, sessionsInvalidatedAt: Date | null, siat: number): void {
  if (status !== 'ACTIVE') {
    throw new ForbiddenError('This account is not active.', 'account_not_active');
  }

  if (sessionsInvalidatedAt && sessionsInvalidatedAt.getTime() > siat) {
    throw new UnauthorizedError(
      'Your session has ended. Please sign in again.',
      'session_invalidated',
    );
  }
}

/** MFA enrolment is refused once a privileged account already has it enabled. */
export function assertCanEnrolMfa(roles: RoleKey[], alreadyEnabled: boolean): void {
  if (!requiresMfa(roles)) {
    throw new BadRequestError(
      'MFA is not required for your role.',
      'mfa_not_required_for_role',
    );
  }
  if (alreadyEnabled) {
    throw new BadRequestError(
      'MFA is already enabled on this account.',
      'mfa_already_enabled',
    );
  }
}

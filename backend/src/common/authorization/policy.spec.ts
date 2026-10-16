import { describe, expect, it } from 'vitest';
import {
  assertCanReadReport,
  assertCanReadReporterIdentity,
  buildReportScope,
  canViewPreciseLocation,
  canViewReporterIdentity,
  effectiveAccess,
  isGrantActive,
  requiresMfa,
  type Principal,
  type RoleGrant,
} from './policy';
import { DEFAULT_ROLE_GRANTS, PERMISSIONS } from '../permissions';
import type { PermissionCode } from '../permissions';
import type { RoleKey } from '../../generated/prisma/enums';

/**
 * These tests are the executable form of the least-privilege claims in
 * src/common/permissions.ts, which is the executable version of the same
 * policy. Most of these tests are negative: the interesting
 * failure mode is a permission quietly being too broad, not too narrow.
 */

function grant(
  roleKey: RoleKey,
  permissions: PermissionCode[],
  organizationId: string | null = null,
  expiresAt: Date | null = null,
): RoleGrant {
  return { roleKey, organizationId, expiresAt, permissions };
}

function principal(grants: RoleGrant[], overrides: Partial<Principal> = {}): Principal {
  return {
    userId: 'user-1',
    email: 'someone@example.invalid',
    roles: [...new Set(grants.map((g) => g.roleKey))],
    grants,
    mfaEnabled: false,
    ...overrides,
  };
}

describe('effectiveAccess', () => {
  it('drops an expired grant', () => {
    const access = effectiveAccess(
      principal([
        grant('TRIAGE_OFFICER', ['reports.triage'], null, new Date('2020-01-01')),
      ]),
      new Date('2026-01-01'),
    );

    expect(access.permissions).not.toContain('reports.triage');
    expect(access.roles).not.toContain('TRIAGE_OFFICER');
  });

  it('keeps a grant that has not expired', () => {
    const access = effectiveAccess(
      principal([grant('TRIAGE_OFFICER', ['reports.triage'], null, new Date('2027-01-01'))]),
      new Date('2026-01-01'),
    );

    expect(access.permissions).toContain('reports.triage');
  });

  it('drops a permission code that no longer exists', () => {
    // A token minted before a permission was renamed must not carry a grant
    // that matches nothing, which would look like a live grant to a reviewer.
    const access = effectiveAccess(
      principal([grant('RESIDENT', ['reports.create', 'reports.do_anything' as PermissionCode])]),
    );

    expect(access.permissions).toContain('reports.create');
    expect(access.permissions).not.toContain('reports.do_anything');
  });

  it('collects organizations from scoped grants only', () => {
    const access = effectiveAccess(
      principal([
        grant('TRIAGE_OFFICER', ['reports.triage'], 'org-a'),
        grant('SERVICE_OFFICER', ['reports.resolve'], 'org-b'),
      ]),
    );

    expect(access.organizationIds.sort()).toEqual(['org-a', 'org-b']);
  });
});

describe('requiresMfa', () => {
  it('demands MFA for roles that can change what the public sees', () => {
    expect(requiresMfa(['SUPERVISOR'])).toBe(true);
    expect(requiresMfa(['SYSTEM_ADMIN'])).toBe(true);
    expect(requiresMfa(['CONTENT_EDITOR'])).toBe(true);
  });

  it('does not demand MFA for roles that only read or triage', () => {
    expect(requiresMfa(['TRIAGE_OFFICER'])).toBe(false);
    expect(requiresMfa(['SERVICE_OFFICER'])).toBe(false);
    expect(requiresMfa([])).toBe(false);
  });

  it('is not satisfied by seniority alone: a supervisor is still a supervisor', () => {
    // Guards against someone "simplifying" this to a seniority check, which
    // would let a future role with approval rights skip MFA.
    expect(requiresMfa(['TRIAGE_OFFICER', 'SUPERVISOR'])).toBe(true);
  });
});

describe('buildReportScope', () => {
  const userId = 'user-1';

  it('returns nothing when the caller holds no report permission at all', () => {
    const scope = buildReportScope(userId, ['contacts.view'], []);

    expect(scope.mode).toBe('none');
  });

  it('narrows to assigned reports for an assigned-only officer', () => {
    const scope = buildReportScope(userId, ['reports.view_assigned'], []);

    expect(scope.mode).toBe('assigned');
  });

  it('grants the full scope to an authorized viewer', () => {
    const scope = buildReportScope(userId, ['reports.view_all_authorized'], []);

    expect(scope.mode).toBe('all');
  });

  it('still narrows an authorized viewer to their own organizations', () => {
    // The most important negative test in this file: holding the broad
    // permission must not mean seeing every organization's reports when the
    // appointment is scoped to one.
    const scope = buildReportScope(userId, ['reports.view_all_authorized'], ['org-a']);

    expect(scope.mode).toBe('organization');
    expect(scope.organizationIds).toEqual(['org-a']);
  });

  it('refuses to widen scope by naming an organization the caller is not in', () => {
    expect(() =>
      buildReportScope(userId, ['reports.view_all_authorized'], ['org-a'], 'org-b'),
    ).toThrow();
  });

  it('does not let an organization filter widen an assigned-only officer', () => {
    const scope = buildReportScope(
      userId,
      ['reports.view_assigned'],
      ['org-a'],
      'org-b',
    );

    expect(scope.mode).toBe('assigned');
  });
});

describe('sensitive report fields', () => {
  const supervisorGrants = DEFAULT_ROLE_GRANTS.SUPERVISOR as PermissionCode[];
  const triageGrants = DEFAULT_ROLE_GRANTS.TRIAGE_OFFICER as PermissionCode[];

  it('does not give a system administrator any report-content permission', () => {
    // Stated explicitly in the design docs; a regression here is the most
    // serious thing this codebase could do by accident.
    const adminGrants = DEFAULT_ROLE_GRANTS.SYSTEM_ADMIN as PermissionCode[];

    expect(adminGrants).not.toContain(PERMISSIONS.REPORTS_VIEW_ASSIGNED);
    expect(adminGrants).not.toContain(PERMISSIONS.REPORTS_VIEW_ALL_AUTHORIZED);
    expect(adminGrants).not.toContain(PERMISSIONS.REPORTS_VIEW_REPORTER_IDENTITY);
    expect(adminGrants).not.toContain(PERMISSIONS.REPORTS_VIEW_PRECISE_LOCATION);
  });

  it('withholds reporter identity from a triage officer', () => {
    expect(canViewReporterIdentity(triageGrants)).toBe(false);
    expect(() => assertCanReadReporterIdentity(triageGrants)).toThrow();
  });

  it('grants reporter identity to a supervisor, because oversight needs it', () => {
    expect(canViewReporterIdentity(supervisorGrants)).toBe(true);
    expect(() => assertCanReadReporterIdentity(supervisorGrants)).not.toThrow();
  });

  it('withholds precise coordinates from everyone by default', () => {
    // No seeded role holds this permission. Reading coordinates identifies a
    // household directly, so it is granted per person, not per role.
    for (const grants of Object.values(DEFAULT_ROLE_GRANTS)) {
      expect(canViewPreciseLocation(grants as PermissionCode[])).toBe(false);
    }
  });

  it('refuses to read a report that is assigned to somebody else', () => {
    expect(() => assertCanReadReport(['reports.view_assigned'], false)).toThrow();
  });

  it('allows an assigned officer to read their own report', () => {
    expect(() => assertCanReadReport(['reports.view_assigned'], true)).not.toThrow();
  });

  it('lets an authorized viewer read an unassigned report', () => {
    expect(() => assertCanReadReport(['reports.view_all_authorized'], false)).not.toThrow();
  });
});

describe('default role grants', () => {
  it('never lets a content editor approve or publish an announcement', () => {
    // Separation of duties: one person must not be able to put unverified
    // emergency information in front of the public.
    const editorGrants = DEFAULT_ROLE_GRANTS.CONTENT_EDITOR as PermissionCode[];

    expect(editorGrants).not.toContain(PERMISSIONS.ANNOUNCEMENTS_APPROVE);
    expect(editorGrants).not.toContain(PERMISSIONS.ANNOUNCEMENTS_PUBLISH);
    expect(editorGrants).toContain(PERMISSIONS.ANNOUNCEMENTS_CREATE);
  });

  it('never gives the emergency-publish permission to a role by default', () => {
    // Publishing a wrong emergency number is the highest-consequence mistake
    // available in this system.
    for (const grants of Object.values(DEFAULT_ROLE_GRANTS)) {
      expect(grants as PermissionCode[]).not.toContain(PERMISSIONS.CONTACTS_PUBLISH_EMERGENCY);
    }
  });

  it('references only permission codes that exist', () => {
    const known = new Set<string>(Object.values(PERMISSIONS));

    for (const [role, grants] of Object.entries(DEFAULT_ROLE_GRANTS)) {
      for (const permission of grants) {
        expect(known.has(permission), `${role} grants unknown ${permission}`).toBe(true);
      }
    }
  });

  it('gives residents no staff capability at all', () => {
    // Residents submit through the public form and hold no staff permission;
    // `reports.create` is the only one, and it is not what authorizes any
    // authenticated route.
    expect(DEFAULT_ROLE_GRANTS.RESIDENT).toEqual([PERMISSIONS.REPORTS_CREATE]);
  });
});

describe('isGrantActive', () => {
  it('treats a grant with no expiry as permanent', () => {
    expect(isGrantActive(grant('RESIDENT', [], null, null), new Date())).toBe(true);
  });

  it('treats a grant expiring in the future as active', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isGrantActive(grant('RESIDENT', [], null, future), new Date())).toBe(true);
  });

  it('treats a grant expiring in the past as inactive', () => {
    const past = new Date(Date.now() - 60_000);
    expect(isGrantActive(grant('RESIDENT', [], null, past), new Date())).toBe(false);
  });
});
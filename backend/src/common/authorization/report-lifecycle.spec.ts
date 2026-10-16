import { describe, expect, it } from 'vitest';
import {
  STATUS_TRANSITIONS,
  TERMINAL_STATUSES,
  assertTransitionAllowed,
  availableTransitions,
  label,
} from './report-lifecycle';
import { ALL_PERMISSION_CODES, type PermissionCode } from '../permissions';
import type { ReportStatus } from '../../generated/prisma/enums';

/**
 * The lifecycle is the part of the system most likely to be edited casually and
 * most costly to get wrong: a bad transition rule either blocks legitimate work
 * or lets a report skip review. These tests are mostly about the *shape* of the
 * graph — reachability, no dead ends, terminal states really are terminal —
 * rather than about any single edge.
 */
describe('report lifecycle', () => {
  const statuses = Object.keys(STATUS_TRANSITIONS) as ReportStatus[];

  it('covers every status the schema can store', () => {
    // If the Prisma enum gains a status and this map does not, the map is
    // incomplete and every transition from the new status throws at runtime.
    expect(statuses).toContain('SUBMITTED');
    expect(statuses).toContain('UNDER_REVIEW');
    expect(statuses).toContain('CLOSED');
    expect(new Set(statuses).size).toBe(statuses.length);
  });

  it('never routes out of a terminal status', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(STATUS_TRANSITIONS[status] ?? []).toEqual([]);
    }
  });

  it('declares only real permission codes on every edge', () => {
    const known = new Set<string>(ALL_PERMISSION_CODES);
    for (const [from, rules] of Object.entries(STATUS_TRANSITIONS)) {
      for (const rule of rules) {
        expect(rule.to, `${from} -> ${rule.to}`).toBeTruthy();
        expect(rule.requiresAnyOf.length, `${from} -> ${rule.to} needs a permission`).toBeGreaterThan(0);
        for (const permission of rule.requiresAnyOf) {
          expect(known.has(permission), `${from} -> ${rule.to} uses unknown ${permission}`).toBe(true);
        }
      }
    }
  });

  it('requires a written reason wherever one is demanded', () => {
    for (const [from, rules] of Object.entries(STATUS_TRANSITIONS)) {
      for (const rule of rules) {
        if (rule.requiresReason) {
          expect(rule.rationale, `${from} -> ${rule.to}`).toBeTruthy();
        }
      }
    }
  });

  it('gives every non-terminal status a way out', () => {
    // A status with no outgoing edge and no terminal marker is a report that
    // can never progress: staff would have to reject it through the back door.
    for (const [status, rules] of Object.entries(STATUS_TRANSITIONS)) {
      if (TERMINAL_STATUSES.has(status as ReportStatus)) continue;
      expect(rules.length, `${status} is a dead end`).toBeGreaterThan(0);
    }
  });

  it('lets a report reach a terminal status from SUBMITTED', () => {
    // Reachability check: a graph can be locally valid and globally trapped.
    const reachable = new Set<ReportStatus>(['SUBMITTED']);
    let grew = true;
    while (grew) {
      grew = false;
      for (const from of reachable) {
        for (const rule of STATUS_TRANSITIONS[from] ?? []) {
          if (!reachable.has(rule.to)) {
            reachable.add(rule.to);
            grew = true;
          }
        }
      }
    }

    for (const terminal of TERMINAL_STATUSES) {
      expect(reachable.has(terminal), `${terminal} is unreachable from SUBMITTED`).toBe(true);
    }
  });

  it('refuses a skip from SUBMITTED straight to IN_PROGRESS', () => {
    // The most likely bad edit: someone adds IN_PROGRESS as a direct target
    // from SUBMITTED to "save a click", quietly removing the review step.
    expect(() =>
      assertTransitionAllowed('SUBMITTED', 'IN_PROGRESS', {
        permissions: ['reports.update_status'],
      }),
    ).toThrow();
  });

  it('refuses to move a closed report, whatever the actor holds', () => {
    const allPermissions = [...ALL_PERMISSION_CODES] as PermissionCode[];
    expect(() =>
      assertTransitionAllowed('CLOSED', 'UNDER_REVIEW', { permissions: allPermissions }),
    ).toThrow();
  });

  it('allows a transition when any one required permission is held', () => {
    expect(() =>
      assertTransitionAllowed('SUBMITTED', 'UNDER_REVIEW', {
        permissions: ['reports.triage'],
      }),
    ).not.toThrow();
  });

  it('rejects a transition when the actor holds an unrelated permission', () => {
    expect(() =>
      assertTransitionAllowed('SUBMITTED', 'UNDER_REVIEW', {
        permissions: ['reports.add_notes'],
      }),
    ).toThrow();
  });

  it('refuses a reason-requiring edge when no reason is given', () => {
    // An unexplained rejection is unreviewable later: the audit trail records
    // that it happened but not why.
    expect(() =>
      assertTransitionAllowed('SUBMITTED', 'REJECTED', {
        permissions: ['reports.update_status'],
      }),
    ).toThrow(/reason/i);

    expect(() =>
      assertTransitionAllowed('SUBMITTED', 'REJECTED', {
        permissions: ['reports.update_status'],
        reason: 'Out of scope for the pilot.',
      }),
    ).not.toThrow();
  });

  it('offers a triage officer only the edges their grants allow', () => {
    const triage: PermissionCode[] = [
      'reports.view_assigned',
      'reports.triage',
      'reports.add_notes',
      'reports.escalate',
      'reports.link_duplicate',
    ];

    const offered = availableTransitions('UNDER_REVIEW', triage).map((rule) => rule.to);

    expect(offered).toContain('VERIFIED'); // needs reports.triage
    expect(offered).toContain('DUPLICATE'); // needs reports.link_duplicate
    expect(offered).not.toContain('ASSIGNED'); // needs reports.assign
    expect(offered).not.toContain('REJECTED'); // needs reports.update_status
  });

  it('labels every status in plain language', () => {
    for (const status of statuses) {
      expect(label(status).length, status).toBeGreaterThan(0);
      // A label that is the raw enum name leaks an implementation detail into
      // the interface.
      expect(label(status)).not.toBe(status);
    }
  });
});
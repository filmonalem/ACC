import { TransitionNotAllowedError } from '../errors/domain.errors';
import type { ReportStatus, Urgency, VerificationStatus, EscalationState } from '../../generated/prisma/enums';
import type { PermissionCode } from '../permissions';

/**
 * The report lifecycle, defined in exactly one place.
 *
 * Every status change in the system goes through `assertTransitionAllowed`.
 * Routes, services and background jobs all call it — there is no second
 * implementation and no endpoint that can skip it. That is what makes
 * "allowed transitions are centrally defined and permission-checked" a property
 * of the system rather than a convention people are asked to follow.
 *
 * The model is a DAG, not a free-form status field. A report walks forward
 * through review and resolution; it does not jump from SUBMITTED straight to
 * RESOLVED, because doing so would mean nobody looked at it.
 */

export interface TransitionRule {
  to: ReportStatus;
  /** Permissions that authorise the move. Satisfied by holding *any* of these. */
  requiresAnyOf: PermissionCode[];
  /** Why this edge exists — shown to staff so the rule is not a puzzle. */
  rationale: string;
  /** A reason string must be supplied when true (rejection, closing). */
  requiresReason?: boolean;
}

/**
 * Outgoing edges per status.
 *
 * Absence of an entry means terminal: no transition is possible from there
 * without an administrative correction, which is itself an audited action.
 */
export const STATUS_TRANSITIONS: Record<ReportStatus, TransitionRule[]> = {
  SUBMITTED: [
    {
      to: 'UNDER_REVIEW',
      requiresAnyOf: ['reports.triage', 'reports.update_status'],
      rationale: 'A staff member has picked the report up for review.',
    },
    {
      to: 'REJECTED',
      requiresAnyOf: ['reports.update_status'],
      rationale: 'The report is out of scope, unreadable, or plainly not actionable.',
      requiresReason: true,
    },
    {
      to: 'DUPLICATE',
      requiresAnyOf: ['reports.link_duplicate'],
      rationale: 'The same concern has already been reported and is being handled.',
      requiresReason: true,
    },
  ],

  UNDER_REVIEW: [
    {
      to: 'VERIFIED',
      requiresAnyOf: ['reports.triage'],
      rationale:
        'Checked against available information. Verification is a judgement about what is known, not proof of the allegation.',
    },
    {
      to: 'ASSIGNED',
      requiresAnyOf: ['reports.assign'],
      rationale: 'Routed to the service responsible for dealing with it.',
    },
    {
      to: 'REJECTED',
      requiresAnyOf: ['reports.update_status'],
      rationale: 'Review concluded the report cannot be acted on.',
      requiresReason: true,
    },
    {
      to: 'DUPLICATE',
      requiresAnyOf: ['reports.link_duplicate'],
      rationale: 'Already covered by another report.',
      requiresReason: true,
    },
  ],

  VERIFIED: [
    {
      to: 'ASSIGNED',
      requiresAnyOf: ['reports.assign'],
      rationale: 'Confirmed as genuine enough to route to a service.',
    },
    // A verification can be withdrawn — which is precisely why urgency and
    // verification are separate axes. High pressure does not prevent this.
    {
      to: 'UNDER_REVIEW',
      requiresAnyOf: ['reports.triage'],
      rationale: 'Reopened: the earlier verification no longer holds.',
      requiresReason: true,
    },
    {
      to: 'REJECTED',
      requiresAnyOf: ['reports.update_status'],
      rationale: 'Verification found the report unfounded.',
      requiresReason: true,
    },
  ],

  ASSIGNED: [
    {
      to: 'IN_PROGRESS',
      requiresAnyOf: ['reports.update_status'],
      rationale: 'The assigned service has started work.',
    },
    {
      to: 'UNDER_REVIEW',
      requiresAnyOf: ['reports.assign', 'reports.triage'],
      rationale: 'Returned for review — wrong service, or new information.',
      requiresReason: true,
    },
    {
      to: 'REJECTED',
      requiresAnyOf: ['reports.update_status'],
      rationale: 'The assigned service declined to act, with reasons.',
      requiresReason: true,
    },
    {
      to: 'DUPLICATE',
      requiresAnyOf: ['reports.link_duplicate'],
      rationale: 'Merged into another report.',
      requiresReason: true,
    },
  ],

  IN_PROGRESS: [
    {
      to: 'RESOLVED',
      requiresAnyOf: ['reports.resolve'],
      rationale: 'Action has been taken and the matter is dealt with.',
    },
    {
      to: 'UNDER_REVIEW',
      requiresAnyOf: ['reports.triage'],
      rationale: 'Work stopped pending further review.',
      requiresReason: true,
    },
    {
      to: 'REJECTED',
      requiresAnyOf: ['reports.update_status'],
      rationale: 'The matter cannot be resolved.',
      requiresReason: true,
    },
  ],

  RESOLVED: [
    {
      to: 'CLOSED',
      requiresAnyOf: ['reports.resolve'],
      rationale: 'Closed after the resolution was accepted or aged out.',
    },
    {
      to: 'IN_PROGRESS',
      requiresAnyOf: ['reports.triage', 'reports.resolve'],
      rationale: 'Reopened: the concern recurred or the resolution failed.',
      requiresReason: true,
    },
  ],

  // Terminal, apart from an audited administrative correction.
  CLOSED: [],
  REJECTED: [],
  DUPLICATE: [],
};

export const TERMINAL_STATUSES: ReadonlySet<ReportStatus> = new Set<ReportStatus>([
  'CLOSED',
  'REJECTED',
  'DUPLICATE',
]);

/** Statuses that mean a report is still live and someone owns the next step. */
export const OPEN_STATUSES: ReadonlySet<ReportStatus> = new Set<ReportStatus>([
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
]);

export interface TransitionContext {
  permissions: PermissionCode[];
  reason?: string | null;
}

/**
 * Validates a transition and returns the rule that authorised it.
 *
 * Throws `TransitionNotAllowedError` when the edge does not exist or the actor
 * lacks any of the permissions that edge requires. The error deliberately does
 * not distinguish "no such transition" from "you may not do that" — telling a
 * staff member which edges exist from a given state is not something a caller
 * needs, and it narrows the probing surface.
 */
export function assertTransitionAllowed(
  from: ReportStatus,
  to: ReportStatus,
  context: TransitionContext,
): TransitionRule {
  const rules = STATUS_TRANSITIONS[from] ?? [];

  if (TERMINAL_STATUSES.has(from)) {
    throw new TransitionNotAllowedError(
      `A report that is ${label(from)} cannot be moved to a different status.`,
      { from, to, terminal: true },
    );
  }

  const rule = rules.find((candidate) => candidate.to === to);

  if (!rule) {
    const allowed = rules.map((candidate) => candidate.to);
    throw new TransitionNotAllowedError(
      allowed.length > 0
        ? `A report that is ${label(from)} can only move to: ${allowed.map(label).join(', ')}.`
        : `A report that is ${label(from)} cannot be moved.`,
      { from, to, allowed },
    );
  }

  const permitted = rule.requiresAnyOf.some((permission) =>
    context.permissions.includes(permission),
  );

  if (!permitted) {
    throw new TransitionNotAllowedError(
      'You do not have permission to make this change.',
      { from, to, requiredAnyOf: rule.requiresAnyOf },
    );
  }

  if (rule.requiresReason && !context.reason?.trim()) {
    throw new TransitionNotAllowedError(
      'This change needs a reason, so the decision can be understood later.',
      { from, to, field: 'reason' },
    );
  }

  return rule;
}

/** Transitions available to this actor from a given state. Powers the UI. */
export function availableTransitions(
  from: ReportStatus,
  permissions: PermissionCode[],
): Array<{ to: ReportStatus; rationale: string; requiresReason: boolean }> {
  if (TERMINAL_STATUSES.has(from)) return [];

  return (STATUS_TRANSITIONS[from] ?? [])
    .filter((rule) => rule.requiresAnyOf.some((permission) => permissions.includes(permission)))
    .map((rule) => ({
      to: rule.to,
      rationale: rule.rationale,
      requiresReason: rule.requiresReason ?? false,
    }));
}

// ── the other three axes ─────────────────────────────────────────────────────

/**
 * Urgency may be raised or lowered at any open point in the lifecycle by
 * someone who can triage.
 *
 * Raising urgency never changes the verification state and never notifies
 * anyone outside ACC. Both the escalation procedure and the resident-facing
 * wording depend on that staying true.
 */
export function assertUrgencyChangeAllowed(
  from: Urgency,
  to: Urgency,
  permissions: PermissionCode[],
): void {
  if (from === to) return;

  if (!permissions.includes('reports.triage')) {
    throw new TransitionNotAllowedError('You do not have permission to change urgency.', {
      requiredAnyOf: ['reports.triage'],
    });
  }
}

/**
 * Verification status is the truth axis and moves far more conservatively than
 * urgency. Moving *back* to UNVERIFIED requires triage; setting REJECTED means
 * the allegation was checked and not upheld, which is a significant statement
 * about someone and therefore requires a reason.
 */
export function assertVerificationChangeAllowed(
  to: VerificationStatus,
  reason: string | undefined,
  permissions: PermissionCode[],
): void {
  if (!permissions.includes('reports.triage')) {
    throw new TransitionNotAllowedError(
      'You do not have permission to change the verification status.',
      { requiredAnyOf: ['reports.triage'] },
    );
  }

  if (to === 'REJECTED' && !reason?.trim()) {
    throw new TransitionNotAllowedError(
      'Marking a report as rejected requires a reason.',
      { field: 'reason' },
    );
  }
}

/**
 * Escalation.
 *
 * ACC has no dispatch integration and never will without an authorized
 * arrangement. So escalation here means exactly one thing: designated review
 * personnel inside the platform are notified. The state name,
 * `ESCALATED_INTERNAL`, is chosen to make that unambiguous in a database dump,
 * and the wording sent to the resident says no response time is implied.
 */
export function assertEscalationAllowed(
  to: EscalationState,
  reason: string | undefined,
  permissions: PermissionCode[],
): void {
  if (to === 'NONE') {
    if (!permissions.includes('reports.triage')) {
      throw new TransitionNotAllowedError(
        'You do not have permission to change escalation state.',
        { requiredAnyOf: ['reports.triage'] },
      );
    }
    return;
  }

  if (!permissions.includes('reports.escalate')) {
    throw new TransitionNotAllowedError(
      'You do not have permission to escalate reports.',
      { requiredAnyOf: ['reports.escalate'] },
    );
  }

  if (to !== 'ESCALATION_CLOSED' && !reason?.trim()) {
    throw new TransitionNotAllowedError(
      'Escalating a report requires a reason recording what was found.',
      { field: 'reason' },
    );
  }
}

/**
 * Assignment requires either the permission or existing involvement in the
 * report. A service officer who already has an assignment may hand it to a
 * colleague without holding the assign permission themselves — otherwise
 * reassignment would dead-end whenever the supervisor is unavailable.
 */
export function assertAssignmentAllowed(
  permissions: PermissionCode[],
  isCurrentlyAssigned: boolean,
): void {
  if (permissions.includes('reports.assign')) return;
  if (isCurrentlyAssigned) return;

  throw new TransitionNotAllowedError('You do not have permission to assign this report.', {
    requiredAnyOf: ['reports.assign'],
  });
}

/** Human labels. The i18n layer translates these; these are the English source. */
export function label(status: ReportStatus): string {
  const labels: Record<ReportStatus, string> = {
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under review',
    VERIFIED: 'Verified',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In progress',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
    REJECTED: 'Rejected',
    DUPLICATE: 'Duplicate',
  };
  return labels[status];
}

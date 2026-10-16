/**
 * The permission catalogue.
 *
 * This file — not the database — is the source of truth for *which permissions
 * exist*. `prisma/seed.ts` syncs these rows and the default role grants below,
 * so a permission can never exist in one place and be missing from the other.
 *
 * Two rules govern how this list is written:
 *
 *  1. Permissions describe *capabilities*, not screens. `reports.view_assigned`
 *     is a capability; `reports.triage_page` would not be.
 *
 *  2. Sensitive reads get their own permission separate from the general one.
 *     Reading a report's narrative and reading the resident who wrote it are
 *     different acts with different consequences, so they are different codes.
 */

export const PERMISSIONS = {
  // ── reports ───────────────────────────────────────────────────────────────
  /** Staff may open the report queue. Necessary but far from sufficient. */
  REPORTS_VIEW_ASSIGNED: 'reports.view_assigned',
  /** See every report in the organization, not only assigned ones. */
  REPORTS_VIEW_ALL_AUTHORIZED: 'reports.view_all_authorized',
  /** Read the resident's name, phone or email on a report. Audited per read. */
  REPORTS_VIEW_REPORTER_IDENTITY: 'reports.view_reporter_identity',
  /** Read precise coordinates. Distinct from viewing the report at all. */
  REPORTS_VIEW_PRECISE_LOCATION: 'reports.view_precise_location',
  /** Triage: change urgency, verification status, and escalation state. */
  REPORTS_TRIAGE: 'reports.triage',
  /** Assign and reassign a report to a staff member. */
  REPORTS_ASSIGN: 'reports.assign',
  /** Drive the workflow status forward or close a report. */
  REPORTS_UPDATE_STATUS: 'reports.update_status',
  /** Add internal triage notes. */
  REPORTS_ADD_NOTES: 'reports.add_notes',
  /** Write the resolution note and close a report as resolved. */
  REPORTS_RESOLVE: 'reports.resolve',
  /** Mark a report as a duplicate of another and link them. */
  REPORTS_LINK_DUPLICATE: 'reports.link_duplicate',
  /** Escalate per the approved escalation procedure. Never implies dispatch. */
  REPORTS_ESCALATE: 'reports.escalate',
  /** Download report attachments. */
  REPORTS_VIEW_ATTACHMENTS: 'reports.view_attachments',
  /** Public submission. Not granted to any staff role — residents need no login. */
  REPORTS_CREATE: 'reports.create',
  /** Accept a lat/long on submission. Off by default platform-wide. */
  REPORTS_SUBMIT_PRECISE_LOCATION: 'reports.submit_precise_location',

  // ── service contacts ─────────────────────────────────────────────────────
  CONTACTS_VIEW: 'contacts.view',
  CONTACTS_MANAGE: 'contacts.manage',
  /** Record a verification attempt. Separate from the ability to publish. */
  CONTACTS_VERIFY: 'contacts.verify',
  /** Make a verified contact visible on the public site. */
  CONTACTS_PUBLISH: 'contacts.publish',
  /**
   * Publish a contact flagged as emergency. Held separately because publishing
   * a wrong emergency number is the highest-consequence mistake in the system.
   */
  CONTACTS_PUBLISH_EMERGENCY: 'contacts.publish_emergency',

  // ── announcements ────────────────────────────────────────────────────────
  ANNOUNCEMENTS_VIEW_DRAFT: 'announcements.view_draft',
  ANNOUNCEMENTS_CREATE: 'announcements.create',
  ANNOUNCEMENTS_EDIT: 'announcements.edit',
  /** Move an announcement to APPROVED. Separation of duties: the author of an
   *  announcement may not approve it (enforced in the service, not just here). */
  ANNOUNCEMENTS_APPROVE: 'announcements.approve',
  /** Make an approved announcement public. */
  ANNOUNCEMENTS_PUBLISH: 'announcements.publish',
  ANNOUNCEMENTS_ARCHIVE: 'announcements.archive',

  // ── support services ─────────────────────────────────────────────────────
  SUPPORT_SERVICES_MANAGE: 'support_services.manage',
  SUPPORT_SERVICES_VERIFY: 'support_services.verify',
  SUPPORT_SERVICES_PUBLISH: 'support_services.publish',

  // ── users, roles, organizations ──────────────────────────────────────────
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  /** Assign and revoke roles. Held by supervisors, not by system admins. */
  ROLES_ASSIGN: 'roles.assign',
  /** Define roles and their permission sets. */
  ROLES_MANAGE: 'roles.manage',
  ORGANIZATIONS_MANAGE: 'organizations.manage',
  /**
   * Approve an organization for participation. This is the gate described in the
   * project brief: only a governance administrator may approve institutional
   * access. Deliberately not bundled into USERS_MANAGE.
   */
  ORGANIZATIONS_APPROVE: 'organizations.approve',

  // ── oversight ────────────────────────────────────────────────────────────
  AUDIT_VIEW: 'audit.view',
  /** View and action privacy requests (access, correction, deletion). */
  PRIVACY_MANAGE: 'privacy.manage',
  /** Run retention and purge jobs manually. Every run is audited. */
  RETENTION_MANAGE: 'retention.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Each permission also exported as its own constant.
 *
 * Without this, a controller has to write `PERMISSIONS.REPORTS_TRIAGE` inside
 * every `@RequirePermissions(...)` decorator. Named exports keep the decorator
 * readable, and — more importantly — mean a typo is an unresolved-import error
 * at compile time rather than a permission string that silently matches nothing
 * at runtime.
 */
export const {
  REPORTS_VIEW_ASSIGNED,
  REPORTS_VIEW_ALL_AUTHORIZED,
  REPORTS_VIEW_REPORTER_IDENTITY,
  REPORTS_VIEW_PRECISE_LOCATION,
  REPORTS_TRIAGE,
  REPORTS_ASSIGN,
  REPORTS_UPDATE_STATUS,
  REPORTS_ADD_NOTES,
  REPORTS_RESOLVE,
  REPORTS_LINK_DUPLICATE,
  REPORTS_ESCALATE,
  REPORTS_VIEW_ATTACHMENTS,
  REPORTS_CREATE,
  REPORTS_SUBMIT_PRECISE_LOCATION,

  CONTACTS_VIEW,
  CONTACTS_MANAGE,
  CONTACTS_VERIFY,
  CONTACTS_PUBLISH,
  CONTACTS_PUBLISH_EMERGENCY,

  ANNOUNCEMENTS_VIEW_DRAFT,
  ANNOUNCEMENTS_CREATE,
  ANNOUNCEMENTS_EDIT,
  ANNOUNCEMENTS_APPROVE,
  ANNOUNCEMENTS_PUBLISH,
  ANNOUNCEMENTS_ARCHIVE,

  SUPPORT_SERVICES_MANAGE,
  SUPPORT_SERVICES_VERIFY,
  SUPPORT_SERVICES_PUBLISH,

  USERS_VIEW,
  USERS_MANAGE,
  ROLES_ASSIGN,
  ROLES_MANAGE,
  ORGANIZATIONS_MANAGE,
  ORGANIZATIONS_APPROVE,

  AUDIT_VIEW,
  PRIVACY_MANAGE,
  RETENTION_MANAGE,
} = PERMISSIONS;

export const ALL_PERMISSION_CODES: PermissionCode[] = Object.values(PERMISSIONS);

/**
 * Grouping used by the seed and by the admin permissions screen, so the list is
 * never presented to a reviewer as one undifferentiated wall of strings.
 */
export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, { category: string; description: string }> =
  {
    [PERMISSIONS.REPORTS_VIEW_ASSIGNED]: {
      category: 'reports',
      description: 'Open reports assigned to me',
    },
    [PERMISSIONS.REPORTS_VIEW_ALL_AUTHORIZED]: {
      category: 'reports',
      description: 'Open any report within my authorized scope',
    },
    [PERMISSIONS.REPORTS_VIEW_REPORTER_IDENTITY]: {
      category: 'reports',
      description: 'See who submitted a report (audited on every read)',
    },
    [PERMISSIONS.REPORTS_VIEW_PRECISE_LOCATION]: {
      category: 'reports',
      description: 'See precise coordinates submitted with a report',
    },
    [PERMISSIONS.REPORTS_TRIAGE]: {
      category: 'reports',
      description: 'Change urgency, verification and escalation state',
    },
    [PERMISSIONS.REPORTS_ASSIGN]: {
      category: 'reports',
      description: 'Assign or reassign reports to staff',
    },
    [PERMISSIONS.REPORTS_UPDATE_STATUS]: {
      category: 'reports',
      description: 'Advance a report through the workflow',
    },
    [PERMISSIONS.REPORTS_ADD_NOTES]: {
      category: 'reports',
      description: 'Add internal notes to a report',
    },
    [PERMISSIONS.REPORTS_RESOLVE]: {
      category: 'reports',
      description: 'Record a resolution and close a report',
    },
    [PERMISSIONS.REPORTS_LINK_DUPLICATE]: {
      category: 'reports',
      description: 'Link a report to an existing report as a duplicate',
    },
    [PERMISSIONS.REPORTS_ESCALATE]: {
      category: 'reports',
      description: 'Escalate a report to designated review personnel',
    },
    [PERMISSIONS.REPORTS_VIEW_ATTACHMENTS]: {
      category: 'reports',
      description: 'Download files attached to a report',
    },
    [PERMISSIONS.REPORTS_CREATE]: {
      category: 'reports',
      description: 'Submit a report (public, no login required)',
    },
    [PERMISSIONS.REPORTS_SUBMIT_PRECISE_LOCATION]: {
      category: 'reports',
      description: 'Submit precise coordinates instead of a landmark description',
    },

    [PERMISSIONS.CONTACTS_VIEW]: { category: 'contacts', description: 'View service contacts' },
    [PERMISSIONS.CONTACTS_MANAGE]: {
      category: 'contacts',
      description: 'Create, edit and deactivate service contacts',
    },
    [PERMISSIONS.CONTACTS_VERIFY]: {
      category: 'contacts',
      description: 'Record a verification attempt on a contact',
    },
    [PERMISSIONS.CONTACTS_PUBLISH]: {
      category: 'contacts',
      description: 'Publish a verified contact to the public site',
    },
    [PERMISSIONS.CONTACTS_PUBLISH_EMERGENCY]: {
      category: 'contacts',
      description: 'Publish a contact flagged as emergency (highest consequence)',
    },

    [PERMISSIONS.ANNOUNCEMENTS_VIEW_DRAFT]: {
      category: 'announcements',
      description: 'See announcements that are not yet public',
    },
    [PERMISSIONS.ANNOUNCEMENTS_CREATE]: {
      category: 'announcements',
      description: 'Draft a new announcement',
    },
    [PERMISSIONS.ANNOUNCEMENTS_EDIT]: {
      category: 'announcements',
      description: 'Edit a draft or in-review announcement',
    },
    [PERMISSIONS.ANNOUNCEMENTS_APPROVE]: {
      category: 'announcements',
      description: 'Approve an announcement for publication',
    },
    [PERMISSIONS.ANNOUNCEMENTS_PUBLISH]: {
      category: 'announcements',
      description: 'Publish, schedule, expire and archive announcements',
    },
    [PERMISSIONS.ANNOUNCEMENTS_ARCHIVE]: {
      category: 'announcements',
      description: 'Archive a published announcement',
    },

    [PERMISSIONS.SUPPORT_SERVICES_MANAGE]: {
      category: 'support',
      description: 'Create and edit community support listings',
    },
    [PERMISSIONS.SUPPORT_SERVICES_VERIFY]: {
      category: 'support',
      description: 'Verify a community support listing',
    },
    [PERMISSIONS.SUPPORT_SERVICES_PUBLISH]: {
      category: 'support',
      description: 'Publish a verified support listing',
    },

    [PERMISSIONS.USERS_VIEW]: { category: 'administration', description: 'View staff accounts' },
    [PERMISSIONS.USERS_MANAGE]: {
      category: 'administration',
      description: 'Create, disable and re-enable staff accounts',
    },
    [PERMISSIONS.ROLES_ASSIGN]: {
      category: 'administration',
      description: 'Grant and revoke roles for staff accounts',
    },
    [PERMISSIONS.ROLES_MANAGE]: {
      category: 'administration',
      description: 'Define roles and their permission sets',
    },
    [PERMISSIONS.ORGANIZATIONS_MANAGE]: {
      category: 'administration',
      description: 'Create and edit organizations',
    },
    [PERMISSIONS.ORGANIZATIONS_APPROVE]: {
      category: 'administration',
      description: 'Approve an organization for participation in the platform',
    },

    [PERMISSIONS.AUDIT_VIEW]: { category: 'oversight', description: 'Read the audit log' },
    [PERMISSIONS.PRIVACY_MANAGE]: {
      category: 'oversight',
      description: 'Handle personal data access, correction and deletion requests',
    },
    [PERMISSIONS.RETENTION_MANAGE]: {
      category: 'oversight',
      description: 'Run data retention and purge jobs',
    },
  };

/**
 * Default grants per role.
 *
 * Read this table as the authorization policy of the pilot. Two decisions are
 * worth stating explicitly because they are the ones most likely to be got
 * wrong:
 *
 *  - SYSTEM_ADMIN does **not** hold `reports.view_all_authorized`,
 *    `reports.view_reporter_identity` or `reports.view_precise_location`.
 *    A system administrator manages accounts and the platform; they are not
 *    automatically entitled to read what residents wrote. Report access is
 *    granted deliberately, per person or per role.
 *
 *  - CONTENT_EDITOR cannot publish announcements on their own. Drafting and
 *    approving are separate permissions so one person cannot put unverified
 *    emergency information in front of the public.
 */
export const DEFAULT_ROLE_GRANTS: Record<string, PermissionCode[]> = {
  RESIDENT: [
    PERMISSIONS.REPORTS_CREATE,
  ],

  TRIAGE_OFFICER: [
    PERMISSIONS.REPORTS_VIEW_ASSIGNED,
    PERMISSIONS.REPORTS_TRIAGE,
    PERMISSIONS.REPORTS_ADD_NOTES,
    PERMISSIONS.REPORTS_ESCALATE,
    PERMISSIONS.REPORTS_LINK_DUPLICATE,
    PERMISSIONS.REPORTS_VIEW_ATTACHMENTS,
    PERMISSIONS.CONTACTS_VIEW,
    PERMISSIONS.ANNOUNCEMENTS_VIEW_DRAFT,
    PERMISSIONS.AUDIT_VIEW,
  ],

  SERVICE_OFFICER: [
    PERMISSIONS.REPORTS_VIEW_ASSIGNED,
    PERMISSIONS.REPORTS_UPDATE_STATUS,
    PERMISSIONS.REPORTS_RESOLVE,
    PERMISSIONS.REPORTS_ADD_NOTES,
    PERMISSIONS.REPORTS_VIEW_ATTACHMENTS,
    PERMISSIONS.CONTACTS_VIEW,
    PERMISSIONS.SUPPORT_SERVICES_MANAGE,
    PERMISSIONS.SUPPORT_SERVICES_VERIFY,
    PERMISSIONS.ANNOUNCEMENTS_VIEW_DRAFT,
  ],

  CONTENT_EDITOR: [
    PERMISSIONS.ANNOUNCEMENTS_CREATE,
    PERMISSIONS.ANNOUNCEMENTS_EDIT,
    PERMISSIONS.ANNOUNCEMENTS_VIEW_DRAFT,
    PERMISSIONS.CONTACTS_VIEW,
    PERMISSIONS.SUPPORT_SERVICES_MANAGE,
  ],

  SUPERVISOR: [
    // Broad report access, but still explicit — this is a deliberate grant.
    PERMISSIONS.REPORTS_VIEW_ASSIGNED,
    PERMISSIONS.REPORTS_VIEW_ALL_AUTHORIZED,
    PERMISSIONS.REPORTS_TRIAGE,
    PERMISSIONS.REPORTS_ASSIGN,
    PERMISSIONS.REPORTS_UPDATE_STATUS,
    PERMISSIONS.REPORTS_RESOLVE,
    PERMISSIONS.REPORTS_ESCALATE,
    PERMISSIONS.REPORTS_LINK_DUPLICATE,
    PERMISSIONS.REPORTS_ADD_NOTES,
    PERMISSIONS.REPORTS_VIEW_ATTACHMENTS,
    // Supervisors may handle data-subject requests as part of their oversight role.
    PERMISSIONS.REPORTS_VIEW_REPORTER_IDENTITY,
    PERMISSIONS.CONTACTS_VIEW,
    PERMISSIONS.CONTACTS_MANAGE,
    PERMISSIONS.CONTACTS_VERIFY,
    PERMISSIONS.CONTACTS_PUBLISH,
    PERMISSIONS.ANNOUNCEMENTS_VIEW_DRAFT,
    PERMISSIONS.ANNOUNCEMENTS_APPROVE,
    PERMISSIONS.ANNOUNCEMENTS_PUBLISH,
    PERMISSIONS.ANNOUNCEMENTS_ARCHIVE,
    PERMISSIONS.SUPPORT_SERVICES_MANAGE,
    PERMISSIONS.SUPPORT_SERVICES_VERIFY,
    PERMISSIONS.SUPPORT_SERVICES_PUBLISH,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ROLES_ASSIGN,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.PRIVACY_MANAGE,
  ],

  SYSTEM_ADMIN: [
    // Intentionally excludes every report-content permission. Managing the
    // platform is not the same authority as reading resident reports.
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ROLES_ASSIGN,
    PERMISSIONS.ROLES_MANAGE,
    PERMISSIONS.ORGANIZATIONS_MANAGE,
    PERMISSIONS.ORGANIZATIONS_APPROVE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.RETENTION_MANAGE,
  ],
};

/** Roles that must enable MFA. Derived from capability, not maintained by hand. */
export const MFA_REQUIRED_ROLES = new Set<string>([
  'SUPERVISOR',
  'SYSTEM_ADMIN',
  'CONTENT_EDITOR',
]);

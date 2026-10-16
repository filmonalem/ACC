# ACC — Database Design

PostgreSQL 16+ · Prisma 7 (`prisma-client` generator, driver adapter)
Last reviewed 2026-10-14

---

## 1. Principles

1. **Privacy by separation.** A report's narrative metadata and its reporter's
   identity live in different tables, joined by a surrogate key. Reading a
   report list never touches resident identity. Precise coordinates live in a
   third table with its own permission.
2. **Separate axes, never a composite status.** Workflow status, urgency,
   verification, assignment, resolution and escalation are independent fields.
   Collapsing them is how systems end up treating "loud" as "true".
3. **Append-only history.** Every state change writes a history row and an audit
   row in the same transaction as the change itself.
4. **Least data.** No national ID, no demographics, no date of birth. Precise
   location is off by default and requires an explicit permission to collect
   and a separate one to read.
5. **Soft delete only where history matters.** Reports, contacts, announcements
   and users are soft-deleted and then hard-purged by the retention job.
   Ephemeral rows (sessions, idempotency keys, consumed tokens) cascade.

## 2. Entity relationships

```
Organization ─┬─ OrganizationMembership ─── User
              │                               │
              │                               ├─ UserRole ─── Role ─── RolePermission ─── Permission
              │                               └─ RefreshToken
              │
              ├─ ServiceContact ─── ContactVerification
              ├─ SupportService
              └─ Announcement ─── AnnouncementTranslation

Report ── ReportCategory
   ├── ReportReporterIdentity      (PII — separately permissioned)
   ├── ReportLocation              (location — separate from narrative)
   ├── ReportAssignment ────────── User (assignee)
   ├── ReportStatusHistory         (append-only)
   ├── ReportNote                  (internal only)
   ├── ReportAttachment            (objectKey, never a path)
   ├── ConsentRecord
   └── Report (self-ref duplicateOfReportId)

User ── AuditLog        PrivacyRequest ── User
```

## 3. Enumerations

| Enum | Values | Note |
| --- | --- | --- |
| `RoleKey` | `RESIDENT`, `TRIAGE_OFFICER`, `SERVICE_OFFICER`, `CONTENT_EDITOR`, `SUPERVISOR`, `SYSTEM_ADMIN` | mirrors the six roles in the spec |
| `UserStatus` | `PENDING_INVITE`, `ACTIVE`, `DISABLED`, `LOCKED` | account disabling is explicit, not a boolean |
| `ReportStatus` | `SUBMITTED`, `UNDER_REVIEW`, `VERIFIED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `REJECTED`, `DUPLICATE` | workflow axis |
| `Urgency` | `LOW`, `NORMAL`, `HIGH`, `CRITICAL` | **not** a truth signal |
| `VerificationStatus` | `UNVERIFIED`, `VERIFIED`, `DISPUTED`, `REJECTED` | truth axis |
| `EscalationState` | `NONE`, `REVIEW_PENDING`, `ESCALATED_INTERNAL`, `ESCALATION_CLOSED` | never implies external dispatch |
| `ReportVisibility` | — | not modelled: staff notes are always internal, resident notes never stored |
| `LocationPrecision` | `KEBELE`, `WOREDA`, `SUB_CITY`, `LANDMARK_DESCRIPTION`, `PRECISE` | |
| `AttachmentScanStatus` | `PENDING`, `CLEAN`, `INFECTED`, `ERROR`, `SKIPPED_DEV` | |
| `ContactStatus` | `DRAFT`, `VERIFIED`, `SUSPENDED`, `EXPIRED` | only `VERIFIED` is publishable |
| `ContactVerificationOutcome` | `CONFIRMED`, `UNREACHABLE`, `INCORRECT`, `EXPIRED` | |
| `VerificationMethod` | `PHONE_CALL`, `SMS`, `EMAIL`, `OFFICIAL_LETTER`, `SITE_VISIT`, `IN_PERSON_CONFIRMATION` | |
| `AnnouncementStatus` | `DRAFT`, `IN_REVIEW`, `APPROVED`, `SCHEDULED`, `PUBLISHED`, `EXPIRED`, `ARCHIVED` | |
| `AnnouncementCategory` | `PUBLIC_SAFETY`, `SERVICE_NOTICE`, `HEALTH_ADVISORY`, `INFRASTRUCTURE`, `COMMUNITY`, `OTHER` | |
| `SupportServiceCategory` | `COMMUNITY_ASSISTANCE`, `HEALTH`, `SOCIAL_SUPPORT`, `DISABILITY_SUPPORT`, `PUBLIC_INFORMATION` | |
| `ServiceVerificationStatus` | `PENDING`, `VERIFIED`, `EXPIRED`, `WITHDRAWN` | |
| `NotificationChannel` | `SMS`, `EMAIL`, `IN_APP` | |
| `NotificationStatus` | `QUEUED`, `SENT`, `FAILED`, `CANCELLED` | outbox pattern |
| `ConsentType` | `PERSONAL_DATA_PROCESSING`, `CONTACT_ATTEMPTS`, `RETENTION_EXTENSION`, `MARKETING` | |
| `PrivacyRequestType` | `ACCESS`, `CORRECTION`, `DELETION`, `OBJECTION`, `RESTRICTION` | |
| `PrivacyRequestStatus` | `RECEIVED`, `IDENTITY_VERIFIED`, `IN_PROGRESS`, `FULFILLED`, `REJECTED` | |
| `AuditOutcome` | `SUCCESS`, `DENIED`, `FAILURE` | denials are audited too |

## 4. Key tables

### 4.1 `Report`

The aggregate root for a resident submission.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `referenceCode` | `varchar(24)` **unique** | `ACC-7F3K9Q2M` style; public, non-sequential |
| `statusTokenHash` | `char(64)` **unique** | SHA-256 of the resident's lookup token; status checks require *both* reference and token, so codes cannot be enumerated |
| `categoryId` | `uuid` FK | |
| `description` | `text` | length-bounded in the DTO, never logged |
| `language` | `varchar(5)` | resident's preferred language for follow-up |
| `status` | `ReportStatus` | workflow axis |
| `urgency` | `Urgency` | separate from status |
| `verificationStatus` | `VerificationStatus` | separate from urgency |
| `escalationState` | `EscalationState` | |
| `isAnonymous` | `boolean` | see caveat below |
| `reporterConsentGiven` | `boolean` | |
| `incidentOccurredAt` | `timestamptz?` | |
| `incidentTimePrecision` | `IncidentTimePrecision` | `EXACT`, `DATE_ONLY`, `APPROXIMATE`, `UNKNOWN` |
| `firstReviewedAt` | `timestamptz?` | powers "average time to first review" |
| `duplicateOfReportId` | `uuid?` self FK | |
| `resolutionNote` / `resolvedAt` / `closedAt` / `rejectionReason` | | |

**Indexes** (every column here is a real dashboard filter):

```
(referenceCode) unique
(statusTokenHash) unique
(status, submittedAt DESC)
(categoryId, status)
(urgency, status)
(verificationStatus, status)
(submittedAt DESC)
(duplicateOfReportId)
```

### 4.2 `ReportReporterIdentity` (PII island)

`reportId` unique · `isAnonymous` · `fullName?` · `phone?` · `email?` ·
`preferredContactMethod?` · `createdAt`

Reading this table requires `reports.view_reporter_identity` and every read is
written to `AuditLog`. When a resident reports anonymously the identity columns
are simply `NULL` — **no placeholder values, no masked-but-reversible strings.**
The schema and the API both state that anonymity is *pseudonymous at best*:
access logs, IP-derived request metadata, and attachment EXIF can still
identify a submitter. The anonymous option is disabled by default behind
`ALLOW_ANONYMOUS_REPORTS`, because the operating organization has not yet
approved it.

### 4.3 `ReportLocation` (location island)

`reportId` unique · `precision` · `kebeleName?` · `woredaName?` · `subCity?` ·
`landmarkDescription?` · `latitude Decimal(9,6)?` · `longitude Decimal(9,6)?`

Coordinates are nullable and are only accepted when the caller holds
`reports.submit_precise_location`. Reads of a `PRECISE` row require
`reports.view_precise_location`. `Decimal`, never `Float`.

### 4.4 `ReportStatusHistory` (append-only)

`reportId` · `fromStatus` · `toStatus` · `urgencyBefore/After` ·
`verificationBefore/After` · `escalationBefore/After` · `changedById?` ·
`changedByName` (denormalised snapshot so the trail survives account deletion)
· `reason?` · `requestId?` · `createdAt`

Rows are inserted in the same transaction as the report update. No update or
delete path exists for this table.

### 4.5 `ServiceContact` and the verification ledger

`ServiceContact` holds the current published state: `status`,
`verifiedAt`, `verificationExpiresAt`, `verificationCycleDays`,
`nextReviewDueAt`, `isPublished`.

`ContactVerification` is the immutable ledger of every verification attempt,
including failures:

`contactId` · `outcome` · `method` · `verifiedById` · `verifiedAt` ·
`evidenceNote?` · `expiresAt?` · `revokedAt?` · `revokedById?` ·
`revocationReason?`

**Publication rule (enforced in the service, tested):** a contact can only be
published when `status = VERIFIED` and `verificationExpiresAt > now()`. An
expired contact is de-published by the retention job and flagged for
re-verification. `isEmergency` contacts additionally require
`contacts.publish_emergency`.

Phone numbers are stored as entered plus a normalised E.164 form. Seed data uses
Ethiopia's **+251 900 000 000** reserved-looking fiction range and every seeded
row is flagged `isFictionalDemo = true`, which the API surfaces as an
`DEMO` badge and the public UI renders as a visible "Sample data — not a real
service" banner. No real emergency number is ever seeded.

### 4.6 `Announcement` workflow

`status` moves `DRAFT → IN_REVIEW → APPROVED → (SCHEDULED) → PUBLISHED → EXPIRED/ARCHIVED`.
`approvedById` + `approvedAt` are non-null for anything past `IN_REVIEW`;
`publishedAt` is set by a dedicated `publish` endpoint, never by an update.
`AnnouncementTranslation` is `(announcementId, locale)` unique, with
`title`/`summary`/`body`. `en` is required to publish; missing `am`/`ti` falls
back to `en` **with a visible "translation pending" notice**, because silently
serving English emergency guidance to a Tigrinya speaker is worse than saying so.

### 4.7 `AuditLog` (append-only, no ORM mutation path)

`occurredAt` · `actorUserId?` · `actorEmail?` · `actorRoles String[]` ·
`organizationId?` · `action` · `entityType` · `entityId` · `outcome` ·
`metadata Json` (redacted) · `requestId` · `ipAddress` · `userAgent`

Indexed on `(occurredAt DESC)`, `(actorUserId, occurredAt DESC)`,
`(entityType, entityId)`. `AuditLog` has no `update`/`delete` in any service,
and the retention job cannot touch it — audit rows are purged only by a
privileged, separately audited maintenance task.

### 4.8 `ConsentRecord` and `PrivacyRequest`

`ConsentRecord` links a consent decision to the exact policy version that was
shown (`policyVersion`), which is what makes the consent defensible later.
`ipHash` is a salted hash, not a raw address.

`PrivacyRequest` implements the Ethiopian Personal Data Protection Proclamation
No. 1321/2024 access/correction/erasure pathways, with
`dueAt` (default 30 days, configurable) and a mandatory `resolutionNote`.

## 5. Referential integrity

| Relationship | Rule | Reason |
| --- | --- | --- |
| `Report.categoryId` | `Restrict` | historical reports must keep their category |
| `Report.duplicateOfReportId` | `SetNull` | deleting the canonical report must not delete the duplicate's audit trail |
| `Report*` → `User` | `SetNull` | history must outlive an account |
| `OrganizationMembership` → `User`/`Organization` | `Cascade` | no audit value in the link alone; decisions are in `AuditLog` |
| `RefreshToken`, `IdempotencyKey` | `Cascade` | ephemeral |
| `ReportAttachment` → `Report` | `Cascade` on report hard-purge only | soft-delete first, purge later |
| `Role`, `Permission` | `Restrict` | seeded reference data is never deleted |

## 6. Soft deletion

`deletedAt timestamptz?` on `Report`, `ServiceContact`, `SupportService`,
`Announcement`, `User`, `ReportNote`. All unique constraints are written to be
**partially indexable by status**, and lookups always filter
`deletedAt: null` via the service layer rather than relying on the ORM to do
it implicitly — an explicit predicate is auditable.

## 7. Retention (enforced by `npm run retention:apply`, template in
the retention policy deliverable listed in `docs/03-milestones.md`, M11)

| Data | Default | Basis |
| --- | --- | --- |
| Closed reports, no legal hold | 24 months after `closedAt` | deletion request is the faster path for residents |
| Rejected reports | 12 months | high risk of harming a resident by retaining them |
| Reporter identity on closed reports | purged with the report, or 90 days after `closedAt` | data minimisation |
| Attachments | purged with their report | blobs are the largest personal data we hold |
| Status history / audit log | 5 years | accountability |
| Idempotency keys / refresh tokens | 30 days / session lifetime | ephemeral |

Legal holds (`PrivacyRequest` of type `RESTRICTION`) pin rows and are checked
before every purge.

## 8. Migrations and seeding

- `prisma/migrations/` is committed. `migrate dev` for local iteration,
  `migrate deploy` for pilot and CI. Never `db push` outside a scratch database.
- `prisma/seed.ts` creates permissions, the six roles, demo staff accounts,
  report categories with `ti`/`am`/`en` labels, and a small set of
  **clearly fictional** contacts, announcements and reports.
- Seed accounts print their passwords to the console and every seeded row is
  flagged as demo data. Seed emails are `@acc.invalid` (RFC 2606 reserved TLD),
  so a mistyped credential can never reach a real mailbox.

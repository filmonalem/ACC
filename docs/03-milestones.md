# ACC — Implementation Milestones

Each milestone is independently reviewable and testable. Milestones are not
"phases of a big bang"; each one ends with something you can run and click.

Legend: ✅ done and verified · 🟡 in progress · ⬜ not started

---

## Verification status

Status here means **verified by running it**, not "the code is written". The
distinction matters: this project was handed over mid-implementation with most
milestones marked complete, and the application had never compiled. What follows
is the state after actually building, booting and testing it.

Reproduce with:

```
cd backend
npm install
npm run typecheck          # 0 errors
npm run build              # succeeds
npm test                   # 91 unit tests
npm run test:integration   #  2 tests  (needs a test database)
npm run test:e2e           # 47 tests  (needs a test database)

cd ../frontend
npm install
npm run build              # succeeds
npm test                   # 34 dictionary/completeness tests
```

---

## M0 — Architecture & data design ✅
`docs/01-architecture.md`, `docs/02-database.md`, `prisma/schema.prisma`
(26 models, 2 migrations).

**Verified:** `prisma validate` passes; both migrations apply to an empty
database and `prisma migrate status` reports no pending work.

## M1 — Foundation ✅
Typed environment validation, structured logging with redaction, rate limiting,
helmet + explicit CORS, Swagger, health checks, error envelope.

**Verified:** the application boots, `GET /api/v1/health/ready` returns
`{"status":"ok","database":"ok","storage":"ok"}`, and a validation error returns
the standard envelope with a request id.

## M2 — AuthN & AuthZ ✅
Argon2id hashing, login, refresh rotation with reuse detection, httpOnly
`SameSite=Strict` cookies, CSRF double-submit, permission guards,
organization-scoped grants, lockout, MFA for privileged roles, recovery tokens.

**Verified:** end-to-end coverage of sign-in, CSRF (missing, forged and mismatched
tokens), scope narrowing, and privilege separation.

> **Fixed during this milestone.** MFA enrolment was unreachable: login refused
> any privileged account without MFA, while the enrolment endpoints required a
> session login would not issue. Login now mints a permission-less
> `enrolment`-scoped session that reaches only `/auth/mfa/*`. Two further defects
> were found and fixed in the same flow — the confirmation step verified the code
> against a *freshly generated* secret rather than the one displayed to the user,
> and `PrivacyService` was missing its `@Injectable()` decorator entirely.

## M3 — Vertical slice: resident report → staff review ✅
The first complete end-to-end slice, as the project brief asks.

- Public submission with a unique `referenceCode` and a hashed status token.
- Idempotent retry via the `Idempotency-Key` header.
- Secure status lookup requiring both reference code and token.
- Staff queue with scope-aware filtering, detail view, triage, assignment and
  status transitions recorded in a single database transaction.
- Audit trail for sensitive reads and for refusals.

**Verified:** `test/vertical-slice.e2e-spec.ts`, 42 tests, all passing.

> **Fixed during this milestone.** Four defects were found by the tests:
> the status lookup validated `referenceCode` as a *query* parameter although it
> is a *path* segment, so it could never succeed; the report list demanded two
> permissions where the guard requires all of them, locking out triage officers;
> the status route did the same, blocking a transition the lifecycle map allows;
> and permission refusals on report reads returned 403 without leaving any audit
> record, contradicting the stated design.

## M4 — Emergency contacts & verification 🟡
`ServiceContact` CRUD, verification ledger, publish guard requiring a live
`VERIFIED` state, searchable public directory, demo-data flag.

**Not yet verified.** The code and routes exist and the application boots, but
there is no test covering the publish guard, contact expiry, or re-verification.
Treat the publish-without-verification path as unproven until M11 closes.

## M5 — Announcements & approval 🟡
Draft → in review → approve → schedule → publish → expire/archive, with
separation of duties (an author cannot approve their own announcement).

**Not yet verified.** Routes and service exist; no test covers the approval
workflow or the separation-of-duties rule.

## M6 — Community support directory 🟡
`SupportService` listings with category, service area, eligibility, verification
status and expiry.

**Not yet verified.** No test coverage.

## M7 — Resident site ✅
`frontend/` exists: Next.js 15 (App Router, JavaScript), React 19, Tailwind 4,
React Hook Form + Zod. Pages: homepage, five-step report wizard, status lookup,
contact directory, public updates + article, community support, about, privacy
with a data-subject request form, 404, offline fallback, staff sign-in, staff
queue and staff report detail.

**Verified:** `npm run build` succeeds; all 11 routes return 200 in all three
locales (33 route/locale combinations). A report submitted through the exact
payload shape the wizard sends is accepted, and the reference code and private
token returned by the API are accepted by the status lookup.

> **The report form has no attachment field, deliberately.** A resident on a
> metered connection uploading a photo is the most likely way this form breaks.
> The pilot omits the field rather than shipping one that silently fails. This is
> recorded in the unfinished-integrations list.

## M8 — Internationalization ✅
`ti` / `am` / `en` throughout, with the locale as a **path segment** so a link
shared with a neighbour opens in their language rather than the sender's. A
middleware redirects bare paths to the remembered locale. Dictionaries live in
`src/lib/i18n/dictionaries/{en,ti,am}.js`.

**Verified:** 34 tests enforce that all three dictionaries hold *exactly* the
same key set, that no string is empty, that placeholders match their English
source, and that safety-critical wording exists in every language. Every page
was rendered in Amharic and confirmed to contain Ethiopic script throughout.

> **Two i18n defects were found and fixed during this milestone.** The
> `report-categories` endpoint hard-coded `'en'`, so Tigrinya and Amharic readers
> saw English category names. And the resident status explanation — the sentence
> that tells someone whether their report was received — was hard-coded English,
> while the status label beside it was translated. Both are now locale-aware,
> and the API returns `translationPending` so the interface can say "shown in
> English" rather than substituting silently.

## M9 — Offline & low-connectivity 🟡
A service worker is registered in production builds. It caches **only** the
application shell and an explicit allowlist of public GET routes; everything
under `/staff`, `/api` and `/status` is network-only, because a cached staff page
would be a cached resident's report on a shared phone.

**Deliberately not implemented: an offline submission outbox.** The service
worker does not retry `POST /reports`. A queued retry with a stale idempotency
key is a duplicate-report risk, and a queued retry that succeeds while the
interface still says "pending" is a lie. The form instead states plainly that
nothing was received and that the text is still in the form.

**Verified:** idempotent submission itself is covered by the end-to-end suite.

## M10 — Admin dashboard 🟡
Staff sign-in including the MFA enrolment journey, a filterable report queue, and
a report detail view with status transitions, internal notes and history.

**Not yet built:** assignment, triage, attachment review, announcement
authoring and approval, contact verification, and audit-log browsing. The API
surfaces for all of these exist; only the UI is missing.

> **The detail view renders a withheld reporter identity explicitly** rather than
> as an empty field. A blank reads as "no name was given", which is a different
> and wrong conclusion about a report.

## M11 — Testing & documentation 🟡
**Testing:** 140 automated tests pass — 91 unit, 2 integration, 47 end-to-end —
plus 34 frontend tests. Translation completeness is now covered. Still not
covered: attachment access, contact verification and expiry, announcement
approval and author≠approver, organization isolation across two organizations,
and retention jobs.

**Documentation:** `docs/01`–`docs/04` exist. The remaining deliverables named in
the brief — deployment and backup runbook, security checklist, data-retention
policy, pilot-readiness checklist and the unfinished-integrations list — are
**not written**.

## M12 — Pilot readiness ⬜ *(requires a human decision)*
Institutional gates: signed authorization, an agreed retention schedule, a named
data protection contact, verified service contacts, a telephone fallback
provider, and an incident-response rehearsal. Not started, and not something
engineering can complete alone.

## M13 — Android application ⬜ *(not started)*
The proposal describes a website **and** an Android application. The web app is
the right thing to build first. A native client needs its own milestone plan.

---

## Bugs found by actually running the code

Recorded because each one was invisible until the application was compiled,
booted and exercised — and each would have shipped.

| # | Defect | Consequence |
| --- | --- | --- |
| 1 | Three controllers ended mid-statement, with their class decorators orphaned at the end of the file | The application could not compile |
| 2 | Same truncation in two more controllers, plus `PrivacyService` missing `@Injectable()` | More compile failures; the privacy module could not have started |
| 3 | `@Injectable()` classes imported with `import type` | Nest received no constructor types: *"can't resolve dependencies of the AuditService (?)"* |
| 4 | Status lookup bound `referenceCode` to `@Query()` although it is a path segment | `forbidNonWhitelisted` rejected every lookup; the resident-facing feature could never work |
| 5 | Report list and status routes passed two permissions to a guard that requires **all** of them | Triage officers locked out of legitimate work |
| 6 | `ThrottlerGuard` applies *every* configured throttler to *every* route | The 5-per-10-min submission limit was throttling the entire site, including health checks |
| 7 | MFA enrolment was unreachable (login refused, enrolment needed a session) | No supervisor or administrator could ever sign in |
| 8 | MFA confirmation verified the code against a newly generated secret | Enrolment could not complete even once reachable |
| 9 | Permission refusals on report reads were not audited | Contradicted the documented audit guarantee |
| 10 | `GET /report-categories` hard-coded `'en'`, ignoring the requested locale | Tigrinya and Amharic readers saw English category names inside an otherwise translated form |
| 11 | The resident status explanation was hard-coded English while the status label beside it was translated | Someone checking their own report saw a translated status and an English sentence explaining it — the one place a resident must be able to read the answer |
| 12 | `localise` used `map[locale] ?? map.en` on a plain object, in three separate copies | `?locale=constructor` resolved to an inherited `Object.prototype` member and would have been serialised into a public JSON response as a label |
| 13 | Next.js ISR cached a transient API outage for the full revalidation window on the report form | Every visitor in that window saw an error page instead of the report form |
| 14 | The Tigrinya dictionary had drifted: `report.stepReviewHelp` and `updates.categoryTranslationPending` where the code reads `report.reviewHelp` and `updates.translationPending` | A Tigrinya speaker saw `undefined` on the report review step and on the "shown in English only" notice |
| 15 | The e2e suite took its `DATABASE_URL` from `.env` and truncated `Report`, `ReportAttachment`, `Notification`, `ConsentRecord` and `AuditLog` with no check on the database name | `npm run test:e2e` emptied the development database — 4 reports and 16 audit rows — and still exited green |
| 16 | The rate-limit integration suite did not load `dotenv`, fell back to a credential-less URL, and asserted only that a 429 eventually appeared | Every submission 500'd on SCRAM auth and the suite passed: a throttle counts attempts, so it cannot tell a 201 from a 500 |

Defects 6–9 were found by writing the tests, not by reading the code. Defects
1–3 mean the application had never been started before this point. Defects
10–13 were found by rendering the frontend against the running API and inspecting
what actually came back — none of them is visible from reading either side alone,
because the frontend and the API were each individually reasonable.

Defect 13 is worth dwelling on: the frontend asked for categories with a
ten-minute cache and the backend was briefly down at that moment. The cached
*failure* was then served to everyone for ten minutes. The report form is now
`force-dynamic` and fetches with `cache: 'no-store'`, on the grounds that a
resident filling in a report is the person least able to afford a stale error.

Defects 15 and 16 share one root cause, and it is the one worth generalising:
**a green suite is not evidence unless the suite can fail.** Defect 15 deleted
real rows and reported success. Defect 16 ran against a database it could not
connect to and reported success. Both are silent, both were invisible to
review, and neither would have been caught by reading the code — only by
running the command and checking what it actually did to the database. The
fixes are a refusal rather than a convention (`assertDisposableDatabase` stops
a truncating suite from starting) and an assertion that a submission returns
`201` before the suite is allowed to claim the throttle works.

---

## Recommended next steps

1. **Close the untested backend paths in M4–M6** — the publish guard and contact
   expiry are the ones with real-world consequences: a number that should no
   longer be shown, and content that should not be public.
2. **Finish the staff dashboard** (M10): assignment, triage, announcement
   approval and audit browsing. The APIs exist; only the UI is missing.
3. **Write the missing documentation deliverables** (M11) — deployment and backup
   runbook, security checklist, retention policy, pilot-readiness checklist and
   the unfinished-integrations list. A pilot cannot be approved without them
   regardless of code.
4. **Get the translations reviewed.** The Tigrinya and Amharic strings throughout
   are drafts written by the developer. They are internally consistent and
   machine-checked for completeness, but completeness is not accuracy, and a
   wrong instruction about who to telephone is worse than an English one.
5. M12 needs institutional decisions, not engineering time.
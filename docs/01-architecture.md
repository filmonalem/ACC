# ACC — System Architecture

**Adigrat Community Connect** · Connected Communities. Safer Neighbourhoods.
Version 0.1 (pilot design) · Last reviewed 2026-10-14

> ACC is a **proposed** civic technology initiative. Nothing in this repository
> implies government ownership, official approval, or a live connection to
> emergency dispatch. See the pilot-readiness section of
> `docs/03-milestones.md` (M12).

---

## 1. Design goals

| Goal | How the architecture serves it |
| --- | --- |
| Safety over convenience | Report content is private by default. Nothing submitted is publicly readable. Every privileged read is permission-checked and audited. |
| Low connectivity | Lean bundles, no heavy runtime, cached public content with visible last-updated stamps, idempotent submission. |
| Multilingual | Locale is a first-class URL segment; dictionaries are split per language so only one is shipped per page. |
| Honest about limits | Urgency never implies truth. Verification is a separate field. No auto-notification of police. |
| Independently maintainable | `backend/` and `frontend/` share no build, no lockfile, and no runtime coupling beyond the REST contract. |
| Replaceable infrastructure | Storage, SMS, and email sit behind provider interfaces so a pilot on a laptop can graduate to production without rewrites. |

## 2. Non-goals for v0.1

- Native Android application (the proposal mentions one; the web app is built
  installable/PWA-ready first — see `docs/03-milestones.md`, M13).
- Any automated dispatch or integration with police/ambulance systems.
- Machine-translated emergency instructions. Critical strings are human-reviewed
  or absent.
- Real-time presence or availability tracking of services.

## 3. System context

```
                        ┌──────────────────────────────────────────┐
   Resident             │            Next.js (frontend)           │
   (phone / desktop) ───┤  Public site  ·  Report wizard  ·  Staff  │
                        │  dashboard  ·  ti / am / en  ·  PWA      │
                        └───────────────────┬──────────────────────┘
                                            │ HTTPS, /api/v1
                                            │ cookies + CSRF header
                                            ▼
                        ┌──────────────────────────────────────────┐
                        │            NestJS (backend)              │
                        │  Auth · RBAC · Reports · Contacts ·      │
                        │  Announcements · Support · Audit ·       │
                        │  Storage · Notifications · Privacy       │
                        └────┬─────────────┬──────────────┬────────┘
                             │             │              │
                    ┌────────▼───┐   ┌─────▼──────┐  ┌────▼─────────┐
                    │ PostgreSQL │   │ Private    │  │ SMS / Email  │
                    │            │   │ volume     │  │ (interfaces, │
                    │            │   │ (S3-ready) │  │  not wired)  │
                    └────────────┘   └────────────┘  └──────────────┘
```

The frontend never talks to the database. The only coupling point is the
OpenAPI document served at `/api/v1/docs`.

## 4. Repository layout

The brief calls for two independently maintainable applications. **Only the
backend exists today** — see `03-milestones.md` before assuming otherwise.

```
ACC/
├── .gitignore
├── docs/
│   ├── 01-architecture.md         # this file
│   ├── 02-database.md             # data model & rationale
│   └── 03-milestones.md           # verified status, open work, known defects
│
├── backend/                       # NestJS + TypeScript + Prisma
│   ├── prisma/
│   │   ├── schema.prisma          # 26 models
│   │   ├── migrations/
│   │   └── seed.ts                # fictional demo data, refused in production
│   ├── src/
│   │   ├── main.ts                # bootstrap: helmet, CORS, pipes, swagger
│   │   ├── app.module.ts          # guard order, global throttler
│   │   ├── config/
│   │   │   ├── env.schema.ts      # every variable, validated at startup
│   │   │   ├── parse-env.ts       # one parse shared by three call sites
│   │   │   ├── rate-limits.ts     # per-route limits
│   │   │   └── config.module.ts   # the 'ACC_ENV' provider
│   │   ├── database/              # PrismaService (pg driver adapter)
│   │   ├── common/                # cross-cutting, no business logic
│   │   │   ├── authorization/     # policy.ts + report-lifecycle.ts (pure)
│   │   │   ├── decorators/        # @Public, @RequirePermissions, @CurrentUser
│   │   │   ├── guards/            # JwtAuth, Csrf, Permissions
│   │   │   ├── filters/           # AllExceptionsFilter — one error shape
│   │   │   ├── interceptors/      # request id + redacted logging
│   │   │   ├── logger/            # structured logger and redaction
│   │   │   ├── services/          # crypto, password
│   │   │   ├── storage/           # private attachment volume
│   │   │   ├── audit/             # the only writer of AuditLog
│   │   │   ├── dto/               # pagination and query DTOs
│   │   │   └── errors/            # domain error types
│   │   └── modules/
│   │       ├── auth/              # login, refresh, MFA, recovery
│   │       ├── reports/           # submission, lifecycle, staff queue
│   │       ├── report-categories/
│   │       ├── attachments/
│   │       ├── contacts/
│   │       ├── announcements/
│   │       ├── support-services/
│   │       ├── users/             # staff accounts and organization approval
│   │       ├── privacy/
│   │       ├── notifications/
│   │       ├── audit/
│   │       └── health/
│   ├── test/                      # shared helpers + e2e + integration suites
│   ├── storage/                   # PRIVATE volume root — gitignored
│   ├── .env.example
│   └── package.json
│
└── frontend/                      # ⬜ NOT STARTED
```

### Notes on the shape

- **Public and staff routes are separate controllers.** `PublicReportsController`
  and `AdminReportsController` are distinct classes, so it is obvious at a glance
  which endpoints are reachable without a session.
- **Authorization lives in pure functions.** `common/authorization/` holds the
  permission algebra and the report lifecycle as data with no I/O. That is what
  makes the security rules unit-testable without a database, and what lets the
  same code run in token issuance, in the guard, and in the list query.
- **One error shape.** Every failure passes through `AllExceptionsFilter`, so a
  controller cannot accidentally return a stack trace or a Prisma message.
- **Storage is a volume, not a folder in a web root.** `STORAGE_ROOT` is
  asserted absolute at startup and created `0o700`; nothing serves files from it
  except an authorized controller that re-checks permission on every request.


## 5. Backend module boundaries

| Module | Owns | May read | Never does |
| --- | --- | --- | --- |
| `auth` | credentials, tokens, MFA, recovery | `User`, `UserRole` | touches report content |
| `common/authorization` | role→permission algebra, report lifecycle (pure functions) | nothing — no I/O at all | anything requiring a database |
| `users` | staff accounts, organization approval | `User`, `UserRole`, `Organization` | reads report content |
| `reports` | report content, lifecycle, status history | own tables + `ReportCategory` | sends notifications directly (writes to outbox instead) |
| `attachments` | blob storage keys, malware-scan hook | `ReportAttachment` | serves bytes without a permission check |
| `contacts` | service contact records + verification ledger | own tables | publishes unverified records |
| `announcements` | editorial workflow | own tables | publishes without an approval record |
| `audit` | append-only log | all | ever mutates or deletes rows |

`audit` is deliberately write-only from every other module. That is what makes
the audit trail worth having.

## 6. Cross-cutting decisions

### 6.1 API surface
- All routes under `/api/v1`.
- Uniform envelope: success → the resource (or `{ data, meta }` for lists);
  failure → `{ error: { code, message, details?, requestId } }`.
- `requestId` (UUID) on every response and in every log line, so a resident can
  quote it during support without exposing anything sensitive.
- Pagination: `?page=1&pageSize=25`, capped at 100. Response carries
  `{ page, pageSize, total, totalPages }`.
- Swagger at `/api/v1/docs` (JSON at `/api/v1/docs-json`).

### 6.2 Error handling
A single `AllExceptionsFilter` maps domain errors to HTTP codes and **redacts**
messages before they leave the process. Unknown errors become a generic
message plus the request id; the detail goes to the log only.

### 6.3 Logging
Structured JSON via pino. A redaction pass strips `password`, `token`,
`authorization`, `cookie`, `phone`, `email`, `description`, `nationalId`,
`precise*`, and any `body` field on report routes before serialisation. Report
free text never reaches the log pipeline.

### 6.4 Rate limiting
`@nestjs/throttler`, per-route budgets:

| Route | Limit | Rationale |
| --- | --- | --- |
| `POST /api/v1/reports` | 5 / 10 min | highest abuse + cost surface |
| `GET /api/v1/reports/:ref/status` | 10 / 10 min | prevents reference enumeration |
| `POST /api/v1/auth/login` | 5 / 15 min + lockout | credential stuffing |
| all other `POST/PATCH/DELETE` | 60 / 5 min | general abuse ceiling |
| all `GET` | 300 / 5 min | low-bandwidth clients retry |

### 6.5 Request validation
Global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`,
`transform: true`). Unknown properties are rejected, not silently dropped, so
typos in a client payload surface immediately instead of vanishing.

### 6.6 Transactions
Every operation that writes more than one row runs in `prisma.$transaction`:
status change + history row, assignment change + history row, announcement
approval + publish timestamp, contact verification + expiry schedule. A
half-written transition is worse than no transition.

## 7. Frontend architecture

> ⬜ **Not started.** There is no `frontend/` directory. This section records the
> intended design so it is not rediscovered from scratch — and so nobody mistakes
> it for something that exists. See `03-milestones.md`, M7.

The resident-facing site is intended to be Next.js (JavaScript) with Tailwind,
React Hook Form and Zod, serving three locales.

### 7.1 Routing

Locale is a first-class path segment (`/ti/report`, `/am/contacts`), so a shared
link opens in the reader's language rather than in whatever the sender used, and
the server can render the correct `lang` attribute and fonts for the first paint.

### 7.2 Internationalization

- One resource file per locale, split per feature area.
- Loaded server-side per route segment and passed down through context. Only the
  active locale is serialised into the page — three locales in every payload
  would triple the bytes for low-bandwidth readers who use one.
- Zod validation messages resolve translation keys, so validation errors are
  translated rather than showing raw schema text.
- A completeness test asserts every `en` key exists in `am` and `ti`, and that no
  ICU placeholder is orphaned. A missing key fails CI rather than showing a raw
  key to a resident.
- Emergency strings are **never** machine translated. Where a human-reviewed
  translation is missing, the English string is shown and the gap is recorded.

### 7.3 Offline / low-bandwidth behaviour

- Public content is cached with a visible "last updated" timestamp. A cached
  number is only ever presented with the time it was fetched.
- Submissions are held in a local outbox with an `Idempotency-Key`. Queued items
  render as **"Pending sync"** — never as "submitted". The interface says
  *submitted* only after the server returns a reference code.
- The service worker caches public, non-personalised routes only. Private report
  and staff data is explicitly excluded and never written to the Cache Storage
  API.
- The telephone fallback number stays visible in the footer of every page,
  including error states — the web application being unavailable must not remove
  someone's only way to reach help.

### 7.4 Accessibility

Semantic landmarks, visible `:focus-visible` rings at ≥3:1 contrast, every
interactive element reachable by keyboard, dialogs with focus trap and `Esc`
handling, `lang` set per locale, and live regions for submission progress.
Colour is never the sole indicator of status: every status pill carries a text
label and an icon.

## 8. Trust boundaries

1. **Public internet → frontend.** TLS in any deployed environment. The
   frontend is untrusted; all authorization decisions are re-made server-side.
2. **Frontend → backend.** Staff session cookies are `HttpOnly`, `Secure` (in
   deployed environments), `SameSite=Strict`. Mutating staff requests carry a
   CSRF token. Resident report submission is unauthenticated by design and is
   rate-limited + validated instead.
3. **Backend → database.** Single application role in the pilot. Least-privilege
   split roles documented for production.
4. **Backend → storage volume.** Not mounted into the frontend container and
   not served by any static middleware. Bytes leave only through an authorized
   controller that re-checks permission on every request.

## 9. Observability

- Health: `/api/v1/health` (liveness, no dependencies) and
  `/api/v1/health/ready` (checks database + storage writability).
- Structured logs with `requestId`.
- No third-party analytics. No external telemetry leaves the deployment —
  important for a pilot handling sensitive community reports.

## 10. Deployment shapes

> ⚠️ **Docker Compose is not written yet.** The brief asks for it and it is a
> listed deliverable; this repository does not currently contain a
> `docker-compose.yml` or a `Dockerfile`. Treat the table below as the intended
> shape, not as something that exists. See `03-milestones.md`, M11.

| Environment | Frontend | Backend | Database | Storage |
| --- | --- | --- | --- | --- |
| Development | ⬜ not started | `nest start --watch` :4000 | native Postgres `acc_dev` | `./storage` |
| Pilot (intended) | Docker Compose behind a TLS-terminating proxy | same image | Postgres container | named volume |
| Production (not built) | standalone container | scaled behind a proxy | managed Postgres with backups | S3-compatible bucket |

Two constraints the shape is designed around:

- **The storage volume is mounted into the API container only.** Mounting it into
  the frontend container would put report attachments one misconfigured static
  route away from being public.
- **Pilot and production differ only in configuration values, never in code
  paths.** The environment schema refuses to start in production with
  `COOKIE_SECURE=false`, `SKIP_MALWARE_SCAN=true`, or a wildcard CORS origin, so
  a deployment cannot quietly take a development shortcut to production.

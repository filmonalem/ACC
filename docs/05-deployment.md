# ACC — Deployment and Operations Runbook

The other documents describe what the software *is*. This one describes what it
takes to put it in front of residents, and what to do when it breaks.

**Status: this runbook has not been executed against a real deployment.** It was
written from the code and from the behaviour observed while running it locally.
The parts marked **[UNVERIFIED]** have never been run outside a developer
machine, and treating this document as proof that a pilot would work is exactly
the mistake `docs/03-milestones.md` was written to prevent.

---

## 1. Topology

The frontend and the backend do **not** belong on the same host, and the backend
does not belong on a platform with an ephemeral filesystem.

```
  acc.example.com          Vercel                Next.js 15, App Router
        │
        │  same-origin /api/v1/*  ── rewrite proxy ──▶
        ▼
  api.example.com          Fly.io / Render / VPS  NestJS 11
                                 │
                                 ├── PostgreSQL 16 (managed or same host)
                                 └── STORAGE_ROOT on a PERSISTENT volume
```

Three constraints decide this shape. Each one is a hard blocker if ignored.

### 1.1 Attachments need a real disk

`StorageService` writes report attachments with `mkdir`/`writeFile` to
`STORAGE_ROOT` (default `./storage`), creating directories `0700` and files
`0600` (`src/common/storage/storage.service.ts`). Vercel Functions have an
ephemeral filesystem, so **the backend cannot run on Vercel** — every deploy and
every cold start would discard uploaded attachments, and `/health/ready` would
report `storage: unavailable` because it asserts the volume is writable.

`STORAGE_ROOT` must be a persistent, encrypted volume. It must not be inside any
web root, and the directory must be readable only by the service user.

### 1.2 The API must be one origin with the frontend

Session cookies are `SameSite=Strict` (`src/modules/auth/auth.controller.ts`)
and the CSRF cookie is readable only on the API's domain. SameSite is evaluated
against the **site** — the registrable domain — not the origin. So:

| Frontend | API | Staff sign-in |
| --- | --- | --- |
| `acc.vercel.app` | `api.myhost.com` | **Broken.** Cross-site: cookies are never attached. Fails silently and permanently. |
| `acc.vercel.app` | `acc.vercel.app` (Vercel) | Broken. Backend cannot run there — see 1.1. |
| `acc.example.com` | `api.example.com` | Works. One site. CORS still required. |
| `acc.example.com` | `/api/v1/*` rewrite → `api.example.com` | **Works, and is what this runbook assumes.** |

The rewrite lives in `frontend/next.config.mjs` and is only active when
`NEXT_PUBLIC_API_BASE_URL` is a relative path. See
`frontend/src/lib/api/base-url.js` for the full reasoning.

### 1.3 PostgreSQL must be reachable and pooled

The backend uses `PrismaPg` (`@prisma/adapter-pg`), a standard connection pool.
One host talking to one database does not need PgBouncer. If the database is
managed and serverless-adjacent, put a pooler in front and cap `max` below the
provider's connection limit — serverless request bursts open connections far
faster than a long-lived process does.

---

## 2. Environment variables

### Frontend (Vercel project settings)

| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `/api/v1` | Relative — this is what activates the rewrite proxy and keeps cookies same-site. |
| `API_ORIGIN` | `https://api.example.com` | **Server-only. Not exposed to the browser.** Origin only, no path, no trailing slash. |

If `API_ORIGIN` is unset while the public URL is relative, the build **fails on
Vercel on purpose**. Server components would otherwise resolve a relative URL,
which `fetch` cannot parse, and every server-rendered page would come back empty
— for the report form, an empty set of category radio buttons, which a resident
would read as their own mistake. Reproduce this locally with:

```bash
cd frontend && VERCEL=1 NEXT_PUBLIC_API_BASE_URL=/api/v1 npm run build   # must fail
```

### Backend

Copy `backend/.env.example` to `.env` and set at minimum:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_ACCESS_SECRET` | **Must be replaced.** The example value must never run in production; env validation rejects it. |
| `JWT_REFRESH_SECRET` | As above. |
| `CORS_ORIGINS` | The frontend origin, e.g. `https://acc.example.com`. Required in production and **must not be `*`** — the schema rejects it, because credentialed requests need explicit origins. |
| `PUBLIC_WEB_URL` | `https://acc.example.com`. Used in notification and privacy links. |
| `STORAGE_ROOT` | Absolute path on the persistent volume, e.g. `/var/lib/acc/storage`. A relative value resolves against the working directory and logs a warning. |
| `ALLOW_ANONYMOUS_REPORTS` | `false`. The platform cannot genuinely deliver anonymity and does not promise it. |
| `ALLOW_PRECISE_LOCATIONS` | `false` until a location-privacy decision is made. |
| `ENABLE_NOTIFICATION_WORKER` | `false`. **No provider is wired in.** Setting it true does not send anything. |
| `ENABLE_SWAGGER` | `false` in production. The API surface is not for public consumption. |

Full list and validation rules: `backend/src/config/env.schema.ts`.

---

## 3. First deployment

### 3.1 Database

```bash
# Created once, by someone with authority to do so.
psql -c "CREATE DATABASE acc_prod OWNER acc;"
psql -c "CREATE ROLE acc LOGIN PASSWORD '<generated>';"
psql -d acc_prod -c "ALTER DATABASE acc_prod OWNER TO acc;"
```

Then from `backend/`, against the production `DATABASE_URL`:

```bash
npm ci
npm run db:generate
npm run db:deploy     # applies migrations; never `migrate dev` against production
npm run db:seed       # see the warning below
```

> **`db:seed` writes demo data.** It creates staff accounts with
> `mustChangePassword = true` and no known passwords, so nothing is
> immediately usable — but every seeded account is a real credential-holding
> row. **[UNVERIFIED]** whether seed is appropriate in production at all. It was
> written for development. The safer path is to run it once, change every
> password, enrol MFA for the privileged accounts, then never run it again.
> Decide this deliberately rather than by habit.

### 3.2 Backend

```bash
npm run build
npm run start:prod    # node dist/main.js
```

Behind a reverse proxy terminating TLS, forwarding to the app over loopback.
The app trusts no proxy headers by default (`app.set('trust proxy', 0)` in
`main.ts`); **if you place a proxy in front, review that setting**, because
`X-Forwarded-For` is what the rate limiter keys on, and a misconfigured value
means every resident shares one rate-limit budget.

Verify:

```bash
curl -s https://api.example.com/api/v1/health/ready
# {"status":"ok","database":"ok","storage":"ok"}
```

`storage: ok` is the one that proves the volume is writable. If it reports
`unavailable`, report attachments are not being stored and the site should not
be taking reports.

### 3.3 Frontend

Import the repository into Vercel, then:

- **Root Directory = `frontend`.** The repository has two `package.json` files
  and Vercel will not find a Next.js application at the root.
- Framework preset: Next.js. Build command: `npm run build`. Output: default.
- Add `NEXT_PUBLIC_API_BASE_URL=/api/v1` and `API_ORIGIN=https://api.example.com`.
- Attach the custom domain `acc.example.com`.

`acc.vercel.app` **must not** be used as the resident-facing host. Staff sign-in
will not work there — see 1.2. If Vercel issues you a `.vercel.app` URL, redirect
it to the custom domain or leave it unpublished.

Verify the proxy actually proxies before trusting anything:

```bash
curl -si https://acc.example.com/api/v1/health | head -3
# Must return 200 with the API's JSON body, not a 404 from Next.
```

---

## 4. Verification before announcing a pilot

Run these in order. Each has caught something real.

```bash
# 1. The API answers and the disk is writable.
curl -s https://api.example.com/api/v1/health/ready

# 2. The frontend proxies the API (1.2 — the silent-failure case).
curl -s https://acc.example.com/api/v1/health

# 3. Staff sign-in end to end, in a real browser on the custom domain.
#    Sign in, then open the queue. If cookies were not sent, this fails.
#    Nothing short of this test proves SameSite is satisfied.

# 4. Submit a report, then look it up with the reference and token returned.
#    A resident who cannot look up their own report has been left in the dark.

# 5. Both other locales render real script, not English fallbacks.
curl -s https://acc.example.com/ti/report   | grep -qE '[ሀ-፿]' && echo ti-ok
curl -s https://acc.example.com/am/report   | grep -qE '[ሀ-፿]' && echo am-ok
```

Step 3 has no automated substitute in this repository. There is no end-to-end
browser test, and the failure mode — cookies silently not attached — produces no
error at all in either console or network tab. **[UNVERIFIED]** until a person
does it.

---

## 5. Backups

Not written. Not automated. Nothing in this repository performs a backup, and
that is the single largest gap between this code and a real pilot.

What is needed:

- **PostgreSQL.** Scheduled logical dumps (`pg_dump`) to off-host storage,
  encrypted, retained by policy, with **restore tested** on a schedule. An
  untested backup is an assumption.
- **`STORAGE_ROOT`.** Report attachments live on a disk volume and are not in
  the database. A database backup without the volume preserves reports whose
  attachments are gone. Back up the volume, or move attachments into
  object storage — the latter is better and is not yet done.
- **Retention.** The retention schedule is a policy decision that has not been
  made. `docs/03-milestones.md` records it as an open institutional gate. No
  retention job exists in code, so **nothing is currently deleted** — which is
  its own problem, and is the safer of the two failure directions.

---

## 6. When something breaks

| Symptom | First thing to check |
| --- | --- |
| Residents see pages but no report categories | `API_ORIGIN` unset or wrong, or the rewrite is not active. `API_SERVER_BASE_URL` must be absolute. |
| Staff sign-in fails, no visible error | Cookies are not being sent. Almost always a cross-site deployment (see 1.2). Check the domains, not the API. |
| `/health/ready` says `storage: unavailable` | The volume is not writable, or `STORAGE_ROOT` is missing. **Stop taking reports.** |
| Everyone rate-limited at once | Rate limits key on client IP. A shared/NAT connection shares one budget; confirm the proxy's `X-Forwarded-For` is correct and `trust proxy` is deliberate. |
| Staff queue is empty | Check the scope: the queue is filtered by what each role is authorized to see. An empty queue may be correct, not broken. |
| A Tigrinya or Amharic page shows English | The API returns `translationPending` so the UI can say "shown in English" rather than substituting silently. Check that first. |
| `npm run test:e2e` refuses to start | Working as intended — see `docs/04-setup.md`. It will not run against a database without `test` in the name. |

---

## 7. Known gaps

Carried from `docs/03-milestones.md`; a deployment does not close them.

- **M4–M6 untested.** The publish guard and contact expiry are unproven. A
  number that should no longer be shown, and content that should not be public.
- **M10 incomplete.** No assignment, triage, announcement approval, or audit
  browsing in the UI.
- **No retention enforcement.** Nothing is deleted.
- **No incident-response rehearsal.** No one has practised this document.
- **Translations unreviewed.** Machine-checked for completeness, not accuracy. A
  wrong instruction about who to telephone is worse than an English one.
- **No monitoring or alerting.** Health checks are manual. There is no error
  tracking, no uptime check from outside the host, and no alert on failed
  logins, refusals or audit anomalies.
- **M12 institutional gates** — signed authorization, retention schedule, named
  data protection contact, verified service contacts, telephone fallback — are
  decisions no amount of deployment will supply.
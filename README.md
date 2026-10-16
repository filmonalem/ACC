# Adigrat Community Connect (ACC)

**Connected Communities. Safer Neighbourhoods.**

A community safety and emergency communication platform for Adigrat, Tigray,
Ethiopia: structured resident reporting, a directory of *verified* service
contacts, approved public announcements, and a staff dashboard for review.

> ## This is a proposed initiative, not a government service
>
> ACC is **not** owned, operated or endorsed by any government office. It is
> **not** connected to any emergency dispatch system, and it does **not**
> guarantee a response time or an immediate reply.
>
> Reports are reviewed by authorized staff during published hours only. In an
> emergency, contact the appropriate service directly by telephone — the platform
> is not a substitute for that, and never routes a message to anyone for you.
>
> No telephone number, logo, seal or partnership shown by this software has been
> verified with an external authority. Seeded contacts are fictional and use
> reserved example numbers.

---

## Status

**The backend and the resident/staff frontend both exist and build. Deployment
automation is not written.**

| | |
| --- | --- |
| Backend (NestJS + TypeScript + Prisma + PostgreSQL) | working, 140 tests passing (91 unit, 2 integration, 47 e2e) |
| Frontend (Next.js 15, App Router) | working, 34 tests passing |
| Docker / deployment / backup automation | **not written** |
| Documentation | architecture, data model, status, setup |

Read [`docs/03-milestones.md`](docs/03-milestones.md) before anything else. It
records what is verified, what is not, and the real defects that were found by
running this code for the first time.

## Documentation

| Document | What it covers |
| --- | --- |
| [`docs/01-architecture.md`](docs/01-architecture.md) | Module boundaries, cross-cutting decisions, trust boundaries |
| [`docs/02-database.md`](docs/02-database.md) | Data model and the reasoning behind it |
| [`docs/03-milestones.md`](docs/03-milestones.md) | **Verified** status, known defects, recommended next steps |
| [`docs/04-setup.md`](docs/04-setup.md) | Reproducing the development environment on Linux |

## Quick start

```bash
cd backend
npm install
cp .env.example .env      # then edit DATABASE_URL and JWT_ACCESS_SECRET
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

API on <http://localhost:4000/api/v1>, Swagger on
<http://localhost:4000/api/v1/docs>. Full instructions, including database
setup, are in [`docs/04-setup.md`](docs/04-setup.md).

## What the backend actually does today

**Residents, no account needed**

- Submit a report; receive a reference code and a single-use status token.
- Check a report's status later with both. Neither alone reveals anything.
- Retry a submission safely — an `Idempotency-Key` returns the original report
  rather than creating a second.
- Anonymous reporting is **refused by default**, because the platform cannot
  genuinely deliver anonymity and will not promise it.

**Staff, authenticated and permission-checked**

- Work a queue scoped to what each person is authorized to see.
- Triage urgency, verification and escalation *independently of workflow status*.
  Urgency is not evidence, and the data model says so.
- Move reports through a lifecycle whose transitions are defined in one place,
  each recording who, when, from what, to what, and why.
- Read the audit trail, including a record of every refusal.

**Security posture**

- Argon2id passwords; httpOnly `SameSite=Strict` session cookies; CSRF
  double-submit on every mutation.
- MFA is mandatory for supervisors, administrators and content editors.
- A system administrator is **not** automatically granted access to report
  content. That is asserted in code and in tests.
- Reporter identity and precise location are separate permissions from reading
  the report at all. No seeded role holds the precise-location permission.
- Attachments live in a private volume outside every web root, and are served
  only through a controller that re-checks permission on each request.

## Licence and attribution

Pilot software for community consultation. Contains no third-party branding,
government emblems, or real service contact details.
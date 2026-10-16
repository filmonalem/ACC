# ACC — Setup Guide (Linux)

Reproduces the development environment from a clean checkout. Every command is
run from the repository root unless stated otherwise.

If something here does not work on your machine, that is a defect in this
document, not in your machine.

---

## 0. What you need

| Requirement | Version | Why |
| --- | --- | --- |
| Node.js | ≥ 20.11 | `package.json` `engines`; Nest 11 requires it |
| npm | ≥ 10 | ships with Node 20 |
| PostgreSQL | ≥ 14 | the only supported database |

Check:

```bash
node --version
npm --version
psql --version
```

> There is no frontend to install. `frontend/` does not exist yet — see
> `docs/03-milestones.md`.

---

## 1. Database

The application needs two databases: one you develop against and one the tests
wipe. Keeping them separate is what stops a test run from destroying your work.

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE acc WITH LOGIN PASSWORD 'choose-a-local-password';
CREATE DATABASE acc_dev  OWNER acc;
CREATE DATABASE acc_test OWNER acc;
SQL
```

Grant the role permission to create databases — Prisma needs a shadow database
to apply migrations safely:

```bash
sudo -u postgres psql -c "ALTER ROLE acc CREATEDB;"
```

> **Do not use the `acc` role outside your own machine.** It is a development
> convenience. A real deployment uses a role with far fewer privileges; see
> §7.

---

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

```bash
DATABASE_URL="postgresql://acc:choose-a-local-password@127.0.0.1:5432/acc_dev?schema=public"
JWT_ACCESS_SECRET="<output of the command below>"
STORAGE_ROOT="/home/you/acc-storage"
```

Generate a secret. **There is no default**, on purpose — the process refuses to
start without one, because a shared fallback secret is a shared vulnerability.

```bash
openssl rand -base64 48
```

`STORAGE_ROOT` must be **absolute** and must not be inside anything a web server
serves. The application resolves it against the working directory if it is
relative and logs a warning; do not rely on that.

---

## 3. Schema and seed data

```bash
npm run db:generate   # regenerate the Prisma client
npm run db:deploy     # apply migrations (safe to re-run)
npm run db:seed       # fictional demo data
```

### About the seed data

Everything the seed creates is **fictional**:

- Organizations are named "Example …" and are left **unapproved**.
- Phone numbers use the `0911xxxx` range reserved for documentation and examples.
  They do not dial anything.
- Staff accounts are `*.@acc.invalid` — `.invalid` is reserved by RFC 2606 and
  can never be a real address.
- The one demo service contact is flagged `isFictionalDemo`, which the public API
  surfaces as a visible badge.
- The script **refuses to run when `NODE_ENV=production`**.

Sign in with `triage@acc.invalid` / the password the seed prints. Every seeded
account has `mustChangePassword` set, and privileged roles enrol MFA on first
sign-in.

---

## 4. Run it

```bash
npm run dev
```

- API: <http://localhost:4000/api/v1>
- Swagger UI: <http://localhost:4000/api/v1/docs>
- Readiness: <http://localhost:4000/api/v1/health/ready>

```bash
curl -s localhost:4000/api/v1/health/ready
# {"status":"ok","database":"ok","storage":"ok","time":"…"}
```

---

## 5. Tests

Three suites, each answering a different question.

```bash
# Fast, no database. Runs on every save.
npm test

# Needs acc_test. Proves guards, transactions and HTTP behaviour.
DATABASE_URL="postgresql://acc:choose-a-local-password@127.0.0.1:5432/acc_test?schema=public" \
  npm run test:integration

# Needs acc_test. The full resident → staff journey, including negative cases.
DATABASE_URL="postgresql://acc:choose-a-local-password@127.0.0.1:5432/acc_test?schema=public" \
  npm run test:e2e
```

Both database suites **truncate** `Report`, `ReportAttachment`, `Notification`,
`ConsentRecord` and `AuditLog`. Point them only at `acc_test`.

They now refuse to start against a database whose name does not contain
`test`, because a bare `npm run test:e2e` picks up the development
`DATABASE_URL` from `.env` — and emptying the development database is silent
and still exits green. If you genuinely need to point a suite at a
differently-named disposable database, set `ALLOW_DESTRUCTIVE_TESTS=true`.

Everything at once:

```bash
DATABASE_URL="postgresql://acc:choose-a-local-password@127.0.0.1:5432/acc_test?schema=public" \
  npm run test:all
```

Before opening a pull request:

```bash
npm run verify   # typecheck + build + unit tests
```

---

## 6. Everyday commands

| Command | Does |
| --- | --- |
| `npm run dev` | start with hot reload |
| `npm run build` | compile to `dist/` |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | unit tests |
| `npm run db:studio` | browse the data |
| `npm run db:migrate` | create and apply a new migration |
| `npm run db:reset` | **destroys** `acc_dev` and re-seeds |

> `npm run db:reset` drops every table in the database named by `DATABASE_URL`.
> Check which one that is before running it.

---

## 7. Going beyond development

None of the following is automated yet, and none should be improvised:

- **HTTPS.** Terminate TLS at a reverse proxy. Set `COOKIE_SECURE=true` and
  `TRUST_PROXY_HOPS` to the real proxy count — a wrong value makes rate limiting
  and audit records wrong or spoofable.
- **Database backups.** Write them, test the restore, and store the encryption
  key separately from the backups. A backup you have never restored is a guess.
- **Least-privilege database role.** Split the `acc` role: one that migrates, one
  the application runs as. The application role needs no DDL rights.
- **Secrets.** `JWT_ACCESS_SECRET` comes from the environment or a secret manager,
  never from a file in the repository. Rotating it signs everyone out and
  invalidates stored MFA secrets, so plan the re-enrolment.
- **Malware scanning.** `SKIP_MALWARE_SCAN=true` is refused in production. Until a
  scanner is wired in, the honest configuration is not to run a public pilot.
- **Data protection.** Proclamation No. 1321/2024 applies. A named contact and an
  agreed retention schedule are prerequisites, not follow-ups.

See `docs/03-milestones.md` (M11, M12) for what is still missing.
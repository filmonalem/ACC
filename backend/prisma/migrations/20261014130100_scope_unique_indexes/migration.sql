-- ─────────────────────────────────────────────────────────────────────────────
-- Partial unique indexes that the Prisma schema language cannot express.
--
-- 1. UserRole scope uniqueness.
--    `organizationId` is nullable, so it cannot be part of a primary key.
--    PostgreSQL treats NULLs as distinct inside a plain unique index, so
--    UNIQUE (userId, roleId, organizationId) would silently accept any number
--    of duplicate *global* grants (organizationId IS NULL). Two partial indexes
--    express the real rule: at most one global grant, and at most one grant per
--    organization, for each (userId, roleId) pair.
--
-- 2. ConsentRecord active-decision uniqueness.
--    Revoked rows are retained as history, so only un-revoked rows may be
--    constrained to one live decision per (report, consentType).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "userrole_global_uniq"
  ON "UserRole" ("userId", "roleId")
  WHERE "organizationId" IS NULL;

CREATE UNIQUE INDEX "userrole_org_uniq"
  ON "UserRole" ("userId", "roleId", "organizationId")
  WHERE "organizationId" IS NOT NULL;

CREATE UNIQUE INDEX "consent_active_uniq"
  ON "ConsentRecord" ("reportId", "consentType")
  WHERE "revokedAt" IS NULL AND "reportId" IS NOT NULL;

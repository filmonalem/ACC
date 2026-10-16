import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ALL_PERMISSION_CODES,
  DEFAULT_ROLE_GRANTS,
  PERMISSION_DESCRIPTIONS,
} from '../src/common/permissions';

/**
 * Test fixtures.
 *
 * Everything created here is fictional. Phone numbers come from the reserved
 * `0911xxxx` documentation range so a failing test can never dial a real
 * service, and every account is clearly named as a test fixture.
 *
 * The suite talks to a real PostgreSQL database and creates its own roles and
 * grants rather than reusing the development seed, so a test cannot be affected
 * by whatever someone last seeded — and cannot be affected *by* a test.
 */

export const TEST_PASSWORD = 'TestOnly!2026';

let prismaSingleton: PrismaClient | null = null;

export function db(): PrismaClient {
  if (prismaSingleton) return prismaSingleton;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  prismaSingleton = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  return prismaSingleton;
}

export async function disconnectDb(): Promise<void> {
  await prismaSingleton?.$disconnect();
  prismaSingleton = null;
}

/**
 * Sync the permission catalogue and role grants into the test database.
 *
 * Mirrors `prisma/seed.ts` because the API resolves permissions from the
 * database: a test that skipped this would be testing the guards with empty
 * permission sets, and everything would 403 for the wrong reason.
 */
export async function syncPermissions(): Promise<void> {
  const client = db();

  for (const code of ALL_PERMISSION_CODES) {
    const meta = PERMISSION_DESCRIPTIONS[code];
    await client.permission.upsert({
      where: { code },
      create: { code, category: meta.category, description: meta.description },
      update: {},
    });
  }

  for (const [key, grants] of Object.entries(DEFAULT_ROLE_GRANTS)) {
    const role = await client.role.upsert({
      where: { key: key as never },
      create: {
        key: key as never,
        name: key,
        description: `Test fixture role ${key}`,
        isSystem: true,
      },
      update: {},
    });

    await client.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (grants.length > 0) {
      await client.rolePermission.createMany({
        data: grants.map((permissionCode) => ({ roleId: role.id, permissionCode })),
        skipDuplicates: true,
      });
    }
  }
}

export interface TestUser {
  id: string;
  email: string;
  fullName: string;
}

export async function createUser(options: {
  email: string;
  fullName: string;
  roles: Array<keyof typeof DEFAULT_ROLE_GRANTS>;
  organizationId?: string | null;
  status?: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'PENDING_INVITE';
}): Promise<TestUser> {
  const client = db();

  const passwordHash = await argon2.hash(TEST_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 8192,
    timeCost: 1,
    parallelism: 1,
  });

  const user = await client.user.create({
    data: {
      email: options.email,
      fullName: options.fullName,
      passwordHash,
      status: options.status ?? 'ACTIVE',
      mustChangePassword: false,
    },
  });

  for (const roleKey of options.roles) {
    const role = await client.role.findUniqueOrThrow({ where: { key: roleKey as never } });

    await client.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        organizationId: options.organizationId ?? null,
      },
    });
  }

  return { id: user.id, email: user.email, fullName: user.fullName };
}

export async function createOrganization(slug: string, isApproved = false): Promise<string> {
  const org = await db().organization.create({
    data: {
      slug,
      name: `Test organization ${slug}`,
      description: 'Fictional organization created by the automated test suite.',
      isApproved,
    },
  });

  return org.id;
}

/** A report category the suite controls, so tests do not depend on seed data. */
export async function ensureCategory(key: string): Promise<string> {
  const existing = await db().reportCategory.findUnique({ where: { key } });
  if (existing) return existing.id;

  const created = await db().reportCategory.create({
    data: {
      key,
      labelI18n: { en: `Test category ${key}`, ti: `ሙከራ ${key}`, am: `ሙከራ ${key}` },
      sortOrder: 999,
      requiresUrgentReview: false,
    },
  });

  return created.id;
}

export async function createReport(options: {
  categoryId: string;
  assigneeId?: string | null;
  organizationId?: string | null;
  description?: string;
  reporterPhone?: string;
  reporterName?: string;
}): Promise<{ id: string; referenceCode: string }> {
  const client = db();
  const referenceCode = `ACC-T${randomUUID().replace(/-/g, '').slice(0, 7).toUpperCase()}`;

  const report = await client.report.create({
    data: {
      referenceCode,
      // Test-only hash of a value no one knows; status lookup is never used
      // against a fixture report.
      statusTokenHash: randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64),
      categoryId: options.categoryId,
      description:
        options.description ??
        'Automated test fixture report describing a sufficiently long concern.',
      language: 'en',
      reporterConsentGiven: true,
      reporterIdentity: {
        create: {
          isAnonymous: false,
          fullName: options.reporterName ?? 'Test Resident',
          // Reserved documentation range, never a working number.
          phone: options.reporterPhone ?? '0911000099',
          preferredContactMethod: 'PHONE',
        },
      },
      location: {
        create: { precision: 'KEBELE', landmarkDescription: 'Test fixture location' },
      },
      statusHistory: {
        create: {
          fromStatus: 'SUBMITTED',
          toStatus: 'SUBMITTED',
          changedByName: 'Test fixture',
          reason: 'Created by the automated test suite',
        },
      },
      ...(options.assigneeId
        ? {
            assignments: {
              create: {
                assigneeId: options.assigneeId,
                assignedById: options.assigneeId,
                organizationId: options.organizationId ?? null,
                active: true,
              },
            },
          }
        : {}),
    },
  });

  return { id: report.id, referenceCode: report.referenceCode };
}

/**
 * Removes the rows an individual test created.
 *
 * Only *per-test* data. The staff accounts and organizations are created once
 * in `beforeAll` and used by many tests, so deleting them here would break
 * every test after the first one — a failure that looks like an application
 * bug and is not. `cleanupAll` at the end of the suite removes them.
 *
 * Report *categories* are left in place for the same reason: they are created
 * once and shared, and removing them would invalidate the id later tests still
 * hold, turning a real failure into a foreign-key error. `ensureCategory` is
 * idempotent, so a leftover `test_*` row costs nothing.
 */
export async function cleanup(): Promise<void> {
  const client = db();

  // Deleting the report root takes its attachments, notes, history and identity
  // with it, so these are listed only where a cascade does not apply.
  await client.reportAttachment.deleteMany({});
  await client.report.deleteMany({});
  await client.notification.deleteMany({});
  await client.consentRecord.deleteMany({});
  await client.auditLog.deleteMany({});
}

/**
 * Full teardown for the suite.
 *
 * Users are deleted before organizations because a membership row would
 * otherwise hold the organization in place. Audit rows reference users with
 * `onDelete: SetNull`, so they stay readable afterwards rather than disappearing
 * with the actor.
 */
export async function cleanupAll(): Promise<void> {
  const client = db();

  await cleanup();

  await client.user.deleteMany({ where: { email: { endsWith: '@acc.test' } } });
  await client.organization.deleteMany({ where: { slug: { startsWith: 'test-org' } } });
}

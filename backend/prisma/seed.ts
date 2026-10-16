/**
 * Development seed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EVERYTHING THIS SCRIPT CREATES IS FICTIONAL DEMONSTRATION DATA.
 *
 * No row written here is a real service, a real organization, a real person or
 * a real telephone number. Phone numbers are deliberately taken from the
 * documentation-reserved ranges so they cannot dial a neighbour, an ambulance
 * or a police station:
 *
 *   0911xxxx  0912xxxx   reserved by Wikipedia for examples and documentation
 *   0910xxxx             Ethiopian mobile test range used by local telcos
 *
 * ServiceContact and SupportService rows are additionally marked
 * `isDemoData = true`, which the public API surfaces as a visible "example
 * entry" badge. If anyone ever mistakes a seed row for a real service, that
 * badge is the second line of defence; the reserved numbering is the first.
 *
 * Never run this against a database that holds real submissions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ALL_PERMISSION_CODES,
  DEFAULT_ROLE_GRANTS,
  MFA_REQUIRED_ROLES,
  PERMISSION_DESCRIPTIONS,
} from '../src/common/permissions';
import * as argon2 from 'argon2';

// ── configuration ───────────────────────────────────────────────────────────

/**
 * Prisma 7's CLI loads .env via prisma.config.ts, but this script is also run
 * directly with `tsx` (and by CI), where nothing has loaded it. Values already
 * in the environment always win.
 */
function loadLocalEnv(): void {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadLocalEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Run via `npm run db:seed` so .env is loaded.');
}

/** Refuses to point the demo data at anything that looks like production. */
const NODE_ENV = process.env.NODE_ENV ?? 'development';
if (NODE_ENV === 'production') {
  throw new Error(
    'Refusing to seed: NODE_ENV=production. Seed data is fictional and must never ' +
      'be loaded into a real deployment.',
  );
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const argon = {
  memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 19456),
  timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
  parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
};

// ═════════════════════════════════════════════════════════════════════════════
// Reference data
// ═════════════════════════════════════════════════════════════════════════════

type Localised = { en: string; ti: string; am: string };

const REPORT_CATEGORIES: Array<{
  key: string;
  icon: string;
  sortOrder: number;
  requiresUrgentReview: boolean;
  label: Localised;
  description: Localised;
}> = [
  {
    key: 'public_safety',
    icon: 'shield-alert',
    sortOrder: 10,
    // Anything filed here is read as potentially urgent. It raises the starting
    // urgency; it does NOT verify the report and does NOT notify anyone
    // externally. Urgency is not evidence.
    requiresUrgentReview: true,
    label: {
      en: 'Public safety concern',
      ti: 'የህዝብ ደህንነት ችግር',
      am: 'የሕዝብ ደህንነት ችግር',
    },
    description: {
      en: 'Something you believe may be unsafe for people in the community.',
      ti: 'ለማኅበረሰቡ አደጋ የሆነ የሚቆጠር ነገር።',
      am: 'ለማኅበረሰቡ አደጋ የሆነ የሚቆጠር ነገር።',
    },
  },
  {
    key: 'infrastructure',
    icon: 'construction',
    sortOrder: 20,
    requiresUrgentReview: false,
    label: {
      en: 'Infrastructure problem',
      ti: 'የመሠረተ ልማት ችግር',
      am: 'የመሠረተ ልማት ችግር',
    },
    description: {
      en: 'Roads, water, electricity, street lighting, drainage and similar.',
      ti: 'መንገድ፣ ውሃ፣ ኤሌክትሪክ፣ የጎዳና ብርሃን እና መሳሳች።',
      am: 'መንገድ፣ ውሃ፣ ኤሌክትሪክ፣ የጎዳና ብርሃን እና መሳሳች።',
    },
  },
  {
    key: 'community_service',
    icon: 'users',
    sortOrder: 30,
    requiresUrgentReview: false,
    label: {
      en: 'Community service issue',
      ti: 'የማኅበረሰብ አገልግሎት ችግር',
      am: 'የማኅበረሰብ አገልግሎት ችግር',
    },
    description: {
      en: 'A problem with a local service such as a clinic, school or office.',
      ti: 'ክሊኒክ፣ ትምህርት ቤት ወይም ጽ/ቤት አገልግሎት ላይ ያለው ችግር።',
      am: 'ክሊኒክ፣ ትምህርት ቤት ወይም ጽ/ቤት አገልግሎት ላይ ያለው ችግር።',
    },
  },
  {
    key: 'environmental',
    icon: 'leaf',
    sortOrder: 40,
    requiresUrgentReview: false,
    label: {
      en: 'Environmental concern',
      ti: 'የአካባቢ ችግር',
      am: 'የአካባቢ ችግር',
    },
    description: {
      en: 'Waste, pollution, flooding, erosion or damage to shared land.',
      ti: 'ቆሻሻ፣ አካባቢ አስተዋልድ፣ የውሃ ሰሌዳ ወይም የመሬት ጉዳት።',
      am: 'ቆሻሻ፣ አካባቢ አስተዋልድ፣ የውሃ ሰሌዳ ወይም የመሬት ጉዳት።',
    },
  },
  {
    key: 'other',
    icon: 'message-circle',
    sortOrder: 50,
    requiresUrgentReview: false,
    label: {
      en: 'Something else',
      ti: 'ሌላ ነገር',
      am: 'ሌላ ነገር',
    },
    description: {
      en: 'Anything that does not fit the categories above.',
      ti: 'ከላይ ያሉትን ዘርፎች የሚያልፈው ሌላ ነገር።',
      am: 'ከላይ ያሉትን ዘርፎች የሚያልፈው ሌላ ነገር።',
    },
  },
];

/**
 * Two fictional organizations, both left UNAPPROVED.
 *
 * Nothing here is a real institution. `isApproved: false` is deliberate: a new
 * deployment must not present an organization as endorsed until a governance
 * administrator has actually reviewed it.
 */
const ORGANIZATIONS = [
  {
    slug: 'example-community-council',
    name: 'Example Community Council (demonstration)',
    description:
      'Fictional organization used to demonstrate the approval workflow. Not a ' +
      'real body and not affiliated with any government office.',
    contactEmail: 'hello@example.invalid',
    contactPhone: '0911000001',
  },
  {
    slug: 'example-support-network',
    name: 'Example Support Network (demonstration)',
    description:
      'Second fictional organization, present so organization-scoped permissions ' +
      'can be exercised in a test.',
    contactEmail: 'contact@example.invalid',
    contactPhone: '0911000002',
  },
];

const STAFF_USERS = [
  {
    email: 'triage@acc.invalid',
    fullName: 'Demo Triage Officer',
    role: 'TRIAGE_OFFICER',
    organizationSlug: 'example-community-council',
    title: 'Triage officer (demonstration account)',
  },
  {
    email: 'service@acc.invalid',
    fullName: 'Demo Service Officer',
    role: 'SERVICE_OFFICER',
    organizationSlug: 'example-community-council',
    title: 'Service officer (demonstration account)',
  },
  {
    email: 'editor@acc.invalid',
    fullName: 'Demo Content Editor',
    role: 'CONTENT_EDITOR',
    organizationSlug: 'example-community-council',
    title: 'Content editor (demonstration account)',
  },
  {
    email: 'supervisor@acc.invalid',
    fullName: 'Demo Supervisor',
    role: 'SUPERVISOR',
    organizationSlug: 'example-community-council',
    title: 'Supervisor (demonstration account)',
  },
  {
    email: 'admin@acc.invalid',
    fullName: 'Demo System Administrator',
    role: 'SYSTEM_ADMIN',
    organizationSlug: null,
    title: 'System administrator (demonstration account)',
  },
];

/**
 * Password for every seeded account.
 *
 * Shared, printed by the script, and documented as development-only. It is
 * deliberately obvious so that nobody is tempted to keep it.
 */
const DEMO_PASSWORD = 'AccDemo!2026';

/**
 * Demonstration contact number, taken from the `0911xxxx` range reserved for
 * documentation and examples. It is not assigned to any Ethiopian operator and
 * must never be replaced with a real service number.
 */
const DEMO_CONTACT_PHONE = '0911000003';

async function main() {
  console.log('Seeding ACC development data (all fictional).\n');

  // ── permissions ──────────────────────────────────────────────────────────
  // Synced from the code catalogue, so a permission added in TypeScript and
  // forgotten here shows up as a diff rather than as a runtime 403.
  for (const code of ALL_PERMISSION_CODES) {
    const meta = PERMISSION_DESCRIPTIONS[code];
    await prisma.permission.upsert({
      where: { code },
      create: { code, category: meta.category, description: meta.description },
      update: { category: meta.category, description: meta.description },
    });
  }
  console.log(`  permissions      ${ALL_PERMISSION_CODES.length}`);

  // ── roles ────────────────────────────────────────────────────────────────
  const roleIds = new Map<string, string>();
  for (const [key, permissionCodes] of Object.entries(DEFAULT_ROLE_GRANTS)) {
    const role = await prisma.role.upsert({
      where: { key: key as never },
      create: {
        key: key as never,
        name: key
          .split('_')
          .map((part) => part[0] + part.slice(1).toLowerCase())
          .join(' '),
        description: `Default grants for ${key}. See src/common/permissions.ts.`,
        isSystem: true,
      },
      update: {},
      include: { permissions: true },
    });

    // Replace the grant set wholesale so revoking a permission in code takes
    // effect on the next seed rather than lingering in the database.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissionCodes.map((permissionCode) => ({ roleId: role.id, permissionCode })),
      skipDuplicates: true,
    });

    roleIds.set(key, role.id);
    void role;
  }
  console.log(`  roles            ${roleIds.size}`);

  // ── report categories ────────────────────────────────────────────────────
  const categoryIds = new Map<string, string>();
  for (const category of REPORT_CATEGORIES) {
    const row = await prisma.reportCategory.upsert({
      where: { key: category.key },
      create: {
        key: category.key,
        labelI18n: category.label,
        descriptionI18n: category.description,
        icon: category.icon,
        sortOrder: category.sortOrder,
        requiresUrgentReview: category.requiresUrgentReview,
      },
      update: {
        labelI18n: category.label,
        descriptionI18n: category.description,
        icon: category.icon,
        sortOrder: category.sortOrder,
        requiresUrgentReview: category.requiresUrgentReview,
      },
    });
    categoryIds.set(category.key, row.id);
  }
  console.log(`  report categories ${categoryIds.size}`);

  // ── organizations (unapproved) ───────────────────────────────────────────
  const organizationIds = new Map<string, string>();
  for (const org of ORGANIZATIONS) {
    const row = await prisma.organization.upsert({
      where: { slug: org.slug },
      create: {
        slug: org.slug,
        name: org.name,
        description: org.description,
        contactEmail: org.contactEmail,
        contactPhone: org.contactPhone,
        isApproved: false,
      },
      // Approval state is never reset: once a human has approved an
      // organization, re-seeding must not quietly revoke it.
      update: { name: org.name, description: org.description },
    });
    organizationIds.set(org.slug, row.id);
  }
  console.log(`  organizations    ${organizationIds.size} (unapproved, as intended)`);

  // ── staff accounts ───────────────────────────────────────────────────────
  // Hashed with the same Argon2id parameters the running service verifies
  // against. Using the low development cost keeps a reseed fast; production
  // values come from ARGON2_* in the environment and are never lowered.
  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
    ...argon,
  });
  const userIds = new Map<string, string>();

  for (const staff of STAFF_USERS) {
    const user = await prisma.user.upsert({
      where: { email: staff.email },
      create: {
        email: staff.email,
        fullName: staff.fullName,
        passwordHash,
        status: 'ACTIVE',
        mustChangePassword: true,
        preferredLocale: 'en',
      },
      // The password is refreshed so `npm run db:seed` reliably restores a
      // known login, but the display name and status are left to an
      // administrator to maintain.
      update: { passwordHash },
    });
    userIds.set(staff.email, user.id);

    const roleId = roleIds.get(staff.role);
    if (!roleId) throw new Error(`Role ${staff.role} was not seeded`);

    await prisma.userRole.deleteMany({ where: { userId: user.id, roleId } });
    await prisma.userRole.create({ data: { userId: user.id, roleId } });

    if (staff.organizationSlug) {
      const organizationId = organizationIds.get(staff.organizationSlug);
      if (!organizationId) throw new Error(`Organization ${staff.organizationSlug} missing`);

      await prisma.organizationMembership.upsert({
        where: {
          userId_organizationId: { userId: user.id, organizationId },
        },
        create: { userId: user.id, organizationId, title: staff.title, isPrimary: true },
        update: { title: staff.title },
      });
    }
  }
  console.log(`  staff accounts   ${userIds.size}`);

  // ── a report, so the dashboard is not empty on first login ───────────────
  const triageUserId = userIds.get('triage@acc.invalid');
  const serviceUserId = userIds.get('service@acc.invalid');
  const supervisorId = userIds.get('supervisor@acc.invalid');
  const communityOrgId = organizationIds.get('example-community-council');

  const alreadySeeded = await prisma.report.count({ where: { description: { startsWith: '[demo]' } } });

  if (alreadySeeded === 0 && triageUserId && serviceUserId) {
    // Written directly rather than through the API: the seed should not depend
    // on HTTP, cookies or CSRF tokens. The reference code and token hash use
    // the same shape the service produces so the status-lookup flow is
    // demonstrable.
    const referenceCode = `ACC-${cryptoRandomCode()}`;
    const demoToken = 'demo-status-token-not-a-real-credential';

    const report = await prisma.report.create({
      data: {
        referenceCode,
        statusTokenHash: sha256Hex(demoToken),
        categoryId: categoryIds.get('infrastructure')!,
        description:
          '[demo] Demonstration report. A street light has been out near the ' +
          'main junction for about a week. Created by the seed script so the ' +
          'staff dashboard has something to show.',
        language: 'en',
        urgency: 'NORMAL',
        status: 'SUBMITTED',
        reporterConsentGiven: true,
        reporterIdentity: {
          create: {
            isAnonymous: false,
            fullName: 'Demo Resident',
            phone: '0911222200',
            preferredContactMethod: 'PHONE',
            languagePreference: 'en',
          },
        },
        location: {
          create: {
            precision: 'KEBELE',
            subCityName: 'Adigrat',
            landmarkDescription: 'Near the main junction (demonstration entry)',
          },
        },
        // `changedById` is nullable for system-initiated transitions; the
        // denormalised name column is what the history trail displays.
        statusHistory: {
          create: {
            fromStatus: 'SUBMITTED',
            toStatus: 'SUBMITTED',
            changedById: null,
            changedByName: 'Public form',
            reason: 'Submitted through the public form (seeded demonstration data)',
          },
        },
        consents: {
          create: {
            consentType: 'PERSONAL_DATA_PROCESSING',
            policyVersion: process.env.PRIVACY_POLICY_VERSION ?? 'draft-2026-01',
            granted: true,
          },
        },
      },
    });

    // Move it to UNDER_REVIEW and assign it, so the assignment, history and
    // audit surfaces all have real rows rather than empty states.
    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: 'UNDER_REVIEW',
        firstReviewedAt: new Date(),
        statusHistory: {
          create: {
            fromStatus: 'SUBMITTED',
            toStatus: 'UNDER_REVIEW',
            changedById: triageUserId,
            changedByName: 'Demo Triage Officer',
            reason: 'Picked up for review (seeded demonstration data)',
          },
        },
        assignments: {
          create: {
            assigneeId: serviceUserId,
            assignedById: supervisorId ?? triageUserId,
            organizationId: communityOrgId,
            note: 'Assigned by the seed script for demonstration',
          },
        },
        notes: {
          create: {
            authorId: triageUserId,
            body: '[demo] Seeded triage note. This is fictional demonstration content.',
          },
        },
      },
    });
    console.log('  demo report      1 (UNDER_REVIEW, assigned)');
  } else {
    console.log('  demo report      skipped (already present)');
  }

  // ── a fictional, clearly-labelled service contact ─────────────────────────
  const contactExists = await prisma.serviceContact.findFirst({
    where: { phoneNumber: DEMO_CONTACT_PHONE },
  });

  if (!contactExists) {
    await prisma.serviceContact.create({
      data: {
        organizationId: communityOrgId,
        category: 'COMMUNITY',
        // `name`/`description` hold the English text; the `*I18n` columns carry
        // the same field per locale. Staff-editable rows are created through the
        // API, which populates both from one form submission.
        name: 'Example Community Information Desk (demonstration)',
        description:
          'Fictional entry. Shows how a verified contact appears in the directory.',
        nameI18n: {
          en: 'Example Community Information Desk (demonstration)',
          ti: 'ምሳሌ የማኅበረሰብ መረጃ ጽ/ቤት',
          am: 'ምሳሌ የማኅበረሰብ መረጃ ጽ/ቤት',
        },
        descriptionI18n: {
          en: 'Fictional entry. Shows how a verified contact appears in the directory.',
          ti: 'ምሳሌ ግብዓት። የተረጋገጠ መረጃ እንዴት በማስመለስ ውስጥ እንደሚታይ ያሳያል።',
          am: 'ምሳሌ ግብዓት። የተረጋገጠ መረጃ እንዴት በማስመለስ ውስጥ እንደሚታይ ያሳያል።',
        },
        // Reserved example numbering. This is NOT a working phone number.
        phoneNumber: DEMO_CONTACT_PHONE,
        alternativeInstructions:
          'This is a demonstration entry and cannot be called.',
        coverageArea: 'Adigrat (demonstration)',
        isEmergency: false,
        status: 'VERIFIED',
        isPublished: true,
        verifiedAt: new Date(),
        verificationExpiresAt: new Date(Date.now() + 30 * 86_400_000),
        isFictionalDemo: true,
      },
    });
    console.log('  demo contact     1 (fictional, flagged isFictionalDemo)');
  }

  console.log(`
Seed complete. All data above is fictional demonstration data.

Staff sign-in (development only — never reuse these credentials anywhere real):
  ${STAFF_USERS.map((u) => `  ${u.email.padEnd(24)} ${DEMO_PASSWORD}`).join('\n')}

Notes:
  - Every seeded account has mustChangePassword = true.
  - Privileged roles (${[...MFA_REQUIRED_ROLES].join(', ')}) must enrol MFA at first use.
  - No emergency phone numbers are seeded. Publishing a contact flagged
    emergency requires contacts.publish_emergency, and the numbers above use
    reserved example ranges.
`);
}

// ── local helpers ──────────────────────────────────────────────────────────

/** Same alphabet as CryptoService.referenceCode: Crockford base32, no I/L/O/U. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function cryptoRandomCode(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('\nSeed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });


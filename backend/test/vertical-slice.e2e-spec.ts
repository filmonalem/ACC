import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, signIn, type TestApp } from './test-app';
import {
  cleanup,
  cleanupAll,
  createOrganization,
  createReport,
  createUser,
  db,
  disconnectDb,
  ensureCategory,
  syncPermissions,
  TEST_PASSWORD,
} from './test-fixtures';

/**
 * The vertical slice, end to end over HTTP.
 *
 * This is the scenario the project brief asks for: a resident submits a report,
 * gets a reference back, checks its status securely, and authorized staff review
 * and advance it — while an unauthorized caller is refused at every step.
 *
 * Everything runs against the real application: real guards in the real order,
 * real cookies, real CSRF, real database transactions. A unit test cannot prove
 * any of that.
 */

const TRIAGE_EMAIL = 'triage-officer@acc.test';
const SUPERVISOR_EMAIL = 'supervisor@acc.test';
const OUTSIDER_EMAIL = 'outsider-officer@acc.test';

const description =
  'A street light has been out near the main junction for about a week and it is very dark at night.';

let app: TestApp;
let categoryId: string;
let triageId: string;
let supervisorId: string;
let outsiderId: string;
let orgA: string;
let orgB: string;

beforeAll(async () => {
  app = await createTestApp();

  // Clear anything a previously interrupted run left behind. MFA enrolment is
  // one-way, so an account left enrolled from an earlier run would demand a code
  // whose secret no longer exists in this process — a failure that looks like an
  // authentication bug and is really leftover state.
  await cleanupAll();
  await syncPermissions();
  categoryId = await ensureCategory('test_infrastructure');

  orgA = await createOrganization('test-org-a');
  orgB = await createOrganization('test-org-b');

  const triage = await createUser({
    email: TRIAGE_EMAIL,
    fullName: 'Test Triage Officer',
    roles: ['TRIAGE_OFFICER'],
    organizationId: orgA,
  });
  triageId = triage.id;

  const supervisor = await createUser({
    email: SUPERVISOR_EMAIL,
    fullName: 'Test Supervisor',
    roles: ['SUPERVISOR'],
  });
  supervisorId = supervisor.id;

  const outsider = await createUser({
    email: OUTSIDER_EMAIL,
    fullName: 'Test Outsider Officer',
    roles: ['TRIAGE_OFFICER'],
    organizationId: orgB,
  });
  outsiderId = outsider.id;
});

afterEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanupAll();
  await app.close();
  await disconnectDb();
});

describe('resident submits a report', () => {
  it('returns a reference code and a single-use status token', async () => {
    const response = await app
      .http()
      .post('/api/v1/reports')
      .set('Idempotency-Key', 'e2e-submit-happy-path')
      .send({
        categoryKey: 'test_infrastructure',
        description,
        language: 'en',
        reporterName: 'Test Resident',
        reporterPhone: '0911000099',
        preferredContactMethod: 'PHONE',
        reporterConsentGiven: true,
      })
      .expect(201);

    expect(response.body.referenceCode).toMatch(/^ACC-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(response.body.statusToken).toEqual(expect.any(String));
    expect(response.body.statusToken.length).toBeGreaterThanOrEqual(20);
    expect(response.body.replayed).toBe(false);
    expect(response.body.status).toBe('SUBMITTED');
  });

  it('never stores the status token in plaintext', async () => {
    const response = await app
      .http()
      .post('/api/v1/reports')
      .set('Idempotency-Key', 'e2e-submit-hash-check')
      .send({
        categoryKey: 'test_infrastructure',
        description,
        language: 'en',
        reporterConsentGiven: true,
      })
      .expect(201);

    const stored = await db().report.findUniqueOrThrow({
      where: { referenceCode: response.body.referenceCode },
      select: { statusTokenHash: true },
    });

    expect(stored.statusTokenHash).not.toBe(response.body.statusToken);
    expect(stored.statusTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses a submission that is too short to act on', async () => {
    const response = await app
      .http()
      .post('/api/v1/reports')
      .send({
        categoryKey: 'test_infrastructure',
        description: 'broken',
        language: 'en',
        reporterConsentGiven: true,
      })
      .expect(400);

    expect(response.body.error.code).toBe('bad_request');
    expect(JSON.stringify(response.body.error)).toContain('at least 20 characters');
  });

  it('refuses a submission that omits consent', async () => {
    await app
      .http()
      .post('/api/v1/reports')
      .send({ categoryKey: 'test_infrastructure', description, language: 'en' })
      .expect(400);
  });

  it('rejects an unknown field instead of silently dropping it', async () => {
    // A misspelled field that vanishes quietly produces a report missing
    // information its author believed they had supplied.
    const response = await app
      .http()
      .post('/api/v1/reports')
      .send({
        categoryKey: 'test_infrastructure',
        description,
        language: 'en',
        reporterConsentGiven: true,
        contactConsent: true,
      })
      .expect(400);

    expect(response.body.error.details.violations.join(' ')).toContain('contactConsent');
  });

  it('refuses an unknown category', async () => {
    await app
      .http()
      .post('/api/v1/reports')
      .send({
        categoryKey: 'no_such_category',
        description,
        language: 'en',
        reporterConsentGiven: true,
      })
      .expect(400);
  });

  it('refuses anonymous reporting while the feature is disabled', async () => {
    const response = await app
      .http()
      .post('/api/v1/reports')
      .send({
        categoryKey: 'test_infrastructure',
        description,
        language: 'en',
        isAnonymous: true,
        reporterConsentGiven: true,
      })
      .expect(403);

    expect(response.body.error.code).toBe('anonymous_reporting_disabled');
  });

  it('refuses precise coordinates while the feature is disabled', async () => {
    await app
      .http()
      .post('/api/v1/reports')
      .send({
        categoryKey: 'test_infrastructure',
        description,
        language: 'en',
        reporterConsentGiven: true,
        locationPrecision: 'PRECISE',
        latitude: 13.4937,
        longitude: 39.4699,
      })
      .expect(403);
  });
});

describe('duplicate submission protection', () => {
  const payload = {
    categoryKey: 'test_infrastructure',
    description,
    language: 'en',
    reporterConsentGiven: true,
  };

  it('returns the original report when the same key is retried', async () => {
    const first = await app
      .http()
      .post('/api/v1/reports')
      .set('Idempotency-Key', 'e2e-idempotency')
      .send(payload)
      .expect(201);

    const second = await app
      .http()
      .post('/api/v1/reports')
      .set('Idempotency-Key', 'e2e-idempotency')
      .send(payload)
      .expect(201);

    expect(second.body.referenceCode).toBe(first.body.referenceCode);
    expect(second.body.replayed).toBe(true);
    expect(await db().report.count()).toBe(1);
  });

  it('does not reissue the status token on a replay', async () => {
    await app.http().post('/api/v1/reports').set('Idempotency-Key', 'e2e-idem-2').send(payload).expect(201);

    const replay = await app
      .http()
      .post('/api/v1/reports')
      .set('Idempotency-Key', 'e2e-idem-2')
      .send(payload)
      .expect(201);

    // The plaintext is unrecoverable by design, so the client is told to keep
    // the one it already has rather than being handed a second.
    expect(replay.body.statusToken).toBeNull();
  });

  it('treats a different key as a genuinely new report', async () => {
    await app.http().post('/api/v1/reports').set('Idempotency-Key', 'key-a').send(payload).expect(201);
    await app.http().post('/api/v1/reports').set('Idempotency-Key', 'key-b').send(payload).expect(201);

    expect(await db().report.count()).toBe(2);
  });

  it('rejects an oversized idempotency key', async () => {
    await app
      .http()
      .post('/api/v1/reports')
      .set('Idempotency-Key', 'x'.repeat(200))
      .send(payload)
      .expect(400);
  });

  it('generates a distinct reference code for every report', async () => {
    const created = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const response = await app
        .http()
        .post('/api/v1/reports')
        .set('Idempotency-Key', `uniqueness-${i}`)
        .send(payload)
        .expect(201);
      created.add(response.body.referenceCode);
    }

    expect(created.size).toBe(5);
  });
});

describe('resident checks status', () => {
  async function submit(): Promise<{ referenceCode: string; statusToken: string }> {
    const response = await app
      .http()
      .post('/api/v1/reports')
      .set('Idempotency-Key', `status-${Math.random()}`)
      .send({
        categoryKey: 'test_infrastructure',
        description,
        language: 'en',
        reporterConsentGiven: true,
      })
      .expect(201);

    return { referenceCode: response.body.referenceCode, statusToken: response.body.statusToken };
  }

  it('returns the state of the resident’s own report', async () => {
    const { referenceCode, statusToken } = await submit();

    const response = await app
      .http()
      .get(`/api/v1/reports/${referenceCode}/status`)
      .query({ statusToken })
      .expect(200);

    expect(response.body.referenceCode).toBe(referenceCode);
    expect(response.body.status).toBe('SUBMITTED');
    expect(response.body.publicMessage).toEqual(expect.any(String));
  });

  it('gives nothing away without the status token', async () => {
    const { referenceCode } = await submit();

    await app.http().get(`/api/v1/reports/${referenceCode}/status`).expect(400);
  });

  it('gives nothing away with the wrong status token', async () => {
    const { referenceCode } = await submit();

    const response = await app
      .http()
      .get(`/api/v1/reports/${referenceCode}/status`)
      .query({ statusToken: 'a'.repeat(40) })
      .expect(404);

    expect(response.body.error.code).toBe('report_not_found');
  });

  /**
   * The status explanation is the sentence that tells a resident whether their
   * report was received and what happens next. A reader who cannot read it
   * cannot answer that question, so it must actually exist in their language
   * rather than falling back to English without saying so.
   */
  it('serves the status explanation in the requested language', async () => {
    const { referenceCode, statusToken } = await submit();

    for (const locale of ['en', 'ti', 'am'] as const) {
      const response = await app
        .http()
        .get(`/api/v1/reports/${referenceCode}/status`)
        .query({ statusToken, locale })
        .expect(200);

      expect(response.body.messageLocale, `${locale} fell back`).toBe(locale);
      expect(response.body.translationPending, `${locale} was flagged as a fallback`).toBe(
        false,
      );
      expect(response.body.publicMessage.length).toBeGreaterThan(15);
      expect(response.body.publicMessage).not.toContain('SUBMITTED');
    }
  });

  it('resolves the category label to a single language', async () => {
    const { referenceCode, statusToken } = await submit();

    const response = await app
      .http()
      .get(`/api/v1/reports/${referenceCode}/status`)
      .query({ statusToken, locale: 'ti' })
      .expect(200);

    // A string, not the raw `{ en, ti, am }` map: the interface should not be
    // implementing the fallback rule itself.
    expect(typeof response.body.categoryLabel).toBe('string');
    expect(response.body.locale).toBe('ti');
  });

  it('rejects an unsupported locale rather than silently serving English', async () => {
    const { referenceCode, statusToken } = await submit();

    await app
      .http()
      .get(`/api/v1/reports/${referenceCode}/status`)
      .query({ statusToken, locale: 'fr' })
      .expect(400);
  });

  /**
   * Regression guard.
   *
   * `locale` indexes a translation map. On a plain object, `map['constructor']`
   * resolves to a truthy inherited member, which a naive `map[locale] ?? map.en`
   * would return — putting `Function: Object()` into a public JSON response as
   * the label. The locale is validated, and `localise` is defensive, so both
   * layers reject it.
   */
  it('rejects prototype keys supplied as a locale', async () => {
    const { referenceCode, statusToken } = await submit();

    for (const locale of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      await app
        .http()
        .get(`/api/v1/reports/${referenceCode}/status`)
        .query({ statusToken, locale })
        .expect(400);
    }
  });

  it('defaults to English when no locale is given', async () => {
    const { referenceCode, statusToken } = await submit();

    const response = await app
      .http()
      .get(`/api/v1/reports/${referenceCode}/status`)
      .query({ statusToken })
      .expect(200);

    expect(response.body.locale).toBe('en');
    expect(response.body.messageLocale).toBe('en');
  });

  it('rejects a malformed reference code as a client error', async () => {
    await app
      .http()
      .get('/api/v1/reports/not-a-real-code/status')
      .query({ statusToken: 'a'.repeat(40) })
      .expect(400);
  });

  it('never includes staff notes or the reporter’s identity', async () => {
    const { referenceCode, statusToken } = await submit();

    await db().reportNote.create({
      data: {
        reportId: (await db().report.findUniqueOrThrow({ where: { referenceCode } })).id,
        authorId: triageId,
        body: 'INTERNAL: resident may be in danger, do not share externally',
      },
    });

    const response = await app
      .http()
      .get(`/api/v1/reports/${referenceCode}/status`)
      .query({ statusToken })
      .expect(200);

    const serialised = JSON.stringify(response.body);
    expect(serialised).not.toContain('INTERNAL');
    expect(serialised).not.toContain('do not share');
    expect(response.body).not.toHaveProperty('notes');
    expect(response.body).not.toHaveProperty('reporterIdentity');
    expect(response.body).not.toHaveProperty('assignments');
  });
});

describe('authorized staff review', () => {
  it('refuses the report queue to an anonymous caller', async () => {
    await app.http().get('/api/v1/admin/reports').expect(401);
  });

  it('lets a triage officer list reports assigned to them', async () => {
    await createReport({ categoryId, assigneeId: triageId });

    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    const response = await app
      .http()
      .get('/api/v1/admin/reports')
      .set('Cookie', session.cookies)
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].referenceCode).toMatch(/^ACC-/);
  });

  it('hides reports assigned to another officer from an assigned-only viewer', async () => {
    await createReport({ categoryId, assigneeId: outsiderId });

    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    const response = await app
      .http()
      .get('/api/v1/admin/reports')
      .set('Cookie', session.cookies)
      .expect(200);

    expect(response.body.meta.total).toBe(0);
  });

  it('refuses report detail to an officer the report is not assigned to', async () => {
    const report = await createReport({ categoryId, assigneeId: outsiderId });

    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    await app
      .http()
      .get(`/api/v1/admin/reports/${report.id}`)
      .set('Cookie', session.cookies)
      .expect(403);
  });

  it('lets a supervisor read any report within their authorized scope', async () => {
    const report = await createReport({ categoryId, assigneeId: outsiderId });

    const session = await signIn(app.http, SUPERVISOR_EMAIL, TEST_PASSWORD);

    const response = await app
      .http()
      .get(`/api/v1/admin/reports/${report.id}`)
      .set('Cookie', session.cookies)
      .expect(200);

    expect(response.body.referenceCode).toBe(report.referenceCode);
    expect(response.body.status).toBe('SUBMITTED');
  });

  it('does not expose reporter identity to a triage officer', async () => {
    const report = await createReport({ categoryId, assigneeId: triageId });

    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    const response = await app
      .http()
      .get(`/api/v1/admin/reports/${report.id}`)
      .set('Cookie', session.cookies)
      .expect(200);

    // The response says "withheld" rather than pretending there is no reporter,
    // so a dashboard can explain the gap instead of showing an empty field.
    expect(response.body.reporter).toEqual({ available: false, withheld: true });
    expect(JSON.stringify(response.body)).not.toContain('Test Resident');
    expect(JSON.stringify(response.body)).not.toContain('0911000099');
  });

  it('exposes reporter identity to a supervisor, because oversight needs it', async () => {
    const report = await createReport({
      categoryId,
      assigneeId: triageId,
      reporterName: 'Test Resident',
      reporterPhone: '0911000099',
    });

    const session = await signIn(app.http, SUPERVISOR_EMAIL, TEST_PASSWORD);

    const response = await app
      .http()
      .get(`/api/v1/admin/reports/${report.id}`)
      .set('Cookie', session.cookies)
      .expect(200);

    expect(response.body.reporter.available).toBe(true);
    expect(response.body.reporter.fullName).toBe('Test Resident');
  });

  it('supports searching by reference code', async () => {
    const target = await createReport({ categoryId, assigneeId: triageId });
    await createReport({ categoryId, assigneeId: triageId });

    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    const response = await app
      .http()
      .get('/api/v1/admin/reports')
      .query({ search: target.referenceCode })
      .set('Cookie', session.cookies)
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].referenceCode).toBe(target.referenceCode);
  });

  it('rejects an unrecognised filter rather than ignoring it', async () => {
    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    await app
      .http()
      .get('/api/v1/admin/reports')
      .query({ statuss: 'SUBMITTED' })
      .set('Cookie', session.cookies)
      .expect(400);
  });
});

describe('status transitions', () => {
  it('lets an officer with the right permission move a report forward', async () => {
    const report = await createReport({ categoryId, assigneeId: triageId });
    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    const response = await app
      .http()
      .patch(`/api/v1/admin/reports/${report.id}/status`)
      .set('Cookie', session.cookies)
      .set(session.csrfHeaderName, session.csrfToken)
      .send({ status: 'UNDER_REVIEW', reason: 'Picked up for review by the test suite' })
      .expect(200);

    expect(response.body.status).toBe('UNDER_REVIEW');
    expect(response.body.firstReviewedAt).toBeTruthy();
  });

  it('records the actor, the change and the reason in the history', async () => {
    const report = await createReport({ categoryId, assigneeId: triageId });
    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    await app
      .http()
      .patch(`/api/v1/admin/reports/${report.id}/status`)
      .set('Cookie', session.cookies)
      .set(session.csrfHeaderName, session.csrfToken)
      .send({ status: 'UNDER_REVIEW', reason: 'Recorded history for the test suite' })
      .expect(200);

    const history = await db().reportStatusHistory.findMany({
      where: { reportId: report.id },
      orderBy: { createdAt: 'asc' },
    });

    const transition = history.at(-1);
    expect(transition?.fromStatus).toBe('SUBMITTED');
    expect(transition?.toStatus).toBe('UNDER_REVIEW');
    expect(transition?.changedById).toBe(triageId);
    expect(transition?.changedByName).toBe('Test Triage Officer');
    expect(transition?.reason).toBe('Recorded history for the test suite');
  });

  it('refuses a transition the actor lacks permission for', async () => {
    // A triage officer may not assign; ASSIGNED requires reports.assign.
    const report = await createReport({ categoryId, assigneeId: triageId });
    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    const response = await app
      .http()
      .patch(`/api/v1/admin/reports/${report.id}/status`)
      .set('Cookie', session.cookies)
      .set(session.csrfHeaderName, session.csrfToken)
      .send({ status: 'ASSIGNED', reason: 'Attempting a step this role may not take' })
      .expect(409);

    // SUBMITTED has no edge to ASSIGNED at all, so the refusal lists what it
    // *can* move to rather than naming a permission — the response must not leak
    // the shape of the workflow to someone with no authority over it.
    expect(response.body.error.code).toBe('transition_not_allowed');
    expect(response.body.error.details.from).toBe('SUBMITTED');
  });

  it('refuses to skip a step in the lifecycle', async () => {
    const report = await createReport({ categoryId, assigneeId: triageId });
    const session = await signIn(app.http, SUPERVISOR_EMAIL, TEST_PASSWORD);

    await app
      .http()
      .patch(`/api/v1/admin/reports/${report.id}/status`)
      .set('Cookie', session.cookies)
      .set(session.csrfHeaderName, session.csrfToken)
      .send({ status: 'IN_PROGRESS', reason: 'Trying to skip the review step entirely' })
      .expect(409);
  });

  it('refuses a transition with no reason where one is required', async () => {
    const report = await createReport({ categoryId, assigneeId: triageId });
    const session = await signIn(app.http, SUPERVISOR_EMAIL, TEST_PASSWORD);

    await app
      .http()
      .patch(`/api/v1/admin/reports/${report.id}/status`)
      .set('Cookie', session.cookies)
      .set(session.csrfHeaderName, session.csrfToken)
      .send({ status: 'REJECTED' })
      .expect(409);
  });

  it('refuses to move a report that is already closed', async () => {
    const report = await createReport({ categoryId, assigneeId: triageId });
    const session = await signIn(app.http, SUPERVISOR_EMAIL, TEST_PASSWORD);

    await db().report.update({
      where: { id: report.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    const response = await app
      .http()
      .patch(`/api/v1/admin/reports/${report.id}/status`)
      .set('Cookie', session.cookies)
      .set(session.csrfHeaderName, session.csrfToken)
      .send({ status: 'UNDER_REVIEW', reason: 'Attempting to reopen a closed report' })
      .expect(409);

    expect(response.body.error.code).toBe('report_terminal');
  });

  it('offers only the transitions the actor may actually perform', async () => {
    const report = await createReport({ categoryId, assigneeId: triageId });
    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    const response = await app
      .http()
      .get(`/api/v1/admin/reports/${report.id}/available-transitions`)
      .set('Cookie', session.cookies)
      .expect(200);

    // From SUBMITTED a triage officer may open a review or link a duplicate,
    // but may not assign: that edge requires reports.assign.
    const targets = response.body.transitions.map((rule: { to: string }) => rule.to);
    expect(targets).toContain('UNDER_REVIEW');
    expect(targets).toContain('DUPLICATE');
    expect(targets).not.toContain('ASSIGNED');
  });
});

describe('triage', () => {
  it('records urgency and verification independently of workflow status', async () => {
    const report = await createReport({ categoryId, assigneeId: triageId });
    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    const response = await app
      .http()
      .post(`/api/v1/admin/reports/${report.id}/triage`)
      .set('Cookie', session.cookies)
      .set(session.csrfHeaderName, session.csrfToken)
      // Escalation demands a recorded reason — an unexplained escalation tells
      // the next person nothing about what was found.
      .send({
        urgency: 'HIGH',
        verificationStatus: 'VERIFIED',
        escalationState: 'REVIEW_PENDING',
        reason: 'Raised for review by the automated test suite',
      })
      .expect(201);

    expect(response.body.urgency).toBe('HIGH');
    expect(response.body.verificationStatus).toBe('VERIFIED');
    // Urgency and verification are separate axes: triaging must not advance
    // the workflow, and raising urgency must not imply verification.
    expect(response.body.status).toBe('SUBMITTED');
  });

  it('refuses triage to an officer without the permission', async () => {
    const report = await createReport({ categoryId, assigneeId: supervisorId });
    const outsider = await createUser({
      email: 'no-triage@acc.test',
      fullName: 'Test Officer Without Triage',
      roles: ['RESIDENT'],
    });
    void outsider;

    const session = await signIn(app.http, SUPERVISOR_EMAIL, TEST_PASSWORD);
    await app
      .http()
      .post(`/api/v1/admin/reports/${report.id}/triage`)
      .set('Cookie', session.cookies)
      .set(session.csrfHeaderName, session.csrfToken)
      .send({ urgency: 'HIGH' })
      .expect(201);

    // The resident role cannot reach staff routes at all.
    const resident = await signIn(app.http, 'no-triage@acc.test', TEST_PASSWORD);
    await app
      .http()
      .post(`/api/v1/admin/reports/${report.id}/triage`)
      .set('Cookie', resident.cookies)
      .set(resident.csrfHeaderName, resident.csrfToken)
      .send({ urgency: 'LOW' })
      .expect(403);
  });
});

describe('CSRF protection on staff mutations', () => {
  it('refuses a mutation with no CSRF header', async () => {
    const report = await createReport({ categoryId, assigneeId: triageId });
    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    const response = await app
      .http()
      .patch(`/api/v1/admin/reports/${report.id}/status`)
      .set('Cookie', session.cookies)
      .send({ status: 'UNDER_REVIEW', reason: 'No CSRF header supplied by the test' })
      .expect(403);

    expect(response.body.error.code).toBe('csrf_token_missing');
  });

  it('refuses a forged CSRF value even when the cookie is valid', async () => {
    const report = await createReport({ categoryId, assigneeId: triageId });
    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    const response = await app
      .http()
      .patch(`/api/v1/admin/reports/${report.id}/status`)
      .set('Cookie', session.cookies)
      .set(session.csrfHeaderName, 'forged-by-an-attacker')
      .send({ status: 'UNDER_REVIEW', reason: 'Forged CSRF value from the test' })
      .expect(403);

    expect(response.body.error.code).toBe('csrf_token_invalid');
  });

  it('refuses a CSRF token that does not match the cookie', async () => {
    const other = await signIn(app.http, SUPERVISOR_EMAIL, TEST_PASSWORD);
    const report = await createReport({ categoryId, assigneeId: triageId });
    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    const response = await app
      .http()
      .patch(`/api/v1/admin/reports/${report.id}/status`)
      .set('Cookie', session.cookies)
      .set(other.csrfHeaderName, other.csrfToken)
      .send({ status: 'UNDER_REVIEW', reason: 'Mismatched CSRF pair from the test' })
      .expect(403);

    expect(response.body.error.code).toBe('csrf_token_mismatch');
  });

  it('does not require CSRF for public submission', async () => {
    // Residents have no session, so there is no cookie to double-submit.
    await app
      .http()
      .post('/api/v1/reports')
      .send({
        categoryKey: 'test_infrastructure',
        description,
        language: 'en',
        reporterConsentGiven: true,
      })
      .expect(201);
  });
});

describe('audit trail', () => {
  it('records a sensitive read by a supervisor', async () => {
    const report = await createReport({ categoryId });
    const session = await signIn(app.http, SUPERVISOR_EMAIL, TEST_PASSWORD);

    await app
      .http()
      .get(`/api/v1/admin/reports/${report.id}`)
      .set('Cookie', session.cookies)
      .expect(200);

    // Reading who wrote a report is a separate, separately audited act from
    // opening it, so it gets its own action code rather than being folded into
    // the general read.
    const entry = await db().auditLog.findFirst({
      where: { action: 'reports.identity.viewed', entityId: report.id },
      orderBy: { occurredAt: 'desc' },
    });

    expect(entry).toBeTruthy();
    expect(entry?.actorUserId).toBe(supervisorId);
  });

  it('records a permission refusal', async () => {
    const report = await createReport({ categoryId, assigneeId: outsiderId });
    const session = await signIn(app.http, TRIAGE_EMAIL, TEST_PASSWORD);

    await app
      .http()
      .get(`/api/v1/admin/reports/${report.id}`)
      .set('Cookie', session.cookies)
      .expect(403);

    const denial = await db().auditLog.findFirst({
      where: { action: 'reports.read', entityId: report.id, outcome: 'DENIED' },
      orderBy: { occurredAt: 'desc' },
    });

    expect(denial).toBeTruthy();
  });
});
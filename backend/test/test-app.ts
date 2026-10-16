import 'reflect-metadata';
import 'dotenv/config';
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { SuperTest, Test as SupertestTest } from 'supertest';
import * as otplib from 'otplib';

import { assertDisposableDatabase } from './database-safety';

/**
 * Boots the real application for integration and e2e tests.
 *
 * Deliberately mirrors `main.ts` rather than mocking the pipeline: a test that
 * registers its own middleware proves nothing about the guards that actually
 * run in production. The pieces that would make a test slow or flaky — binding
 * a port, Swagger, graceful shutdown — are the only things left out.
 *
 * Every environment variable used here has a test-mode override. `JWT_ACCESS_SECRET`
 * is a fixed test-only value so tokens are reproducible; `NODE_ENV=test` is what
 * keeps `SKIP_MALWARE_SCAN` legal.
 */

const TEST_JWT_SECRET = 'test-only-secret-not-used-outside-the-test-suite-0123456789';

export interface TestApp {
  app: INestApplication;
  /** A supertest client bound to the running application. */
  http: () => SuperTest<SupertestTest>;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;
  process.env.JWT_ACCESS_TTL = '15m';
  process.env.JWT_REFRESH_TTL = '7d';

  // Low Argon2 cost: the OWASP parameters are deliberately slow, and a suite
  // that signs in a dozen times would spend most of its runtime in KDF work.
  // The credentials being hashed are test fixtures created by the suite itself.
  process.env.ARGON2_MEMORY_COST ??= '8192';
  process.env.ARGON2_TIME_COST ??= '1';
  process.env.ARGON2_PARALLELISM ??= '1';

  process.env.SKIP_MALWARE_SCAN ??= 'true';
  process.env.ENABLE_SWAGGER ??= 'false';
  process.env.ENABLE_NOTIFICATION_WORKER ??= 'false';

  /**
   * Rate limits are raised for the suite.
   *
   * Two separate reasons, which is why both are needed:
   *
   *  1. Every request comes from one loopback address, so the shipped numbers —
   *     five submissions per ten minutes, five sign-in attempts per fifteen —
   *     would fail this suite on its sixth request of each kind.
   *  2. A pilot reached over a single shared connection would have the same
   *     problem in production: every resident behind one address shares one
   *     budget. The right value is a deployment decision, so it is configurable.
   *
   * The tight limits are not simply deleted. `@Throttle()` on a handler wins
   * over the global table, so raising `RATE_LIMIT_*` alone would change nothing
   * for submission or sign-in — `TEST_THROTTLE_MULTIPLIER` is what lifts those,
   * and `rate-limiting.integration-spec.ts` runs the same handlers with the
   * multiplier at 1 to prove the real limits are enforced.
   */
  process.env.RATE_LIMIT_MAX ??= '1000000';
  process.env.RATE_LIMIT_SUBMISSION_MAX ??= '1000000';
  process.env.RATE_LIMIT_STATUS_LOOKUP_MAX ??= '1000000';
  process.env.RATE_LIMIT_LOGIN_MAX ??= '1000000';
  process.env.RATE_LIMIT_PASSWORD_RESET_MAX ??= '1000000';
  process.env.RATE_LIMIT_REFRESH_MAX ??= '1000000';

  // Multiplies every per-route `@Throttle` limit. See above.
  process.env.TEST_THROTTLE_MULTIPLIER ??= '1000';

  // These are the defaults the pilot ships with. A test that silently flipped
  // them would be testing a configuration nobody deploys, so they are set
  // explicitly rather than inherited.
  process.env.ALLOW_ANONYMOUS_REPORTS ??= 'false';
  process.env.ALLOW_PRECISE_LOCATIONS ??= 'false';

  process.env.CORS_ORIGINS ??= 'http://localhost:3000';

  // This harness truncates tables (see test-fixtures.ts), and `dotenv/config`
  // above has just loaded the *development* connection string into the process.
  // Without this check `npm run test:e2e` deletes the development database's
  // reports and audit trail and still exits green.
  assertDisposableDatabase(process.env.DATABASE_URL, 'The e2e suite');

  // Imported lazily, after the environment above is set. `app.module.ts` builds
  // its rate-limit table from `parseEnv()` at evaluation time, so a static
  // top-level import would capture the values the shell exported rather than the
  // ones configured here.
  const { AppModule } = await import('../src/app.module');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: true });

  app.set('trust proxy', 0);
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Security headers are applied in the test app too, so a test can assert on
  // them. Omitting them would make the assertions in `security.spec.ts` pass
  // vacuously.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      hidePoweredBy: true,
    }),
  );

  app.use(cookieParser());
  app.useBodyParser('json', { limit: '100kb' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );

  await app.init();

  const server = app.getHttpServer();

  return {
    app,
    // `request(server)` is the supertest entry point: it wraps the Node server
    // and returns an agent with the `.get`/`.post`/`.patch` verbs the specs
    // use. The app is initialised but not listening, so supertest drives it
    // in-process on an ephemeral port — nothing to collide on in CI.
    http: () => request(server) as unknown as SuperTest<SupertestTest>,
    close: async () => {
      await app.close();
    },
  };
}

/**
 * A signed-in staff session.
 *
 * Captured as cookie headers because that is what the browser client sends, and
 * because going through `/auth/login` exercises the real token-issuance path —
 * a test that fabricated a JWT would not catch a broken login.
 */
export interface StaffSession {
  cookies: string[];
  csrfToken: string;
  csrfHeaderName: string;
  userId: string;
  email: string;
  /** Re-authenticates, for tests that invalidate sessions mid-run. */
  login: () => Promise<void>;
}

/**
 * TOTP secrets enrolled during this run, keyed by account.
 *
 * MFA enrolment is one-way and the secret is only ever handed out once, so the
 * suite has to remember it: the first sign-in for a privileged account enrols and
 * stores the secret here, and every later sign-in presents a fresh code for it —
 * exactly what an authenticator app does. Without this, the second sign-in would
 * have no way to produce a valid code.
 */
const enrolledSecrets = new Map<string, string>();

export async function signIn(
  http: () => SuperTest<SupertestTest>,
  email: string,
  password: string,
): Promise<StaffSession> {
  const sendLogin = (mfaCode?: string): request.Test =>
    http()
      .post('/api/v1/auth/login')
      .send(mfaCode ? { email, password, mfaCode } : { email, password });

  /**
   * Sign in, completing MFA enrolment on the way if the account needs it.
   *
   * Supervisors, system administrators and content editors are *required* to
   * have MFA. Their first sign-in returns a permission-less enrolment session
   * that becomes useful only once a code is confirmed — the same first-day flow
   * a real privileged user follows. Skipping it would either mean never testing
   * the privileged roles, or weakening `MFA_REQUIRED_ROLES` for the suite's
   * convenience. Neither is acceptable.
   *
   * The known-secret branch comes first: once an account has enrolled, a
   * password-only sign-in is refused outright, so the decision to send a code has
   * to be made before the request rather than by inspecting its failure.
   */
  if (enrolledSecrets.has(email)) {
    // MFA was enrolled earlier in this run; present a current code, as an
    // authenticator app would.
    const response = await sendLogin(otplib.authenticator.generate(enrolledSecrets.get(email)!)).expect(200);
    return buildSession(response, email, http, password);
  }

  const firstAttempt = await sendLogin();

  if (firstAttempt.status === 200) {
    const scope = firstAttempt.body.user?.scope;
    if (scope !== 'enrolment') return buildSession(firstAttempt, email, http, password);
  } else if (firstAttempt.status !== 401) {
    // Anything other than "signed in" or "needs enrolment" is a real failure —
    // a disabled account, a lockout, a bad password — and must surface as one
    // rather than being retried as though enrolment would fix it.
    throw new Error(
      `Sign-in for ${email} failed with ${firstAttempt.status}: ` +
        `${firstAttempt.body?.error?.code ?? 'no code'}`,
    );
  }

  // An enrolment session: display a secret, prove it works, then sign in again.
  const enrolment = await sendLogin().expect(200);
  const enrolCookies = enrolment.get('set-cookie') as unknown as string[];

  // The CSRF header is half of the double-submit pair, exactly as a browser
  // client sends it. Omitting it would exercise a path no real client takes.
  const csrfCookie = enrolCookies.find((cookie) => cookie.startsWith('acc_csrf='));
  if (!csrfCookie) throw new Error('Login set no CSRF cookie; MFA enrolment cannot proceed.');
  const csrfHeaderName: string = enrolment.body.csrfHeaderName ?? 'x-acc-csrf';
  const csrfToken = decodeURIComponent(csrfCookie.split(';')[0].split('=')[1]);

  const begin = await http()
    .post('/api/v1/auth/mfa/begin')
    .set('Cookie', enrolCookies)
    .set(csrfHeaderName, csrfToken)
    .expect(200);

  await http()
    .post('/api/v1/auth/mfa/confirm')
    .set('Cookie', enrolCookies)
    .set(csrfHeaderName, csrfToken)
    .send({ code: otplib.authenticator.generate(begin.body.secret), secret: begin.body.secret })
    .expect(200);

  enrolledSecrets.set(email, begin.body.secret);

  return buildSession(
    await sendLogin(otplib.authenticator.generate(begin.body.secret)).expect(200),
    email,
    http,
    password,
  );
}

/**
 * Extracts the session material from a successful sign-in.
 *
 * `set-cookie` is typed `string | string[]`; a login sets several cookies, so it
 * is normalised to an array once here rather than at every use.
 */
function buildSession(
  response: request.Response,
  email: string,
  http: () => SuperTest<SupertestTest>,
  password: string,
): StaffSession {
  const setCookieHeader = response.get('set-cookie');
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const csrfCookie = cookies.find((cookie) => cookie.startsWith('acc_csrf='));

  if (!csrfCookie) {
    throw new Error(`Login for ${email} did not set a CSRF cookie; the suite cannot continue.`);
  }

  const csrfToken = decodeURIComponent(csrfCookie.split(';')[0].split('=')[1]);
  const csrfHeaderName: string = response.body.csrfHeaderName ?? 'x-acc-csrf';

  const session: StaffSession = {
    cookies,
    csrfToken,
    csrfHeaderName,
    userId: response.body.user.id,
    email,
    async login() {
      const refreshed = await http().post('/api/v1/auth/login').send({ email, password }).expect(200);
      const refreshedHeader = refreshed.get('set-cookie');
      session.cookies = Array.isArray(refreshedHeader)
        ? refreshedHeader
        : refreshedHeader
          ? [refreshedHeader]
          : [];
    },
  };

  return session;
}
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { SuperTest, Test as SupertestTest } from 'supertest';
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

import { assertDisposableDatabase } from './database-safety';
import { db, disconnectDb } from './test-fixtures';

/**
 * Rate limiting, verified at the values the platform actually ships.
 *
 * The end-to-end suite raises every limit so that dozens of requests from one
 * loopback address do not trip them (see `test/test-app.ts`). This suite runs
 * with `TEST_THROTTLE_MULTIPLIER` unset, so `ROUTE_LIMITS` holds its real values
 * and the assertions below describe what a deployment enforces.
 *
 * It runs in its own process, and therefore its own module registry, because the
 * limits are read once at import time — two applications in one process would
 * share the first one's values and the second would silently inherit them.
 */

const VALID_SUBMISSION = {
  categoryKey: 'test_ratelimit',
  description:
    'A description long enough to satisfy the minimum length rule on the submission endpoint.',
  language: 'en',
  reporterConsentGiven: true,
};

let app: NestExpressApplication;
let http: () => SuperTest<SupertestTest>;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET ??= 'rate-limit-test-secret-not-used-in-production-0123456789';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? 'postgresql://localhost/acc_test?schema=public';

  // Without this the suite silently fell back to a credential-less URL and every
  // submission 500'd on SCRAM auth — and the assertions still passed, because a
  // throttle counts requests whether or not the handler succeeded.
  assertDisposableDatabase(process.env.DATABASE_URL, 'The rate-limit integration suite');

  process.env.SKIP_MALWARE_SCAN ??= 'true';
  process.env.ENABLE_SWAGGER ??= 'false';
  process.env.RATE_LIMIT_MAX ??= '300';

  // The multiplier is what the e2e suite uses to lift these limits. Its absence
  // here is the point of the file, so it is cleared rather than defaulted.
  delete process.env.TEST_THROTTLE_MULTIPLIER;

  const { AppModule } = await import('../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: true });
  app.set('trust proxy', 0);
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '100kb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
    }),
  );

  await app.init();
  http = () => request(app.getHttpServer()) as unknown as SuperTest<SupertestTest>;
});

afterAll(async () => {
  await app?.close();
  await disconnectDb();
});

describe('report submission rate limit', () => {
  it('allows the configured number of submissions and then refuses', async () => {
    const { ROUTE_LIMITS } = await import('../src/config/rate-limits');
    const limit = ROUTE_LIMITS.SUBMISSION.limit;

    // The limit must be the shipped value, not one multiplied for testing — if a
    // future change made this suite vacuous, this assertion is what catches it.
    expect(limit).toBe(5);

    /**
     * Resolve a category the database actually has.
     *
     * A hard-coded key cannot work: `unknown_category` is a 400, and a 400
     * consumes throttle budget just as a 201 does, so the original version of
     * this test passed whether or not a single report was ever created. Reading
     * the key back out of the seeded catalogue is what lets the assertion below
     * be about submissions rather than about request counting.
     */
    const category = await db().reportCategory.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { key: 'asc' },
    });

    if (!category) {
      throw new Error(
        'No active ReportCategory in this database. Run `npm run db:seed` against the test ' +
          'database before the rate-limit suite — otherwise every submission is refused with ' +
          '400 unknown_category and the assertions below prove nothing.',
      );
    }

    const statuses: number[] = [];
    for (let attempt = 0; attempt < limit + 2; attempt += 1) {
      const response = await http().post('/api/v1/reports').send({
        ...VALID_SUBMISSION,
        categoryKey: category.key,
        // Distinct key per attempt, so this measures the rate limit rather than
        // idempotent replay.
        idempotencyKey: undefined,
      });

      statuses.push(response.status);
    }

    /**
     * The first `limit` requests must have been genuinely accepted.
     *
     * This is the assertion that was missing. Without it the suite passed while
     * the database refused every connection with a SCRAM error, because the
     * throttle counts attempts and does not care what the handler did with them.
     * A rate limit that is only ever proved by a run of 500s is not a rate limit
     * that was proved.
     */
    expect(
      statuses.slice(0, limit),
      `expected ${limit} accepted submissions before throttling, got ${JSON.stringify(statuses)}`,
    ).toEqual(new Array(limit).fill(201));

    expect(statuses).toContain(429);

    const firstThrottle = statuses.indexOf(429);
    expect(statuses.slice(firstThrottle).every((status) => status === 429)).toBe(true);
  });

  it('does not throttle the health probe with the submission limit', async () => {
    // The bug this guards against: configuring several named throttlers makes
    // `ThrottlerGuard` apply every one of them to every route, so a tight
    // submission limit would throttle health checks too. For a pilot reached
    // over a shared connection that reads as the whole site being down.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await http().get('/api/v1/health').expect(200);
    }
  });
});
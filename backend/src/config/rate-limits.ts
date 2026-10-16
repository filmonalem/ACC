import { z } from 'zod';

/**
 * Per-route rate limits, declared once and referenced by controllers.
 *
 * The reason this exists rather than an inline `@Throttle({ limit: 5 })` on
 * each handler:
 *
 *  - **Named throttlers do not work the way the name suggests.**
 *    `ThrottlerGuard` applies *every* configured throttler to *every* route, so
 *    registering `report-submission` as a named throttler caps all endpoints —
 *    health checks included — at the submission limit. Endpoint-specific limits
 *    have to come from the handler decorator, which overrides the global table
 *    for that route only. `app.module.ts` therefore configures exactly one
 *    global throttler.
 *
 *  - **The numbers must be adjustable per deployment.** A pilot served through
 *    one shared connection needs a far larger budget than a public site, because
 *    every resident shares one address. A literal `5` in a controller cannot be
 *    changed without a code change and a redeploy.
 *
 * `TEST_THROTTLE_MULTIPLIER` exists so an end-to-end suite can lift these limits
 * without the production posture disappearing: it multiplies every value, is
 * unset in any real deployment, and is ignored entirely when it is not a
 * positive integer. `rate-limiting.integration-spec.ts` runs with it at 1.
 */

const limit = (defaultValue: number) =>
  z.coerce.number().int().min(1).default(defaultValue);

/**
 * Multiplier applied to every per-route limit.
 *
 * Defaults to 1, so a deployment that never sets it enforces exactly the
 * documented numbers. A malformed or non-positive value also falls back to 1
 * rather than throwing: an operator should not be able to turn the limits off by
 * typo, and `0` in particular would disable protection entirely.
 */
const multiplier = Number(process.env.TEST_THROTTLE_MULTIPLIER ?? 1);
export const THROTTLE_MULTIPLIER = Number.isInteger(multiplier) && multiplier > 0 ? multiplier : 1;

const scaled = (defaultValue: number, envName: string): number => {
  const parsed = limit(defaultValue).safeParse(process.env[envName]);
  const configured = parsed.success ? parsed.data : defaultValue;
  return configured * THROTTLE_MULTIPLIER;
};

const window = (defaultMs: number, envName: string): number => {
  const parsed = z.coerce.number().int().min(1000).default(defaultMs).safeParse(process.env[envName]);
  return parsed.success ? parsed.data : defaultMs;
};

/**
 * Rate limits for the endpoints that matter most, resolved from configuration.
 *
 * Read once at module load. Windows are never scaled — only the number of
 * requests is — because a longer window would turn the test multiplier into a
 * way to hold state for hours.
 */
export const ROUTE_LIMITS = {
  /**
   * Report submission. The most abused and most expensive endpoint, and the one
   * a flood would do most damage to.
   */
  SUBMISSION: {
    limit: scaled(5, 'RATE_LIMIT_SUBMISSION_MAX'),
    ttl: window(10 * 60_000, 'RATE_LIMIT_SUBMISSION_WINDOW_MS'),
  },

  /**
   * Status lookup. The status-token requirement is the real protection; this
   * exists to discourage reference-code enumeration and to bound the log volume
   * a guessing script could produce.
   */
  STATUS_LOOKUP: {
    limit: scaled(10, 'RATE_LIMIT_STATUS_LOOKUP_MAX'),
    ttl: window(10 * 60_000, 'RATE_LIMIT_STATUS_LOOKUP_WINDOW_MS'),
  },

  /**
   * Sign-in. Deliberately small: this is the endpoint worth brute-forcing, and
   * the account lockout in `AuthService` is the second layer behind this one.
   */
  LOGIN: {
    limit: scaled(5, 'RATE_LIMIT_LOGIN_MAX'),
    ttl: window(15 * 60_000, 'RATE_LIMIT_LOGIN_WINDOW_MS'),
  },

  /**
   * Token refresh. Higher than sign-in because a legitimate browser tab that has
   * been open a while refreshes on its own, and a household sharing one device
   * would otherwise log itself out.
   */
  REFRESH: {
    limit: scaled(30, 'RATE_LIMIT_REFRESH_MAX'),
    ttl: window(10 * 60_000, 'RATE_LIMIT_REFRESH_WINDOW_MS'),
  },

  /**
   * Password recovery. Small on purpose: this is a route to sending messages to
   * an address, and an unthrottled one becomes a mail-relay.
   */
  PASSWORD_RECOVERY: {
    limit: scaled(3, 'RATE_LIMIT_PASSWORD_RESET_MAX'),
    ttl: window(15 * 60_000, 'RATE_LIMIT_PASSWORD_RESET_WINDOW_MS'),
  },
} as const;
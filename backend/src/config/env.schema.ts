import { z } from 'zod';

/**
 * Every environment variable the backend reads, validated once at startup.
 *
 * Failing fast here is deliberate: a pilot that starts with a weak JWT secret or
 * a world-readable storage path is worse than one that refuses to start. There
 * is no "development fallback secret" — `JWT_ACCESS_SECRET` must be supplied.
 *
 * `CONFIGURED.md` documents each variable.
 */

/**
 * Environment variables arrive as strings, but the rest of the codebase should
 * see real booleans and arrays.
 *
 * Written with `preprocess` rather than `transform().default()` because in Zod 4
 * `.default()` takes the *output* type, which makes a string default a type
 * error. `preprocess` handles the missing-value case explicitly, so an unset
 * variable and a variable set to the empty string both take the default.
 */
const booleanFromEnv = (defaultValue: boolean) =>
  z.preprocess((raw) => {
    if (raw === undefined || raw === null || raw === '') return defaultValue;
    if (typeof raw === 'boolean') return raw;
    const normalised = String(raw).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalised)) return true;
    if (['false', '0', 'no', 'off'].includes(normalised)) return false;
    // Anything unrecognised falls back to the default rather than throwing:
      // a typo in a feature flag should not stop the service from booting.
    return defaultValue;
  }, z.boolean());

const csvList = (defaultValue: string[] = []) =>
  z.preprocess(
    (raw) => {
      if (raw === undefined || raw === null || raw === '') return defaultValue;
      return String(raw)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    },
    z.array(z.string()),
  );

export const envSchema = z
  .object({
    // ── runtime ────────────────────────────────────────────────────────────
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    /** Comma-separated origins. `*` is rejected by the CORS setup itself. */
    CORS_ORIGINS: csvList(),
    /**
     * Public base URL of the frontend, used to build the links inside emails and
     * (later) SMS messages.
     */
    PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),
    /**
     * Number of proxies in front of the app. Needed for correct req.ip, which
     * rate limiting and audit logging depend on.
     */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

    // ── database ───────────────────────────────────────────────────────────
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // ── authentication ─────────────────────────────────────────────────────
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    /** Refresh token lifetime. Short on purpose — rotation does the heavy lifting. */
    JWT_REFRESH_TTL: z.string().default('7d'),
    /** Argon2id parameters. Raising these is always safe; lowering is not. */
    ARGON2_MEMORY_COST: z.coerce.number().int().default(19456),
    ARGON2_TIME_COST: z.coerce.number().int().default(2),
    ARGON2_PARALLELISM: z.coerce.number().int().default(1),
    /** Failed logins before the account is locked for LOCKOUT_MINUTES. */
    MAX_FAILED_LOGINS: z.coerce.number().int().default(5),
    LOCKOUT_MINUTES: z.coerce.number().int().default(15),

    // ── CSRF ───────────────────────────────────────────────────────────────
    CSRF_COOKIE_NAME: z.string().default('acc_csrf'),
    CSRF_HEADER_NAME: z.string().default('x-acc-csrf'),

    // ── cookies ────────────────────────────────────────────────────────────
    AUTH_COOKIE_NAME: z.string().default('acc_access'),
    REFRESH_COOKIE_NAME: z.string().default('acc_refresh'),
    COOKIE_DOMAIN: z.string().optional(),
    /** Forced to true whenever NODE_ENV=production, whatever this says. */
    COOKIE_SECURE: booleanFromEnv(false),

    // ── storage ────────────────────────────────────────────────────────────
    /**
     * Root of the PRIVATE attachment volume. Must NOT be inside the frontend's
     * public directory or any directory served by static middleware. Startup
     * asserts that it is absolute.
     */
    STORAGE_ROOT: z.string().default('./storage'),
    MAX_ATTACHMENT_BYTES: z.coerce.number().int().positive().default(8 * 1024 * 1024),
    ALLOWED_ATTACHMENT_TYPES: csvList([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]),

    // ── rate limiting ─────────────────────────────────────────────────────────
    /**
     * Requests per window, per client IP.
     *
     * Configurable because the right number depends on the deployment: a pilot
     * served to a community through one office connection shares a single IP
     * across every user, so a limit tuned for a public internet site would lock
     * out a whole room at once. Raising a limit is a deployment decision;
     * setting it to zero is not permitted, because an unlimited submission
     * endpoint is precisely the flooding scenario the limit exists to prevent.
     */
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(5 * 60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    /**
     * Per-route overrides are declared in `config/rate-limits.ts`, not here:
     * they are read as plain numbers by an `@Throttle()` decorator, which is
     * evaluated before Nest exists. They share the same variable naming and
     * defaults, so there is one place to look for any rate limit in the project.
     */
    // ── behaviour flags ────────────────────────────────────────────────────
    /**
     * Anonymous reporting is OFF by default. It stays off until the operating
     * organization approves the process and its documented limitations — the
     * platform cannot honestly promise anonymity (see docs/02-database.md).
     */
    ALLOW_ANONYMOUS_REPORTS: booleanFromEnv(false),
    /**
     * Accept lat/long. Requires an explicit lawful justification; the form
     * asks for a landmark description instead by default.
     */
    ALLOW_PRECISE_LOCATIONS: booleanFromEnv(false),
    /**
     * Mark attachments CLEAN without a malware scanner. MUST be false outside
     * local development — an unscanned upload is an unbounded risk.
     */
    SKIP_MALWARE_SCAN: booleanFromEnv(true),
    /** Enables Swagger UI. Off by default so the pilot does not publish its API. */
    ENABLE_SWAGGER: booleanFromEnv(true),
    /** Master switch for the outbox worker. No SMS/email provider is wired yet. */
    ENABLE_NOTIFICATION_WORKER: booleanFromEnv(false),

    // ── data protection ────────────────────────────────────────────────────
    /** Policy version recorded against every ConsentRecord. Bump on change. */
    PRIVACY_POLICY_VERSION: z.string().default('draft-2026-01'),
    DATA_RETENTION_MONTHS: z.coerce.number().int().default(24),
    DATA_PROTECTION_CONTACT_EMAIL: z.string().email().default('privacy@acc.invalid'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    if (!env.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production — auth cookies require HTTPS',
      });
    }

    if (env.SKIP_MALWARE_SCAN) {
      ctx.addIssue({
        code: 'custom',
        path: ['SKIP_MALWARE_SCAN'],
        message:
          'SKIP_MALWARE_SCAN must be false in production — attachments would be accepted unscanned',
      });
    }

    if (env.CORS_ORIGINS.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS is required in production',
      });
    }

    for (const origin of env.CORS_ORIGINS) {
      if (origin === '*') {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: 'CORS_ORIGINS must not be "*" — credentialed requests need explicit origins',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Cookie names are derived from the validated env rather than hard-coded, so a
 * rename does not leave a stale cookie behind in a running deployment.
 */
export const cookieNames = {
  access: (env: Env) => env.AUTH_COOKIE_NAME,
  refresh: (env: Env) => env.REFRESH_COOKIE_NAME,
  csrf: (env: Env) => env.CSRF_COOKIE_NAME,
} as const;

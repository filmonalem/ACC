import { envSchema, type Env } from './env.schema';

/**
 * Validate `process.env` and return the typed result.
 *
 * Lives in its own module because three places need it before Nest is running:
 * `ThrottlerModule.forRoot` in `app.module.ts` is evaluated at import time, the
 * `ACC_ENV` provider resolves during module initialisation, and `main.ts` needs
 * the port before it can create the application at all. One implementation means
 * the values those three see cannot disagree.
 *
 * A failure lists every problem at once and stops the process. Starting with a
 * weak JWT secret is worse than not starting, so there is no development
 * fallback secret and no silent default for anything security-relevant.
 */
let cached: Env | null = null;

export function parseEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Invalid environment configuration:\n${details}\n\n` +
        'See backend/.env.example for every variable and what it does.',
    );
  }

  cached = parsed.data;
  return parsed.data;
}
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { parseEnv } from './parse-env';
import type { Env } from './env.schema';

/**
 * The validated configuration, exposed to the whole application as `'ACC_ENV'`.
 *
 * Nest's `ConfigService` is typed as `Record<string, unknown>`, which quietly
 * pushes unvalidated `process.env` reads back into the codebase and makes every
 * `config.get('SOME_TYPO')` silently `undefined`. Exposing one narrow, typed
 * object injected as `'ACC_ENV'` means a variable that was never validated at
 * startup simply cannot be read.
 *
 * The parse itself lives in `parse-env.ts` so that `app.module.ts` (which needs
 * the rate-limit table before Nest exists), this provider, and `main.ts` all
 * read the same validated result. `parseEnv` memoises, so calling it from several
 * places costs one parse.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      /**
       * Hands ConfigModule the same validated object, so a `ConfigService.get()`
       * is typed-correct too rather than only the `'ACC_ENV'` token.
       */
      validate: () => parseEnv() as unknown as Record<string, unknown>,
    }),
  ],
  providers: [
    {
      provide: 'ACC_ENV',
      useFactory: (): Env => parseEnv(),
    },
  ],
  exports: ['ACC_ENV', NestConfigModule],
})
export class ConfigModule {}
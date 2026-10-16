import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import type { Env } from '../config/env.schema';

/**
 * Prisma client with an explicit `pg` driver adapter.
 *
 * Prisma 7 no longer bundles an engine, so the connection is supplied by the
 * host application. Keeping that in one place means every caller — services,
 * tests, scripts — shares identical pool and lifecycle behaviour.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  // `@Inject('ACC_ENV')` is required rather than inferred: `Env` is a plain
  // interface, so its runtime type is `Object` and Nest has no token to resolve.
  constructor(@Inject('ACC_ENV') env: Env) {
    super({
      adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
      log:
        env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'warn' },
              { emit: 'event', level: 'error' },
            ]
          : [{ emit: 'event', level: 'error' }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Readiness probe used by `/api/v1/health/ready`.
   *
   * Runs a real round trip rather than a cached flag, so the probe reflects the
   * database the next request will actually use.
   */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}

import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import type { Env } from '../../config/env.schema';
import { Public } from '../../common/decorators/auth.decorators';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject('ACC_ENV') private readonly env: Env,
  ) {}

  /**
   * Liveness. Answers as long as the process can serve HTTP — deliberately
   * touches nothing else, so a database outage does not cause an orchestrator
   * to kill and restart otherwise-healthy containers.
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return {
      status: 'ok',
      service: 'acc-api',
      environment: this.env.NODE_ENV,
      time: new Date().toISOString(),
    };
  }

  /**
   * Readiness. Actually checks the dependencies this process needs: a database
   * round trip and a writable attachment volume. A ready service that cannot
   * accept a report would turn a partial outage into a total one.
   */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — checks database and storage' })
  async ready() {
    const checks = await Promise.allSettled([
      this.prisma.ping(),
      this.storage.assertWritable(),
    ]);

    const database = checks[0].status === 'fulfilled' ? 'ok' : 'unavailable';
    const storage = checks[1].status === 'fulfilled' ? 'ok' : 'unavailable';

    const ready = database === 'ok' && storage === 'ok';

    // No detail about *why* on failure — an unauthenticated caller should not
    // learn whether the database or the volume is the problem.
    if (!ready) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        database,
        storage,
      });
    }

    return { status: 'ok', database, storage, time: new Date().toISOString() };
  }
}

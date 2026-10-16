import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global so every module reaches the same client and therefore the same
 * connection pool. Creating a PrismaClient per module would multiply the pool
 * size by the module count and exhaust Postgres connections.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}

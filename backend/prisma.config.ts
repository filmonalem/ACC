import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration.
 *
 * The datasource URL no longer lives in schema.prisma; it is configured here.
 *
 * Prisma 7 does not auto-load `.env`, so we read it here. Variables already
 * present in the environment always win — that is how CI points the CLI at the
 * test database:
 *
 *   DATABASE_URL=postgresql:///acc_test?host=/var/run/postgresql npm run db:deploy
 */
function loadLocalEnv(): void {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadLocalEnv();

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Direct connection for the CLI (migrate / generate / studio). The runtime
    // client builds its own driver adapter in PrismaService.
    url: process.env.DATABASE_URL ?? '',
  },
});

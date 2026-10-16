/**
 * Refuses to let a truncating suite run against a database that is not
 * obviously disposable.
 *
 * Why this exists
 * ---------------
 * `test-fixtures.ts` empties `Report`, `ReportAttachment`, `Notification`,
 * `ConsentRecord` and `AuditLog` unconditionally, before it has looked at
 * anything. The e2e suite gets its connection string from `.env` — the same
 * file the development server uses — so `DATABASE_URL=…/acc_dev npm run
 * test:e2e`
 *
 *   deleted 4 reports and 16 audit-log rows from the development database,
 *   with no prompt, no warning and a green result.
 *
 * That is the worst possible failure mode for a suite holding community safety
 * reports: it succeeds, and the data is gone. The cost of being wrong here is a
 * developer who has to restore a dump; the cost of the guard being
 * inconvenient is setting one environment variable. So the guard is on.
 *
 * The override exists because a legitimate disposable database need not be
 * named `*test*` — but it is opt-in, explicit, and named for what it permits.
 */

/** Set to `true` to run against a database whose name does not contain "test". */
const OVERRIDE_VARIABLE = 'ALLOW_DESTRUCTIVE_TESTS';

/**
 * Extract the database name from a PostgreSQL connection string.
 *
 * `URL` handles both shapes that appear in this project:
 *
 *   postgresql://user:pass@host:5432/acc_dev?schema=public
 *   postgresql:///acc_test?host=/var/run/postgresql   (peer/socket auth)
 *
 * Returns `null` rather than guessing when the name cannot be determined —
 * an unparseable URL is a reason to stop, not to assume the best case.
 */
function databaseName(rawUrl: string): string | null {
  try {
    const { pathname } = new URL(rawUrl);
    const name = decodeURIComponent(pathname).replace(/^\//, '');

    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

export function assertDisposableDatabase(rawUrl: string | undefined, suiteName: string): void {
  if (!rawUrl) {
    throw new Error(
      `${suiteName} needs DATABASE_URL. It truncates tables, so it must be pointed at a ` +
        'disposable database — see docs/04-setup.md.',
    );
  }

  const name = databaseName(rawUrl);

  if (name === null) {
    throw new Error(
      `${suiteName} could not read a database name out of DATABASE_URL. Refusing to run, ` +
        'because this suite deletes every row in several tables and "cannot tell which database ' +
        'this is" is not a safe reason to delete anything.',
    );
  }

  if (/test/i.test(name)) return;

  if (process.env[OVERRIDE_VARIABLE] === 'true') {
    return;
  }

  throw new Error(
    `${suiteName} refuses to run against database "${name}".\n` +
      `\n` +
      'This suite truncates Report, ReportAttachment, Notification, ConsentRecord and\n' +
      'AuditLog. Point DATABASE_URL at a disposable database whose name contains "test",\n' +
      'or set ALLOW_DESTRUCTIVE_TESTS=true if you are certain this one is disposable.\n' +
      '\n' +
      'Running the suite against a development database deletes its reports and its audit\n' +
      'trail, and still reports success.',
  );
}
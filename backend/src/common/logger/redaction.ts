/**
 * Redaction.
 *
 * Two independent rules apply to anything that leaves the process as a log line
 * or an error body:
 *
 *  1. **Key-based.** Any key that plausibly holds a secret or personal data is
 *     replaced wholesale, regardless of its value. Matching is case-insensitive
 *     and substring-based so `reporterPhone` and `REPORTER_PHONE` are both caught.
 *
 *  2. **Route-based.** Report and staff routes are treated as sensitive in their
 *     entirety — on `/api/v1/reports` the request body is never logged at all.
 *     A free-text report description is personal data about someone who may be
 *     in danger, and log storage is not an appropriate place for it.
 *
 * This is deliberately an allowlist-in-spirit but denylist-in-practice: it is
 * easier to audit "what did we forget to redact" against a short list than
 * against an unbounded set of field names.
 */

/** Substrings that mark a key as secret. Compared lowercased. */
const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'csrf',
  'session',
  'apikey',
  'api_key',
  'privatekey',
  'private_key',
  'recoverycode',
  'recovery_code',
  'mfasecret',
  'mfa_secret',
  'totp',

  // Personal data
  'phone',
  'email',
  'fullname',
  'full_name',
  /**
   * Name-bearing keys are listed individually rather than by adding a bare
   * `'name'` fragment. A resident's name is personal data; `organizationName`,
   * `categoryName` and `slugName` are not, and redacting every `*Name` field
   * would quietly strip most of a useful log line — which is how redaction ends
   * up disabled altogether. These are the keys that actually hold a person.
   */
  'reportername',
  'reporter_name',
  'requestername',
  'requester_name',
  'contactname',
  'contact_name',
  'assignedtoname',
  'nationalid',
  'national_id',
  'description',
  'body',
  'resolutionnote',
  'rejectionreason',
  'landmark',
  'latitude',
  'longitude',
  'address',
  'identity',
  'ip',
  'ipaddress',
  'useragent',
];

/** Route prefixes whose payloads are never logged, whatever the keys look like. */
const SENSITIVE_ROUTE_FRAGMENTS = [
  '/api/v1/reports',
  '/api/v1/admin/reports',
  '/api/v1/auth',
  '/api/v1/admin/users',
  '/api/v1/admin/audit-logs',
  '/api/v1/privacy-requests',
];

export const REDACTED = '[redacted]';

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

/**
 * Deep-redact a value for logging.
 *
 * Bounded by depth and breadth so a hostile or accidentally huge payload cannot
 * turn a log call into an out-of-memory event.
 */
export function redact(value: unknown, depth = 0, breadth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 6 || breadth > 200) return '[truncated]';

  if (typeof value === 'string') {
    return value.length > 300 ? `${value.slice(0, 300)}…[truncated]` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: value.message };

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redact(item, depth + 1, breadth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redact(item, depth + 1, breadth + 1);
    }
    return out;
  }

  return '[unserialisable]';
}

/** True when the route itself is sensitive enough that nothing may be logged. */
export function isSensitiveRoute(url: string): boolean {
  return SENSITIVE_ROUTE_FRAGMENTS.some((fragment) => url.startsWith(fragment));
}

/**
 * Strip anything that looks like a secret out of an error message before it is
 * shown to a client.
 *
 * Unexpected errors reach the filter with stack traces, SQL fragments and
 * occasionally connection strings attached. None of that should reach a
 * resident's browser.
 */
export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[database connection redacted]')
    .replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, '[token redacted]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip redacted]')
    .replace(/\/[^\s"']+\/(?:[^\s"']+)/g, '[path redacted]')
    .slice(0, 300);
}

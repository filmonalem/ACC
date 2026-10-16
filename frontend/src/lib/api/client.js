/**
 * API client.
 *
 * One place that knows how to talk to the backend, because the details that
 * matter for safety are easy to get subtly wrong and impossible to review when
 * they are spread across components:
 *
 *  - **CSRF.** Staff mutations require the token to be echoed in a header. It is
 *    read from the non-httpOnly cookie automatically, so a caller cannot forget.
 *  - **Idempotency.** Report submission sends a key generated once per draft and
 *    reused across retries, so a dropped connection cannot create two reports.
 *  - **Timeouts.** A request on a slow connection must fail in a way the UI can
 *    explain, not hang until the browser gives up much later.
 *  - **Errors.** Every failure becomes an `ApiError` carrying the server's own
 *    error code, so a form can show "that code does not match" rather than a
 *    generic failure — and so no component has to parse a raw response.
 *
 * Nothing here retries automatically except where a retry is provably safe:
 * see `submitReport`, which relies on the idempotency key rather than on hope.
 */

import { API_BASE_URL } from './base-url';

export { API_BASE_URL };

export class ApiError extends Error {
  constructor(message, { status, code, requestId, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status ?? 0;
    this.code = code ?? 'unknown_error';
    this.requestId = requestId ?? null;
    this.details = details ?? null;
  }

  /** True when the request never reached the server. */
  get isNetworkError() {
    return this.status === 0;
  }

  get isRateLimited() {
    return this.status === 429;
  }
}

/**
 * Reads the CSRF token from its cookie.
 *
 * The cookie is deliberately readable by script: the server compares it against
 * the header, and a cross-origin attacker cannot read it to forge the pair.
 */
function readCookie(name) {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Generates an idempotency key for a submission.
 *
 * `crypto.randomUUID` is used where available and the result falls back to
 * `crypto.getRandomValues`. A Math.random fallback is deliberately not provided:
 * a predictable idempotency key is worse than none, because it would let one
 * resident's retry collide with another's report.
 */
export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  throw new Error('No secure random source available; cannot build an idempotency key.');
}

async function request(path, { method = 'GET', body, headers = {}, signal, timeoutMs = 20_000 } = {}) {
  const url = `${API_BASE_URL}${path}`;

  // An AbortController rather than relying on the browser default: the default
  // is long enough that a resident sees a frozen form rather than an error.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const csrfToken = readCookie('acc_csrf');
  const isMutation = method !== 'GET' && method !== 'HEAD';

  try {
    const response = await fetch(url, {
      method,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        // Only sent on mutations, and only when a token exists — a public
        // resident request has no session and no token to send.
        ...(isMutation && csrfToken ? { 'x-acc-csrf': csrfToken } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        // A non-JSON body from the API means something upstream is wrong
        // (a proxy error page, say). Surfacing that as a generic failure is
        // more honest than trying to parse HTML as JSON.
        throw new ApiError('The server returned an unexpected response.', {
          status: response.status,
          code: 'malformed_response',
        });
      }
    }

    if (!response.ok) {
      throw new ApiError(payload?.error?.message ?? 'Something went wrong.', {
        status: response.status,
        code: payload?.error?.code,
        requestId: payload?.error?.requestId,
        details: payload?.error?.details,
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error?.name === 'AbortError') {
      throw new ApiError('The connection is too slow or was interrupted.', {
        code: 'request_timeout',
      });
    }

    // Deliberately does not include the underlying message: it can contain a
    // hostname or an internal address, and this is shown to a resident.
    throw new ApiError('Could not reach the server. Check your connection.', {
      code: 'network_error',
    });
  } finally {
    clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Public endpoints
// ═══════════════════════════════════════════════════════════════════════════

export function fetchReportCategories(locale) {
  return request(`/report-categories`, { headers: { 'Accept-Language': locale } });
}

export function fetchContacts({ locale = 'en', category, search, emergencyOnly } = {}) {
  const params = new URLSearchParams();
  if (locale) params.set('locale', locale);
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  if (emergencyOnly) params.set('emergencyOnly', 'true');

  return request(`/contacts?${params.toString()}`);
}

export function fetchAnnouncements({ locale = 'en', category, search, page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams({ locale, page: String(page), pageSize: String(pageSize) });
  if (category) params.set('category', category);
  if (search) params.set('search', search);

  return request(`/announcements?${params.toString()}`);
}

export function fetchAnnouncement(slug, locale = 'en') {
  return request(`/announcements/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`);
}

export function fetchSupportServices({ locale = 'en', category, search } = {}) {
  const params = new URLSearchParams();
  if (locale) params.set('locale', locale);
  if (category) params.set('category', category);
  if (search) params.set('search', search);

  return request(`/support-services?${params.toString()}`);
}

/**
 * Submits a report.
 *
 * `idempotencyKey` is required by the caller rather than generated here, because
 * the whole point is that the *same* key is reused across retries of the *same*
 * draft. Generating a fresh key per call would make a retry create a second
 * report — the exact failure this prevents.
 */
export function submitReport(payload, idempotencyKey) {
  return request('/reports', {
    method: 'POST',
    body: payload,
    headers: { 'Idempotency-Key': idempotencyKey },
    // Submission writes a row and an audit entry; the default timeout is not
    // generous enough for that on a slow connection.
    timeoutMs: 30_000,
  });
}

/**
 * Looks up the status of a report.
 *
 * `locale` is sent explicitly rather than negotiated via `Accept-Language`. The
 * response contains a plain-language explanation of what is happening to the
 * resident's report, and a proxy or CDN overriding the header would silently
 * serve it in a language the reader did not choose.
 */
export function lookupReportStatus(referenceCode, statusToken, locale) {
  const params = new URLSearchParams({ statusToken });
  if (locale) params.set('locale', locale);
  return request(`/reports/${encodeURIComponent(referenceCode)}/status?${params.toString()}`);
}

export function submitPrivacyRequest(payload) {
  return request('/privacy-requests', { method: 'POST', body: payload, timeoutMs: 30_000 });
}

// ═══════════════════════════════════════════════════════════════════════════
// Staff endpoints
//
// These exist so the dashboard is not reimplementing fetch. Each is thin on
// purpose; the interesting behaviour is in the guards on the server.
// ═══════════════════════════════════════════════════════════════════════════

export const staffApi = {
  login: (email, password, mfaCode) =>
    request('/auth/login', {
      method: 'POST',
      body: { email, password, ...(mfaCode ? { mfaCode } : {}) },
    }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  me: () => request('/auth/me'),

  beginMfa: () => request('/auth/mfa/begin', { method: 'POST' }),

  confirmMfa: (code, secret) =>
    request('/auth/mfa/confirm', { method: 'POST', body: { code, secret } }),

  listReports: (filters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    return request(`/admin/reports?${params.toString()}`);
  },

  getReport: (id) => request(`/admin/reports/${encodeURIComponent(id)}`),

  updateStatus: (id, status, reason) =>
    request(`/admin/reports/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { status, ...(reason ? { reason } : {}) },
    }),

  triage: (id, payload) =>
    request(`/admin/reports/${encodeURIComponent(id)}/triage`, {
      method: 'POST',
      body: payload,
    }),

  addNote: (id, body) =>
    request(`/admin/reports/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      body: { body },
    }),

  assign: (id, assigneeId, note) =>
    request(`/admin/reports/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      body: { assigneeId, ...(note ? { note } : {}) },
    }),

  availableTransitions: (id) =>
    request(`/admin/reports/${encodeURIComponent(id)}/available-transitions`),

  listContacts: () => request('/admin/contacts'),

  publishContact: (id) => request(`/admin/contacts/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
};

/**
 * Whether the browser reports an online connection.
 *
 * Only ever used to decide whether to *offer* a retry, never to decide whether a
 * submission succeeded. `navigator.onLine` reports whether a network interface
 * exists, not whether a request can reach the server — treating it as
 * authoritative is how a UI ends up telling a resident their report was sent
 * when it was not.
 */
export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}
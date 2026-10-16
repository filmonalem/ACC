/**
 * Where the API is, for the browser and for the server — which are not the same
 * answer once the pilot is deployed.
 *
 * The problem this solves
 * ----------------------
 * Resident pages and the staff dashboard call the API from the browser. Staff
 * calls carry `SameSite=Strict` session cookies (`auth.controller.ts`), and
 * SameSite is judged on the *site* — the registrable domain — not the origin. So
 * a frontend on `acc.vercel.app` talking to an API on `api.myhost.com` is
 * cross-site, the cookies are never attached, and staff sign-in fails silently
 * and permanently. The CSRF cookie is `httpOnly: false` but lives on the API's
 * domain, so the frontend cannot read it either, and the double-submit has no
 * second half.
 *
 * Two ways out, and both are supported:
 *
 * 1. **Same origin (recommended).** Set `NEXT_PUBLIC_API_BASE_URL=/api/v1` and
 *    `API_ORIGIN=https://api.example.com`. The browser calls `/api/v1` on its
 *    own origin; `next.config.mjs` rewrites that path to the backend. Same
 *    origin means SameSite is trivially satisfied and CORS never arises.
 *
 * 2. **Split origins on one domain.** Set
 *    `NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1`. No rewrite is
 *    used; cookies work because `example.com` is a single site. CORS still has
 *    to list the frontend origin explicitly — the API rejects `"*"`.
 *
 * A relative value with no `API_ORIGIN` is a misconfiguration, not a default to
 * paper over: server components would resolve it to a relative URL, which
 * `fetch` cannot parse, and every page would quietly render empty.
 */

function trim(value) {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

const configured = trim(process.env.NEXT_PUBLIC_API_BASE_URL);

/** True when the configured value names a host, i.e. a split-origin deployment. */
const isAbsolute = /^https?:\/\//i.test(configured);

/**
 * The API base the **browser** uses.
 *
 * In proxy mode this is deliberately relative. It is the value baked into the
 * client bundle, so it must not depend on a server-only variable — `API_ORIGIN`
 * is not available in the browser, and baking it in would hard-code a hostname
 * that a preview deployment cannot change.
 */
export const API_BASE_URL = configured || 'http://localhost:4000/api/v1';

/** True when the browser should talk to its own origin and let the rewrite proxy. */
export const USES_REWRITE_PROXY = !isAbsolute;

/**
 * The API base **server components** use.
 *
 * A server-side `fetch` needs an absolute URL. In proxy mode the rewrite only
 * applies to inbound HTTP requests, not to `fetch` calls made during rendering,
 * so server components must address the backend directly.
 */
export const API_SERVER_BASE_URL = (() => {
  if (isAbsolute) return configured;

  const origin = trim(process.env.API_ORIGIN);

  if (origin) return `${origin}${API_BASE_URL}`;

  // Development with no configuration: localhost is what the backend is on.
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:4000/api/v1';
  }

  /**
   * On Vercel this is a misconfiguration, and it is stopped.
   *
   * The alternative — falling through to localhost — produces a site where every
   * server-rendered page is silently empty. For the report form that means an
   * empty set of category radio buttons, which reads to a resident as their own
   * fault. A build that fails with a specific message is the better outcome.
   *
   * Locally it is only a warning, because a build legitimately happens without a
   * running backend — CI, a typecheck, a prerender on a laptop. Failing there
   * would mean every developer and every CI run had to invent an API_ORIGIN in
   * order to run `npm run build`, which is a tax that buys nothing.
   */
  if (process.env.VERCEL) {
    throw new Error(
      'NEXT_PUBLIC_API_BASE_URL is a relative path and API_ORIGIN is not set.\n' +
        'The browser can reach /api/v1 through the rewrite proxy, but server components ' +
        'cannot: a relative URL is not parseable by fetch, so every server-rendered page ' +
        'would render empty rather than fail.\n' +
        '\n' +
        'Set API_ORIGIN to the absolute origin of the API, e.g. API_ORIGIN=https://api.example.com\n' +
        'or make NEXT_PUBLIC_API_BASE_URL absolute to use split origins instead.',
    );
  }

  console.warn(
    '[ACC] API_ORIGIN is not set and NEXT_PUBLIC_API_BASE_URL is relative; server components ' +
      'will fall back to http://localhost:4000 and render empty. Set API_ORIGIN before deploying.',
  );

  return 'http://localhost:4000/api/v1';
})();
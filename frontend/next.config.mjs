/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * The API is a separate service, and how the browser reaches it has two
   * supported shapes — see `src/lib/api/base-url.js` for the reasoning.
   *
   * The default differs by environment, and that asymmetry is deliberate:
   *
   *  - **Development** defaults to the absolute `localhost:4000` address. The
   *    browser calls the backend directly with no proxy in the path, which keeps
   *    a cookie- or path-rewriting proxy out of local development entirely.
   *
   *  - **Production** defaults to the relative `/api/v1`, so the rewrite proxy
   *    handles the API and staff session cookies stay same-site. It deliberately
   *    does *not* default to `localhost`: baking a loopback address into a
   *    production bundle produces a site whose every request fails in a way that
   *    looks like an outage at the other end. In relative mode a missing
   *    `API_ORIGIN` makes the build fail with a specific message instead, which
   *    is the failure we actually want.
   */
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      (process.env.NODE_ENV === 'production' ? '/api/v1' : 'http://localhost:4000/api/v1'),
  },

  /**
   * Same-origin proxy to the API.
   *
   * Only active when `NEXT_PUBLIC_API_BASE_URL` is a *relative* path, which is
   * the recommended deployment: the browser calls `/api/v1` on its own origin and
   * this rule forwards it to the backend.
   *
   * This is what makes staff sign-in possible. The session cookies are
   * `SameSite=Strict`, and SameSite is evaluated against the site — the
   * registrable domain — so a frontend on `acc.vercel.app` reaching an API on
   * `api.myhost.com` is cross-site: the cookies are never attached, the login
   * fails silently and permanently, and CORS cannot rescue it because the
   * request never carries the credentials to authorise. Proxying collapses the
   * two to one origin, so the problem cannot arise and no CORS preflight is
   * involved at all.
   *
   * `API_ORIGIN` is a server-side variable and is never exposed to the browser,
   * which is why server components address the backend directly instead — see
   * `src/lib/api/base-url.js`.
   */
  async rewrites() {
    const configured = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').trim();
    const origin = (process.env.API_ORIGIN ?? '').trim().replace(/\/+$/, '');

    // An absolute value means split origins; the browser already reaches the
    // backend directly and a proxy would only add latency and a second failure
    // point.
    if (!origin || /^https?:\/\//i.test(configured)) return [];

    const path = configured.replace(/^\/+/, '').replace(/\/+$/, '') || 'api/v1';

    return [{ source: `/${path}/:path*`, destination: `${origin}/${path}/:path*` }];
  },

  /**
   * Security headers.
   *
   * Set here rather than left to the reverse proxy so the policy is reviewable
   * next to the code and travels with the build. The API sets its own headers;
   * these govern the HTML the browser executes.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // `unsafe-inline` is required by Next's own bootstrap scripts. The page
          // contains no user-authored HTML, and the CSP frame options below are
          // what actually matter for an application like this one.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              // The API is a different origin in development, where it runs on
              // port 4000. In a deployed pilot the rewrite proxy makes it this
              // origin, so 'self' is sufficient and nothing else needs allowing.
              "connect-src 'self' http://localhost:4000",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join('; '),
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // The service worker must never be cached, or a stale one keeps
          // serving an old application shell indefinitely.
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
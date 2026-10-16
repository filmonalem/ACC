/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * The API is a separate service. In development it runs on port 4000, so the
   * browser is pointed at it directly rather than proxying — a proxy that
   * forwards cookies but not their `Secure` flag, or that rewrites paths, is a
   * class of bug better avoided entirely in development.
   *
   * In a deployed pilot both sit behind one origin behind TLS, and
   * `NEXT_PUBLIC_API_BASE_URL` is the same public address, so no CORS preflight
   * is involved at all.
   */
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1',
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
              // The API is a different origin in development; a deployed pilot
              // puts both behind one address, where 'self' is sufficient.
              "connect-src 'self' http://localhost:4000 https:",
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
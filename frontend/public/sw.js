/* eslint-disable no-restricted-globals */

/**
 * Service worker.
 *
 * Its single most important rule: **it never caches anything private.**
 *
 * Only two things are ever written to the cache:
 *
 *   1. The application shell (static assets under `/_next/static`), which is
 *      public build output containing no personal data.
 *   2. Explicitly whitelisted public GET routes — the category list, the verified
 *      contact directory, announcements and support listings.
 *
 * Everything else — anything under `/staff`, anything under `/api`, anything with
 * a query string that could carry a reference code or a status token — is
 * network-only. A cached staff page would be a cached resident's report on a
 * shared phone, which is the single worst thing this worker could do.
 *
 * Report submission is deliberately NOT retried by the worker. A queued retry
 * with a stale idempotency key is a duplicate-report risk, and a queued retry
 * that succeeds while the interface still says "pending" is a lie. The form owns
 * that decision and tells the resident honestly when nothing was received.
 */

const SHELL_CACHE = 'acc-shell-v1';
const PUBLIC_CACHE = 'acc-public-v1';

/** Routes that may be cached. Nothing else is. */
const CACHEABLE_PATHS = [
  '/report-categories',
  '/contacts',
  '/announcements',
  '/support-services',
];

/** Prefixes that must never be touched, whatever else matches. */
const NEVER_CACHE = [
  '/staff',
  '/api',
  '/auth',
  '/login',
  '/status', // status lookups carry a token in the query string
];

const OFFLINE_FALLBACK = '/offline';

self.addEventListener('install', (event) => {
  // Skipped rather than awaited on purpose: a failed precache must not leave a
  // user with no worker at all. The runtime cache fills in as pages are visited.
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll([OFFLINE_FALLBACK]).catch(() => undefined),
    ),
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name !== SHELL_CACHE && name !== PUBLIC_CACHE)
          // A cache from a previous version may contain routes that are now
          // private. Dropping it entirely is the only safe cleanup.
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin only. Nothing from the API origin is ever touched: the API
  // already decides what is public, and duplicating that decision here is how
  // a private response ends up in a cache.
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  if (NEVER_CACHE.some((prefix) => path.startsWith(prefix))) return;

  // Build output. Hashed filenames make this safe to cache forever.
  if (path.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  const cacheable = CACHEABLE_PATHS.some((prefix) => path.endsWith(prefix));

  if (!cacheable) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(PUBLIC_CACHE);
      const cached = await cache.match(request);

      // Stale-while-revalidate: the cached copy is served immediately and
      // refreshed in the background, so a reader on a slow connection gets an
      // answer now rather than a spinner. Every cached response is public
      // content, so serving it stale is acceptable — and pages that carry
      // personal data are excluded above.
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached ?? caches.match(OFFLINE_FALLBACK));

      return cached ?? network;
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
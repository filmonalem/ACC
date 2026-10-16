import { NextResponse } from 'next/server';

import { defaultLocale, isLocale, locales } from '@/lib/i18n/config';

/**
 * Redirects every request to a locale-prefixed URL.
 *
 * The locale is a **path segment**, not a cookie. Three reasons, in order of
 * importance:
 *
 *  1. A link shared with a neighbour opens in *their* language rather than in
 *     whatever language the sender happened to have selected. That is the whole
 *     point of supporting three languages.
 *  2. A page cached by an intermediary serves one language, not whichever
 *     visitor happened to be there when it was cached.
 *  3. The server can render the correct `lang` attribute, font and text
 *     direction on the first paint, so nothing flickers from English to
 *     Tigrinya after the page has already appeared.
 *
 * A cookie is still used, but only to remember the choice for a bare `/` visit.
 */

const PUBLIC_FILE = /\.[a-zA-Z0-9]+$/;

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Never touch Next's own assets or the API's routes. Rewriting those would
  // break static files and produce 404s for anything not already prefixed.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/sw.js') ||
    pathname.startsWith('/manifest') ||
    pathname === '/favicon.ico' ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (hasLocale) return NextResponse.next();

  // A bare root: send the visitor to the language they chose last, or English.
  const preferred = request.cookies.get('acc_locale')?.value;
  const locale = isLocale(preferred) ? preferred : defaultLocale;

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
'use client';

import { useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { htmlLang, localeNames, locales } from '@/lib/i18n/config';
import { NAV_ITEMS } from './nav-items';
import { FileTextIcon, GlobeIcon, MenuIcon, XIcon } from './icons';

/**
 * The interactive chrome: sticky header, navigation, language switcher.
 *
 * A Client Component because it owns the mobile menu's open flag and performs a
 * client-side route change on language switch. Everything it renders is
 * otherwise plain markup, so the JavaScript shipped is confined to exactly this.
 */

/** Strips a leading locale segment so a switch can re-prefix the same page. */
function withoutLocale(pathname, fallbackLocale) {
  const match = pathname.replace(new RegExp(`^/(${locales.join('|')})(?=/|$)`), '');
  return match === pathname && pathname.startsWith('/') ? pathname.slice(1) : match;
}

/**
 * Switches language while staying on the current page.
 *
 * Reading `/ti/contacts` and switching to Amharic lands on `/am/contacts`, not
 * on the homepage — a naive implementation drops the reader back to the start,
 * which is the sort of thing that makes someone give up.
 */
export function LanguageSwitcher({ locale, dict, variant = 'select' }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const target = withoutLocale(pathname, locale);

  function switchTo(next) {
    // Remembered so a later visit to the bare root opens in this language.
    // Deliberately not httpOnly: nothing reads it but this code.
    document.cookie = `acc_locale=${next}; path=/; max-age=31536000; samesite=lax`;
    router.push(`/${next}${target}`);
  }

  if (variant === 'links') {
    return (
      <ul className="flex items-center gap-1" aria-label={dict.common.changeLanguage}>
        {locales.map((code) => (
          <li key={code}>
            <Link
              href={`/${code}${target}`}
              hrefLang={htmlLang[code]}
              aria-current={code === locale ? 'true' : undefined}
              className={[
                'inline-flex items-center rounded-control px-3 py-2 text-sm font-semibold transition-colors',
                code === locale
                  ? 'bg-brand-100 text-brand-800'
                  : 'text-ink-muted hover:bg-brand-50 hover:text-brand-800',
              ].join(' ')}
            >
              {localeNames[code]}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="relative">
      <label htmlFor="language-switcher" className="sr-only">
        {dict.common.changeLanguage}
      </label>
      <GlobeIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      <select
        id="language-switcher"
        value={locale}
        onChange={(event) => switchTo(event.target.value)}
        className="select h-10 min-h-0 cursor-pointer py-0 pl-8 pr-8 text-sm font-semibold"
      >
        {locales.map((code) => (
          <option key={code} value={code} lang={htmlLang[code]}>
            {localeNames[code]}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Primary navigation.
 *
 * Rendered as an `<a>` rather than a `<Link>` on purpose: the header sits above a
 * cacheable, statically-generated shell, and a full navigation prefetch per link
 * would spend a resident's limited data on pages they probably will not open.
 */
export function DesktopNav({ locale, dict }) {
  return (
    <nav aria-label={dict.nav.menu}>
      <ul className="flex items-center gap-0.5">
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <a
              href={`/${locale}${item.href}`}
              className="rounded-control px-2.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-800 xl:px-3"
            >
              {dict.nav[item.key]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The mobile drawer. Rendered only when open, so it costs nothing when closed. */
export function MobileNav({ locale, dict, open, onNavigate }) {
  if (!open) return null;

  return (
    <div className="border-t border-border bg-surface lg:hidden">
      <nav aria-label={dict.nav.menu} className="mx-auto max-w-6xl px-4 py-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <li key={item.key}>
                <a
                  href={`/${locale}${item.href}`}
                  onClick={onNavigate}
                  className="flex items-center gap-3 rounded-control px-3 py-3 text-base font-medium text-ink transition-colors hover:bg-brand-50 hover:text-brand-800"
                >
                  <Icon className="h-5 w-5 text-brand-600" />
                  {dict.nav[item.key]}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="mt-3 border-t border-border pt-3">
          <a
            href={`/${locale}/status`}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-control px-3 py-3 text-base font-medium text-ink transition-colors hover:bg-brand-50 hover:text-brand-800"
          >
            <FileTextIcon className="h-5 w-5 text-brand-600" />
            {dict.nav.status}
          </a>
          <a
            href={`/${locale}/privacy`}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-control px-3 py-3 text-base font-medium text-ink transition-colors hover:bg-brand-50 hover:text-brand-800"
          >
            {dict.nav.privacy}
          </a>
        </div>
      </nav>
    </div>
  );
}

/** The sticky header. */
export function HeaderShell({ locale, dict, children }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6">
        <a href={`/${locale}`} className="flex shrink-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-700 text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-sm font-bold leading-tight text-ink">
              {dict.meta.title}
            </span>
            <span className="block truncate text-xs leading-tight text-ink-muted">
              {dict.meta.tagline}
            </span>
          </span>
        </a>

        <div className="hidden flex-1 items-center justify-end gap-4 lg:flex">
          <DesktopNav locale={locale} dict={dict} />
          <LanguageSwitcher locale={locale} dict={dict} />
        </div>

        <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:hidden">
          <div className="hidden sm:block">
            <LanguageSwitcher locale={locale} dict={dict} />
          </div>
          {children}
        </div>
      </div>
    </header>
  );
}

export { MenuIcon, XIcon, GlobeIcon };
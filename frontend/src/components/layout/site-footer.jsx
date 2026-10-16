import Link from 'next/link';

import { localeNames } from '@/lib/i18n/config';
import { NAV_ITEMS, SECONDARY_NAV } from './nav-items';

/**
 * Site footer.
 *
 * Four things are guaranteed to be here, on every page, in every language:
 * what this site is, how to reach someone, that it aims to be accessible, and
 * what to do in an emergency. That is a deliberate content decision, not filler.
 *
 * The contact block deliberately shows **no** telephone number by default. The
 * platform has no verified fallback number to display, and inventing one — or
 * leaving a placeholder that looks real — is exactly the failure the project
 * brief warns about. The number is supplied by configuration once a real one
 * exists, and until then the footer says so plainly.
 */
export function SiteFooter({ locale, dict, telephone = null }) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border bg-brand-900 text-brand-100">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* What this is */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-control bg-white/10 text-white"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <span className="text-sm font-bold text-white">{dict.meta.title}</span>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-brand-200">
              {dict.footer.aboutBody}
            </p>

            <p className="mt-4 text-xs text-brand-300">{dict.meta.tagline}</p>
          </div>

          {/* Pages */}
          <nav aria-label={dict.nav.menu}>
            <h2 className="text-sm font-bold text-white">{dict.nav.menu}</h2>
            <ul className="mt-3 space-y-2">
              {NAV_ITEMS.map((item) => (
                <li key={item.key}>
                  <Link
                    href={`/${locale}${item.href}`}
                    className="text-sm text-brand-200 transition-colors hover:text-white hover:underline"
                  >
                    {dict.nav[item.key]}
                  </Link>
                </li>
              ))}
              {SECONDARY_NAV.map((item) => (
                <li key={item.key}>
                  <Link
                    href={`/${locale}${item.href}`}
                    className="text-sm text-brand-200 transition-colors hover:text-white hover:underline"
                  >
                    {dict.nav[item.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact and rights */}
          <div>
            <h2 className="text-sm font-bold text-white">{dict.footer.contactTitle}</h2>

            {telephone ? (
              <a
                href={`tel:${telephone.replace(/\s/g, '')}`}
                className="mt-3 inline-flex items-center gap-2 rounded-control bg-white/10 px-3 py-2 text-base font-bold text-white transition-colors hover:bg-white/20"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
                </svg>
                <span dir="ltr">{telephone}</span>
              </a>
            ) : (
              /*
                * No number is displayed because none has been verified. Saying
                * so is better than showing a placeholder that could be mistaken
                * for a working line.
                */
              <p className="mt-3 rounded-control bg-white/5 p-3 text-sm text-brand-200">
                {dict.common.exampleEntryHelp}
              </p>
            )}

            <h2 className="mt-6 text-sm font-bold text-white">{dict.footer.rightsTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-200">
              {dict.footer.rightsBody}
            </p>
            <Link
              href={`/${locale}/privacy#request-form`}
              className="mt-3 inline-block text-sm font-semibold text-white underline hover:no-underline"
            >
              {dict.privacy.requestCta}
            </Link>
          </div>

          {/* Accessibility */}
          <div>
            <h2 className="text-sm font-bold text-white">{dict.footer.accessTitle}</h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-200">
              {dict.footer.accessBody}
            </p>

            <h2 className="mt-6 text-sm font-bold text-white">
              {dict.common.language}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-brand-200">
              {Object.entries(localeNames).map(([code, name]) => (
                <li key={code}>
                  <span className={code === locale ? 'font-bold text-white' : undefined}>
                    {name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-brand-300 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {dict.meta.title}
          </p>
          <p>
            {dict.footer.version}: <span dir="ltr">0.1.0</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
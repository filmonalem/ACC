import { notFound } from 'next/navigation';

import { getDictionary } from '@/lib/i18n/get-dictionary';
import { directionFor, htmlLang, isLocale, locales } from '@/lib/i18n/config';
import { SiteFooter } from '@/components/layout/site-footer';
import { EmergencyNotice } from '@/components/layout/emergency-notice';
import { ShellChrome } from '@/components/layout/shell-chrome';
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration';

/**
 * The per-locale layout: document, shell, header, emergency notice, footer.
 *
 * This is where `lang` and text direction are decided, which is why it sits
 * above every page rather than inside one of them. Getting it wrong is not
 * cosmetic — a screen reader picks its voice from `lang`, and Ethiopic rendered
 * with a Latin line-height and letter-spacing is measurably harder to read.
 *
 * `generateStaticParams` builds the three locale shells ahead of time. The
 * middleware guarantees only these three reach here, and `notFound()` catches
 * anything that slips past it.
 */

/** Pre-renders one shell per supported language. */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;

  if (!isLocale(locale)) return {};

  const dict = await getDictionary(locale);

  return {
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: '/en',
        ti: '/ti',
        am: '/am',
      },
    },
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      locale: htmlLang[locale],
      type: 'website',
    },
  };
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;

  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);

  /*
   * A verified fallback telephone number.
   *
   * Null by default and null on purpose: the platform has no confirmed
   * community emergency line. The footer and the bottom-of-page notice render a
   * plain-language explanation instead of a number until a real one is verified
   * and supplied through configuration. Inventing one, or shipping a
   * placeholder that looks real, is precisely what the brief forbids.
   */
  const telephone = process.env.NEXT_PUBLIC_EMERGENCY_TELEPHONE || null;

  return (
    <html lang={htmlLang[locale]} dir={directionFor(locale)}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only-focusable btn btn-primary btn-md absolute left-4 top-4 z-50">
          {dict.common.skipToContent}
        </a>

        <ShellChrome locale={locale} dict={dict}>
          <EmergencyNotice dict={dict} />

          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>

          <SiteFooter locale={locale} dict={dict} telephone={telephone} />

          <ServiceWorkerRegistration />
        </ShellChrome>
      </body>
    </html>
  );
}
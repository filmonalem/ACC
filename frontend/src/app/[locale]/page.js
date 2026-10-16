import Link from 'next/link';
import {
  ArrowRight,
  ClipboardList,
  FileText,
  HeartHandshake,
  Megaphone,
  Phone,
} from 'lucide-react';

import { EmergencyFooterNote, PrivacyReassurance } from '@/components/layout/emergency-notice';
import { API_SERVER_BASE_URL } from '@/lib/api/base-url';

/**
 * Homepage.
 *
 * Ordered by what a visitor is most likely to need, not by what is most
 * impressive:
 *
 *   1. What this is, and what it is not (the honest statement first)
 *   2. Emergency action
 *   3. The four things one can do here
 *   4. Live content — announcements and verified contacts
 *   5. How reporting works
 *   6. Privacy reassurance, and the telephone fallback at the very bottom
 *
 * The telephone fallback is last on purpose: a reader who scrolled this far and
 * found nothing useful must still be one glance from a number.
 */

export default async function HomePage({ params }) {
  const { locale } = await params;
  const dict = await getHomeDictionary(locale);

  const telephone = process.env.NEXT_PUBLIC_EMERGENCY_TELEPHONE || null;

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900">
        {/* A soft radial wash. Decorative only — it costs one element and gives
            the hero depth without an image request on a metered connection. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl"
        />

        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-brand-100">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-300" />
              {dict.meta.tagline}
            </p>

            <h1 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              {dict.home.heroTitle}
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-brand-100 sm:text-lg">
              {dict.home.heroBody}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={`/${locale}/report`}
                className="btn btn-accent btn-lg shadow-md"
              >
                <FileText className="h-5 w-5" />
                {dict.home.reportCta}
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href={`/${locale}/status`}
                className="btn btn-lg border-white/25 bg-white/10 text-white hover:bg-white/20"
              >
                <ClipboardList className="h-5 w-5" />
                {dict.home.checkCta}
              </Link>

              <Link
                href={`/${locale}/contacts`}
                className="btn btn-lg border-white/25 bg-transparent text-white hover:bg-white/10"
              >
                <Phone className="h-5 w-5" />
                {dict.home.emergencyCta}
              </Link>
            </div>
          </div>

          {/* Honest status, immediately below the calls to action. */}
          <div className="mt-10 max-w-3xl rounded-card border border-white/15 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
            <h2 className="text-sm font-bold text-white">{dict.home.disclaimerTitle}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-100">
              {dict.home.disclaimerBody}
            </p>
          </div>
        </div>
      </section>

      {/* ── Four things ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">
            {dict.home.featuresTitle}
          </h2>
          <p className="mt-2 text-ink-muted">{dict.home.featuresIntro}</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            href={`/${locale}/report`}
            icon={FileText}
            tone="brand"
            title={dict.home.featureReportTitle}
            body={dict.home.featureReportBody}
          />
          <FeatureCard
            href={`/${locale}/contacts`}
            icon={Phone}
            tone="accent"
            title={dict.home.featureContactsTitle}
            body={dict.home.featureContactsBody}
          />
          <FeatureCard
            href={`/${locale}/updates`}
            icon={Megaphone}
            tone="info"
            title={dict.home.featureUpdatesTitle}
            body={dict.home.featureUpdatesBody}
          />
          <FeatureCard
            href={`/${locale}/support`}
            icon={HeartHandshake}
            tone="brand"
            title={dict.home.featureSupportTitle}
            body={dict.home.featureSupportBody}
          />
        </div>
      </section>

      {/* ── Live content ──────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="grid gap-10 lg:grid-cols-2">
            <HomepageAnnouncements locale={locale} dict={dict} />
            <HomepageContacts locale={locale} dict={dict} />
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">
            {dict.home.processTitle}
          </h2>
          <p className="mt-2 text-ink-muted">{dict.home.processIntro}</p>
        </div>

        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: dict.home.step1Title, body: dict.home.step1Body },
            { title: dict.home.step2Title, body: dict.home.step2Body },
            { title: dict.home.step3Title, body: dict.home.step3Body },
            { title: dict.home.step4Title, body: dict.home.step4Body },
          ].map((step, index) => (
            <li key={index} className="card relative p-5">
              {/* Numbered marker. The <span> is decorative; the list position
                  already conveys the order to assistive technology. */}
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800"
              >
                {index + 1}
              </span>
              <h3 className="mt-3 text-base font-bold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Privacy + final fallback ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl space-y-4 px-4 pb-4 sm:px-6">
        <PrivacyReassurance dict={dict} ctaHref={`/${locale}/privacy`} />

        <EmergencyFooterNote dict={dict} telephone={telephone} />
      </section>
    </>
  );
}

/**
 * One of the four primary cards.
 *
 * The whole card is the link, with the title inside it as the accessible name.
 * Nesting an icon-bearing `<div>` inside the anchor keeps the hover target the
 * full card, which matters most on a phone where the alternative is a 24-pixel
 * target.
 */
function FeatureCard({ href, icon: Icon, tone, title, body }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 group-hover:bg-brand-100',
    accent: 'bg-accent-50 text-accent-700 group-hover:bg-accent-100',
    info: 'bg-info-50 text-info-700 group-hover:bg-info-100',
  };

  return (
    <Link href={href} className="group">
      <article className="card card-interactive h-full p-5">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-control transition-colors ${tones[tone] ?? tones.brand}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <h3 className="mt-4 text-base font-bold text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
          {title}
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </article>
    </Link>
  );
}

/**
 * Latest announcements, fetched at request time.
 *
 * Wrapped so that a failing API degrades to an explanatory empty state rather
 * than a 500. The homepage is the most-visited page and must not become
 * unavailable because a secondary feed is down.
 */
async function HomepageAnnouncements({ locale, dict }) {
  let announcements = [];

  try {
    const payload = await fetch(
      `${API_SERVER_BASE_URL}/announcements?locale=${locale}&pageSize=3`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(4000) },
    );
    if (payload.ok) {
      const data = await payload.json();
      announcements = Array.isArray(data?.data) ? data.data.slice(0, 3) : [];
    }
  } catch {
    // Intentionally silent. The empty state below says what a reader needs to
    // know; a console warning about a third-party fetch tells them nothing and
    // leaks internal detail into the browser console.
    announcements = [];
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-bold text-ink">{dict.home.updatesTitle}</h2>
        <Link
          href={`/${locale}/updates`}
          className="shrink-0 text-sm font-semibold text-brand-700 hover:underline"
        >
          {dict.home.updatesAll}
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {announcements.length === 0 ? (
          <p className="card p-5 text-sm text-ink-muted">{dict.home.updatesEmpty}</p>
        ) : (
          announcements.map((item) => (
            <Link
              key={item.slug}
              href={`/${locale}/updates/${item.slug}`}
              className="card card-interactive block p-4"
            >
              <div className="flex items-start gap-3">
                <Megaphone
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                  {item.publishedAt && (
                    <p className="mt-1 text-xs text-ink-muted">
                      <time dateTime={item.publishedAt}>
                        {new Date(item.publishedAt).toLocaleDateString(locale, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

/** Recently verified contacts, with the verification date shown. */
async function HomepageContacts({ locale, dict }) {
  let contacts = [];

  try {
    const payload = await fetch(
      `${API_SERVER_BASE_URL}/contacts?locale=${locale}`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(4000) },
    );
    if (payload.ok) {
      const data = await payload.json();
      contacts = Array.isArray(data) ? data.slice(0, 4) : [];
    }
  } catch {
    contacts = [];
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-bold text-ink">{dict.home.contactsTitle}</h2>
        <Link
          href={`/${locale}/contacts`}
          className="shrink-0 text-sm font-semibold text-brand-700 hover:underline"
        >
          {dict.home.contactsAll}
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {contacts.length === 0 ? (
          <p className="card p-5 text-sm text-ink-muted">{dict.home.contactsEmpty}</p>
        ) : (
          contacts.map((contact) => (
            <div key={contact.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-ink">{contact.name}</h3>
                  {contact.coverageArea && (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {dict.contacts.coverageLabel}: {contact.coverageArea}
                    </p>
                  )}
                </div>

                {contact.isFictionalDemo && (
                  <span className="pill pill-warning shrink-0">
                    {dict.common.exampleEntry}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                {contact.lastVerifiedAt ? (
                  <p className="text-xs text-ink-muted">
                    {dict.contacts.lastVerifiedLabel}:{' '}
                    <time dateTime={contact.lastVerifiedAt} className="font-medium">
                      {new Date(contact.lastVerifiedAt).toLocaleDateString(locale)}
                    </time>
                  </p>
                ) : (
                  <span />
                )}

                <a
                  href={`tel:${contact.phoneNumber}`}
                  className="btn btn-primary btn-sm"
                  aria-label={`${dict.contacts.callCta} ${contact.name}`}
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  <span dir="ltr">{contact.phoneNumber}</span>
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Local import rather than a top-level one.
 *
 * `getDictionary` is `server-only`; importing it at module scope in a file that
 * is otherwise server-rendered is fine, but keeping it here makes the dependency
 * obvious at the point of use.
 */
async function getHomeDictionary(locale) {
  const { getDictionary } = await import('@/lib/i18n/get-dictionary');
  return getDictionary(locale);
}
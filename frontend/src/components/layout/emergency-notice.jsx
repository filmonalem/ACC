import Link from 'next/link';

/**
 * Emergency notice.
 *
 * Present on every page, above the navigation, in the one colour reserved
 * throughout the design for emergencies.
 *
 * Two decisions worth stating:
 *
 *  - **It is not dismissible.** A resident who came here in a panic and looked
 *    away for a second must not be able to lose the only warning that matters.
 *    There is no close button and no "don't show again".
 *  - **It leads with the limitation, not the reassurance.** "ACC is not an
 *    emergency service" comes before anything else, because a person reading
 *    only the first line must still come away with the right idea about what
 *    this page will and will not do for them.
 */

export function EmergencyNotice({ dict, variant = 'banner' }) {
  const isCompact = variant === 'compact';

  return (
    <section
      aria-labelledby="emergency-notice-title"
      className={[
        'border-b-2 border-danger-700 bg-danger-50',
        isCompact ? 'px-4 py-2.5' : 'px-4 py-4 sm:px-6 sm:py-5',
      ].join(' ')}
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3">
        {/* Decorative: the heading already carries the meaning, and an icon
            alone is never announced. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={[
            'mt-0.5 shrink-0 text-danger-700',
            isCompact ? 'h-4 w-4' : 'h-5 w-5 sm:h-6 sm:w-6',
          ].join(' ')}
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>

        <div className="min-w-0 flex-1">
          <h2
            id="emergency-notice-title"
            className={[
              'font-bold text-danger-800',
              isCompact ? 'text-sm' : 'text-base sm:text-lg',
            ].join(' ')}
          >
            {dict.emergency.title}
          </h2>

          <p
            className={[
              'mt-1 text-danger-800',
              isCompact ? 'text-sm' : 'text-sm sm:text-base',
            ].join(' ')}
          >
            {dict.emergency.body}
          </p>

          {!isCompact && (
            <p className="mt-2 text-sm text-danger-700">
              <span className="font-semibold">{dict.emergency.action}</span>{' '}
              <span className="text-danger-800/80">{dict.emergency.footerNote}</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The standing footer reminder.
 *
 * Repeated at the bottom of every page on purpose: someone who has scrolled
 * past everything else to the end still sees it. This is the one piece of
 * content whose *position* is the feature — if the web application is
 * unavailable or the reader has run out of data, the phone number is the last
 * thing on the screen.
 */
export function EmergencyFooterNote({ dict, telephone = null }) {
  return (
    <div className="rounded-card border border-danger-200 bg-danger-50 p-4">
      <p className="text-sm font-semibold text-danger-800">{dict.emergency.title}</p>
      <p className="mt-1 text-sm text-danger-700">{dict.emergency.body}</p>
      {telephone && (
        <a
          href={`tel:${telephone.replace(/\s/g, '')}`}
          className="mt-3 inline-flex items-center gap-2 rounded-control bg-danger-700 px-4 py-2.5 text-base font-bold text-white transition-colors hover:bg-danger-800"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
          </svg>
          <span dir="ltr">{telephone}</span>
        </a>
      )}
    </div>
  );
}

/**
 * Privacy reassurance, shown under the emergency panel on the homepage.
 *
 * Framed around what the reader is *not* agreeing to: reports are not public,
 * and reading one is recorded. Residents who are afraid of being identified are
 * the ones who most need to submit, and this is what tells them it is safe to.
 */
export function PrivacyReassurance({ dict, ctaHref }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-ink">{dict.home.privacyTitle}</h3>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">{dict.home.privacyBody}</p>
          </div>
        </div>

        {ctaHref && (
          <Link href={ctaHref} className="btn btn-secondary btn-md shrink-0">
            {dict.home.privacyCta}
          </Link>
        )}
      </div>
    </section>
  );
}
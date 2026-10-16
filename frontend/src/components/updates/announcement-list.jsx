import Link from 'next/link';
import { Calendar, CheckCircle2, Megaphone } from 'lucide-react';

import { EmptyState } from '@/components/ui/primitives';

/**
 * Public announcements.
 *
 * Only announcements an authorised editor has approved and published appear
 * here; the backend enforces that, and there is no way to reach an unapproved
 * one through this list or through a direct link.
 *
 * Where a reviewed translation is missing, the English body is shown **and
 * labelled as such**. A reader is told plainly that this is not yet in their
 * language rather than being left to wonder why — and no critical text is ever
 * machine translated to fill the gap.
 */

const CATEGORY_STYLES = {
  PUBLIC_SAFETY: 'pill-danger',
  HEALTH_ADVISORY: 'pill-warning',
  SERVICE_NOTICE: 'pill-info',
  INFRASTRUCTURE: 'pill-brand',
  COMMUNITY: 'pill-success',
  OTHER: 'pill-neutral',
};

export function AnnouncementList({ announcements, dict, locale }) {
  if (!announcements || announcements.length === 0) {
    return <EmptyState icon={Megaphone} title={dict.updates.emptyTitle} body={dict.updates.emptyBody} />;
  }

  return (
    <ul className="space-y-4">
      {announcements.map((item) => (
        <li key={item.slug}>
          <Link href={`/${locale}/updates/${item.slug}`} className="card card-interactive block p-5">
            <div className="flex flex-wrap items-center gap-2">
              {item.category && (
                <span className={`pill ${CATEGORY_STYLES[item.category] ?? 'pill-neutral'}`}>
                  {dict.updates[`category${toPascalCase(item.category)}`] ?? item.category}
                </span>
              )}

              {/* Announced rather than colour-coded: an icon plus a word. */}
              {item.expiresAt && (
                <span className="pill pill-neutral">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  {dict.updates.expiresLabel}{' '}
                  {new Date(item.expiresAt).toLocaleDateString(locale)}
                </span>
              )}

              {isEnglishFallback(item, locale) && (
                <span
                  className="pill pill-warning"
                  title={dict.updates.translationPendingHelp}
                >
                  {dict.updates.translationPending}
                </span>
              )}
            </div>

            <h2 className="mt-3 text-lg font-bold text-ink">{item.title}</h2>

            {item.summary && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.summary}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-ink-muted">
              {item.publishedAt && (
                <span>
                  {dict.updates.publishedLabel}:{' '}
                  <time dateTime={item.publishedAt} className="font-medium text-ink">
                    {new Date(item.publishedAt).toLocaleDateString(locale, { dateStyle: 'medium' })}
                  </time>
                </span>
              )}

              {item.approvedByName && (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success-600" aria-hidden="true" />
                  {dict.updates.approvedByLabel}: {item.approvedByName}
                </span>
              )}
            </div>

            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
              {dict.common.readMore}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Whether the reader is seeing an English fallback.
 *
 * The API marks a response with `translationPending` when the requested locale
 * has no reviewed translation. Checking that flag is more reliable than
 * inferring from the title, and it means adding a language needs no change here.
 */
function isEnglishFallback(item, locale) {
  return locale !== 'en' && item?.translationPending === true;
}

function toPascalCase(value) {
  return String(value)
    .toLowerCase()
    .split(/[\s_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export { CATEGORY_STYLES, toPascalCase };
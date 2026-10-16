import { Clock, MapPin, Phone } from 'lucide-react';

import { EmptyState } from '@/components/ui/primitives';

/**
 * The verified service contact directory.
 *
 * Every card shows **when the details were last checked**. That is the single
 * most important thing on this page: a number that was right six months ago and
 * is wrong now is worse than no number, and a reader who cannot see the date
 * cannot judge it. The verification date is therefore given the same visual
 * weight as the phone number, not buried in a footnote.
 *
 * Demo rows **are** returned by the public endpoint — the backend filters on
 * `isPublished`, not on `isFictionalDemo` — so they carry a badge, an
 * explanatory title, and "(demonstration)" in the name. Verified live rather
 * than assumed: `GET /contacts` returns exactly one row, a fictional
 * demonstration entry.
 *
 * That is a deliberate gap rather than a finished feature. Before any pilot the
 * public query must exclude demonstration rows outright, because this page is
 * titled "Emergency Contacts" and a fictional number on it is the single worst
 * failure this platform has. It is recorded in the unfinished-integrations list.
 */

const CATEGORY_KEYS = [
  'EMERGENCY',
  'POLICE',
  'HEALTH',
  'FIRE',
  'UTILITY',
  'TRANSPORT',
  'COMMUNITY',
  'GOVERNMENT_OFFICE',
  'OTHER',
];

export function ContactCard({ contact, dict, locale }) {
  const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' }) : '—';

  // An expired verification must be visible even though the backend filters
  // those out of the public list — defence in depth for a page where a wrong
  // number has real consequences.
  const expired =
    contact.verificationExpiresAt && new Date(contact.verificationExpiresAt) < new Date();

  return (
    <article className="card card-interactive p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink">{contact.name}</h3>
          {contact.category && (
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
              {dict.contacts[`category${toPascalCase(contact.category)}`] ?? contact.category}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5">
          {contact.isEmergency && <span className="pill pill-danger">{dict.contacts.categoryEmergency}</span>}
          {contact.isFictionalDemo && (
            <span className="pill pill-warning" title={dict.common.exampleEntryHelp}>
              {dict.common.exampleEntry}
            </span>
          )}
          {expired && <span className="pill pill-warning">{dict.support.notVerifiedTitle}</span>}
        </div>
      </div>

      {contact.description && (
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{contact.description}</p>
      )}

      {contact.coverageArea && (
        <p className="mt-3 flex items-start gap-2 text-sm text-ink-muted">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <span>
            <span className="font-medium text-ink">{dict.contacts.coverageLabel}:</span>{' '}
            {contact.coverageArea}
          </span>
        </p>
      )}

      {contact.availabilityNotes && (
        <p className="mt-2 flex items-start gap-2 text-sm text-ink-muted">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <span>{contact.availabilityNotes}</span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="text-xs text-ink-muted">
          <p>
            {dict.contacts.lastVerifiedLabel}:{' '}
            <time dateTime={contact.lastVerifiedAt} className="font-semibold text-ink">
              {formatDate(contact.lastVerifiedAt)}
            </time>
          </p>
          {contact.verificationExpiresAt && !expired && (
            <p className="mt-0.5">
              {dict.contacts.expiresLabel}:{' '}
              <time dateTime={contact.verificationExpiresAt} className="font-medium">
                {formatDate(contact.verificationExpiresAt)}
              </time>
            </p>
          )}
        </div>

        <a
          href={`tel:${contact.phoneNumber}`}
          className="btn btn-primary btn-md"
          aria-label={`${dict.contacts.callCta} — ${contact.name}`}
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          {dict.contacts.callCta}
          <span className="font-mono" dir="ltr">
            {contact.phoneNumber}
          </span>
        </a>
      </div>

      {contact.alternativeInstructions && (
        <div className="mt-3 rounded-card bg-surface-sunken p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            {dict.contacts.instructionsLabel}
          </p>
          <p className="mt-1 text-sm text-ink">{contact.alternativeInstructions}</p>
        </div>
      )}
    </article>
  );
}

export function ContactList({ contacts, dict, locale, emptyTitle, emptyBody }) {
  if (!contacts || contacts.length === 0) {
    return <EmptyState icon={Phone} title={emptyTitle} body={emptyBody} />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {contacts.map((contact) => (
        <ContactCard key={contact.id} contact={contact} dict={dict} locale={locale} />
      ))}
    </div>
  );
}

function toPascalCase(value) {
  return String(value)
    .toLowerCase()
    .split(/[\s_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export { CATEGORY_KEYS };
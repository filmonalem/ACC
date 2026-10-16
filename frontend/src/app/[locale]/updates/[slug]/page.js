import { notFound } from 'next/navigation';
import { Calendar, CheckCircle2, Clock } from 'lucide-react';

import { getDictionary } from '@/lib/i18n/get-dictionary';
import { API_SERVER_BASE_URL } from '@/lib/api/base-url';

import { CATEGORY_STYLES, toPascalCase } from '@/components/updates/announcement-list';
import { Alert, Container, PageHeader } from '@/components/ui/primitives';

export async function generateMetadata({ params }) {
  const { locale, slug } = await params;
  const dict = await getDictionary(locale);

  const announcement = await loadAnnouncement(slug, locale);

  return {
    title: announcement?.title ?? dict.updates.title,
    description: announcement?.summary ?? dict.updates.intro,
  };
}

export default async function AnnouncementPage({ params }) {
  const { locale, slug } = await params;
  const dict = await getDictionary(locale);

  const announcement = await loadAnnouncement(slug, locale);

  /*
   * A missing slug is a 404 even for a draft that exists: the public route must
   * not become a way to discover that an unpublished announcement is in
   * progress. `notFound()` rather than a 403, which would confirm its existence.
   */
  if (!announcement) notFound();

  return (
    <>
      <PageHeader
        title={announcement.title}
        backHref={`/${locale}/updates`}
        backLabel={dict.updates.backToAll}
      />

      <Container size="narrow" className="py-8 sm:py-10">
        <div className="flex flex-wrap items-center gap-2">
          {announcement.category && (
            <span className={`pill ${CATEGORY_STYLES[announcement.category] ?? 'pill-neutral'}`}>
              {dict.updates[`category${toPascalCase(announcement.category)}`] ??
                announcement.category}
            </span>
          )}
        </div>

        {/*
          A visible notice rather than a silent fallback. Someone reading in a
          language they think they understand, but who is being served English
          emergency information, must be able to see that.
        */}
        {locale !== 'en' && announcement.translationPending && (
          <Alert tone="warning" title={dict.updates.translationPending} className="mt-5">
            {dict.updates.translationPendingHelp}
          </Alert>
        )}

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
          {announcement.publishedAt && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-brand-600" aria-hidden="true" />
              {dict.updates.publishedLabel}:{' '}
              <time dateTime={announcement.publishedAt} className="font-medium text-ink">
                {new Date(announcement.publishedAt).toLocaleDateString(locale, { dateStyle: 'long' })}
              </time>
            </span>
          )}

          {announcement.expiresAt && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-brand-600" aria-hidden="true" />
              {dict.updates.expiresLabel}:{' '}
              <time dateTime={announcement.expiresAt} className="font-medium text-ink">
                {new Date(announcement.expiresAt).toLocaleDateString(locale, { dateStyle: 'long' })}
              </time>
            </span>
          )}
        </div>

        {announcement.sourceName && (
          <p className="mt-3 text-sm text-ink-muted">
            {dict.updates.sourceLabel}: <span className="font-medium text-ink">{announcement.sourceName}</span>
          </p>
        )}

        {announcement.approvedByName && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-muted">
            <CheckCircle2 className="h-4 w-4 text-success-600" aria-hidden="true" />
            {dict.updates.approvedByLabel}:{' '}
            <span className="font-medium text-ink">{announcement.approvedByName}</span>
          </p>
        )}

        {/* Prose from an editor. React escapes it, so no announcement can inject
            markup or script — one reason this is rendered rather than injected. */}
        <article className="prose-slate mt-8 max-w-none">
          <div className="space-y-4 text-base leading-relaxed text-ink">
            {String(announcement.body ?? '')
              .split(/\n{2,}/)
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </div>
        </article>

        <Alert tone="warning" title={dict.home.disclaimerTitle} className="mt-8">
          {dict.home.disclaimerBody}
        </Alert>
      </Container>
    </>
  );
}

async function loadAnnouncement(slug, locale) {
  try {
    const response = await fetch(
      `${API_SERVER_BASE_URL}/announcements/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) },
    );

    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}
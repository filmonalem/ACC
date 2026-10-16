import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

import { getDictionary } from '@/lib/i18n/get-dictionary';
import { API_SERVER_BASE_URL } from '@/lib/api/base-url';

import { AnnouncementList } from '@/components/updates/announcement-list';
import { Container, PageHeader } from '@/components/ui/primitives';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return { title: dict.updates.title, description: dict.updates.intro };
}

export default async function UpdatesPage({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  const announcements = await loadAnnouncements(locale);

  return (
    <>
      <PageHeader title={dict.updates.title} lede={dict.updates.intro} />

      <Container size="narrow" className="py-8 sm:py-10">
        {/*
          Repeated rather than assumed. Someone who has come specifically looking
          for official information needs to see, on this page, that the platform
          is not the source — before they read a dated notice and act on it.
        */}
        <div className="alert alert-warning mb-6">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">{dict.home.disclaimerTitle}</p>
            <p className="mt-1 text-sm">{dict.home.disclaimerBody}</p>
          </div>
        </div>

        <AnnouncementList announcements={announcements} dict={dict} locale={locale} />

        <p className="mt-8 text-center text-sm text-ink-muted">
          <Link href={`/${locale}/contacts`} className="font-semibold text-brand-700 hover:underline">
            {dict.home.emergencyCta}
          </Link>
        </p>
      </Container>
    </>
  );
}

async function loadAnnouncements(locale) {
  try {
    const response = await fetch(
      `${API_SERVER_BASE_URL}/announcements?locale=${encodeURIComponent(locale)}&pageSize=20`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) },
    );

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}
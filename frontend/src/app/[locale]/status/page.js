import { Suspense } from 'react';

import { getDictionary } from '@/lib/i18n/get-dictionary';

import { StatusLookupForm } from '@/components/status/status-lookup-form';
import { Container, PageHeader } from '@/components/ui/primitives';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return { title: dict.status.title, description: dict.status.intro };
}

export default async function StatusPage({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return (
    <>
      <PageHeader title={dict.status.title} lede={dict.status.intro} />

      <Container size="narrow" className="py-8 sm:py-10">
        {/* `useSearchParams` needs a Suspense boundary, or the whole page opts
            out of static rendering. */}
        <Suspense fallback={<div className="skeleton h-64 w-full rounded-card" />}>
          <StatusLookupForm locale={locale} dict={dict} />
        </Suspense>
      </Container>
    </>
  );
}
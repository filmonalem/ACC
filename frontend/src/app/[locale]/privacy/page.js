import { Cookie, Database, FileText, Lock, ShieldCheck } from 'lucide-react';

import { getDictionary } from '@/lib/i18n/get-dictionary';

import { PrivacyRequestForm } from '@/components/privacy/privacy-request-form';
import { Alert, Container, PageHeader } from '@/components/ui/primitives';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return { title: dict.privacy.title, description: dict.privacy.dataBody };
}

export default async function PrivacyPage({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  const sections = [
    { icon: Database, title: dict.privacy.dataTitle, body: dict.privacy.dataBody },
    { icon: FileText, title: dict.privacy.useTitle, body: dict.privacy.useBody },
    { icon: ShieldCheck, title: dict.privacy.accessTitle, body: dict.privacy.accessBody },
    { icon: Lock, title: dict.privacy.retentionTitle, body: dict.privacy.retentionBody },
    { icon: FileText, title: dict.privacy.rightsTitle, body: dict.privacy.rightsBody },
    { icon: Cookie, title: dict.privacy.cookiesTitle, body: dict.privacy.cookiesBody },
  ];

  return (
    <>
      <PageHeader title={dict.privacy.title} />

      <Container size="narrow" className="py-8 sm:py-10">
        {/*
          The most important line on this page, and the one most likely to be
          left out of a real pilot by accident: this notice has not been through
          a lawyer. Someone deciding whether to hand over personal data deserves
          to know that.
        */}
        <Alert tone="warning" title={dict.privacy.contactTitle}>
          {dict.privacy.automatedNote}
        </Alert>

        <div className="mt-6 space-y-4">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <section key={section.title} className="card p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-700">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-ink">{section.title}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{section.body}</p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* The request form lives on the privacy page rather than on a separate
            route, so exercising a right and reading about it are the same
            journey. */}
        <section id="request-form" className="mt-10 scroll-mt-24">
          <h2 className="text-lg font-bold text-ink">{dict.privacy.requestFormTitle}</h2>
          <p className="mt-1.5 text-sm text-ink-muted">{dict.privacy.rightsBody}</p>
          <div className="mt-4">
            <PrivacyRequestForm dict={dict} />
          </div>
        </section>
      </Container>
    </>
  );
}
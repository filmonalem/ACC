import { Building2, CheckCircle2, FileText, Info, Lock, ShieldCheck } from 'lucide-react';

import { getDictionary } from '@/lib/i18n/get-dictionary';

import { Alert, Container, PageHeader } from '@/components/ui/primitives';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return { title: dict.about.title, description: dict.about.purposeBody };
}

export default async function AboutPage({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  const sections = [
    {
      icon: Info,
      title: dict.about.purposeTitle,
      body: dict.about.purposeBody,
    },
    {
      icon: ShieldCheck,
      title: dict.about.limitationsTitle,
      body: dict.about.limitationsBody,
      tone: 'warning',
    },
    {
      icon: FileText,
      title: dict.about.handlingTitle,
      body: dict.about.handlingBody,
    },
    {
      icon: Building2,
      title: dict.about.governanceTitle,
      body: dict.about.governanceBody,
    },
    {
      icon: CheckCircle2,
      title: dict.about.transparencyTitle,
      body: dict.about.transparencyBody,
    },
  ];

  return (
    <>
      <PageHeader title={dict.about.title} />

      <Container size="narrow" className="py-8 sm:py-10">
        {/* The most important sentence on the site, given the prominence it
            deserves rather than buried at the end. */}
        <Alert tone="warning" title={dict.home.disclaimerTitle}>
          {dict.home.disclaimerBody}
        </Alert>

        <div className="mt-8 space-y-4">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <section key={section.title} className="card p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-ink">{section.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{section.body}</p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* Empty by design. An unverified partnership is worse than none, so the
            section exists and says so rather than being omitted until there is
            something confirmed to put in it. */}
        <section className="card mt-4 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-sunken text-ink-muted">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-ink">{dict.about.partnersTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{dict.about.partnersBody}</p>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <a href={`/${locale}/privacy`} className="btn btn-secondary btn-md">
            <Lock className="h-4 w-4" aria-hidden="true" />
            {dict.nav.privacy}
          </a>
          <a href={`/${locale}/contacts`} className="btn btn-secondary btn-md">
            {dict.nav.contacts}
          </a>
        </div>
      </Container>
    </>
  );
}
import { Clock, Mail, MapPin, Phone, UserCheck } from 'lucide-react';

import { getDictionary } from '@/lib/i18n/get-dictionary';
import { API_SERVER_BASE_URL } from '@/lib/api/base-url';

import { Container, EmptyState, PageHeader } from '@/components/ui/primitives';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return { title: dict.support.title, description: dict.support.intro };
}

export default async function SupportPage({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  const services = await loadServices(locale);

  return (
    <>
      <PageHeader title={dict.support.title} lede={dict.support.intro} />

      <Container size="wide" className="py-8 sm:py-10">
        {services.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title={dict.support.emptyTitle}
            body={dict.support.emptyBody}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {services.map((service) => (
              <article key={service.id} className="card card-interactive p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-ink">{service.name}</h2>

                  <span
                    className={`pill ${
                      service.verificationStatus === 'VERIFIED' ? 'pill-success' : 'pill-warning'
                    }`}
                  >
                    {service.verificationStatus === 'VERIFIED'
                      ? dict.support.verifiedTitle
                      : dict.support.notVerifiedTitle}
                  </span>
                </div>

                {service.category && (
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
                    {service.category}
                  </p>
                )}

                {service.description && (
                  <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                    {service.description}
                  </p>
                )}

                <dl className="mt-4 space-y-2 text-sm">
                  {service.serviceArea && (
                    <div className="flex items-start gap-2">
                      <dt className="sr-only">{dict.support.serviceAreaLabel}</dt>
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                      <dd className="text-ink-muted">
                        <span className="font-medium text-ink">{dict.support.serviceAreaLabel}:</span>{' '}
                        {service.serviceArea}
                      </dd>
                    </div>
                  )}

                  {service.eligibility && (
                    <div className="flex items-start gap-2">
                      <dt className="sr-only">{dict.support.eligibilityLabel}</dt>
                      <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                      <dd className="text-ink-muted">
                        <span className="font-medium text-ink">{dict.support.eligibilityLabel}:</span>{' '}
                        {service.eligibility}
                      </dd>
                    </div>
                  )}

                  {service.hoursNotes && (
                    <div className="flex items-start gap-2">
                      <dt className="sr-only">{dict.support.hoursLabel}</dt>
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                      <dd className="text-ink-muted">
                        <span className="font-medium text-ink">{dict.support.hoursLabel}:</span>{' '}
                        {service.hoursNotes}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  {service.phoneNumber && (
                    <a href={`tel:${service.phoneNumber}`} className="btn btn-primary btn-sm">
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      <span dir="ltr">{service.phoneNumber}</span>
                    </a>
                  )}
                  {service.email && (
                    <a href={`mailto:${service.email}`} className="btn btn-secondary btn-sm">
                      <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                      <span dir="ltr" className="truncate">
                        {service.email}
                      </span>
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </Container>
    </>
  );
}

async function loadServices(locale) {
  try {
    const response = await fetch(
      `${API_SERVER_BASE_URL}/support-services?locale=${encodeURIComponent(locale)}`,
      { next: { revalidate: 600 }, signal: AbortSignal.timeout(5000) },
    );

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
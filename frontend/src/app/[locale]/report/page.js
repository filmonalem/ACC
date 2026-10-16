import { getDictionary } from '@/lib/i18n/get-dictionary';
import { API_SERVER_BASE_URL } from '@/lib/api/base-url';

import { ReportWizard } from '@/components/report/report-wizard';
import { Container, PageHeader } from '@/components/ui/primitives';

/**
 * The "Report a Concern" page.
 *
 * A Server Component: it fetches the categories on the server so the first
 * paint already contains the choices, and hands them to the client wizard. A
 * resident on a slow connection sees a working form immediately instead of a
 * spinner followed by a second request.
 *
 * **This page is not statically cached.** The categories drive what a worried
 * resident chooses in their first minute of filling in a form, so a stale or
 * wrongly-localised list is worse than a marginally slower page. With ISR a
 * transient API outage at build time is cached for the whole revalidation
 * window, and everyone arriving in that window sees an error instead of a form —
 * which is precisely the reader who can least afford it.
 *
 * The categories change rarely, so the cost is one small GET per render. Every
 * other page on this site stays statically generated.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return { title: dict.report.title, description: dict.report.intro };
}

export default async function ReportPage({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  const categories = await loadCategories(locale);

  return (
    <>
      <PageHeader title={dict.report.title} lede={dict.report.intro} />

      <Container size="narrow" className="py-8 sm:py-10">
        {categories === null ? (
          <div className="card p-6 text-center">
            <h2 className="text-base font-bold text-ink">{dict.common.somethingWentWrong}</h2>
            <p className="mt-2 text-sm text-ink-muted">{dict.common.somethingWentWrongHelp}</p>
          </div>
        ) : (
          <ReportWizard
            locale={locale}
            dict={dict}
            categories={categories}
            privacyHref={`/${locale}/privacy`}
          />
        )}
      </Container>
    </>
  );
}

/**
 * Report categories from the API.
 *
 * Returns `null` on failure rather than an empty array, because the two mean
 * different things to the reader: "we could not reach the service" and "there
 * are no categories". Collapsing them would produce an empty radio group that
 * looks like the reader's fault.
 */
async function loadCategories(locale) {
  try {
    // The locale is a query parameter, not an `Accept-Language` header: the
    // header is advisory and is frequently overridden or dropped by proxies and
    // CDNs, and a resident reading in Tigrinya must not silently receive English
    // category names because of it.
    const response = await fetch(
      `${API_SERVER_BASE_URL}/report-categories?locale=${encodeURIComponent(locale)}`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) return null;

    const data = await response.json();

    return Array.isArray(data?.data) ? data.data : null;
  } catch {
    return null;
  }
}
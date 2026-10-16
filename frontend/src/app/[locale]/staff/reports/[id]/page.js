import { getDictionary } from '@/lib/i18n/get-dictionary';

import { ReportDetail } from '@/components/staff/report-detail';
import { Container, PageHeader } from '@/components/ui/primitives';

/**
 * Staff report detail.
 *
 * Rendered per request: the response contains reporter identity when the
 * signed-in person is permitted to see it, and that must never be cached into a
 * shared store or a static page.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return { title: dict.staff.queueTitle, robots: { index: false, follow: false } };
}

export default async function StaffReportPage({ params }) {
  const { locale, id } = await params;
  const dict = await getDictionary(locale);

  return (
    <>
      <PageHeader
        title={dict.staff.detailTitle.replace('{reference}', id)}
        backHref={`/${locale}/staff/reports`}
        backLabel={dict.staff.queueTitle}
      />

      <Container size="wide" className="py-6 sm:py-8">
        <ReportDetail reportId={id} dict={dict} />
      </Container>
    </>
  );
}
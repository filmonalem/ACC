import { getDictionary } from '@/lib/i18n/get-dictionary';

import { ReportQueue } from '@/components/staff/report-queue';
import { Container, PageHeader } from '@/components/ui/primitives';

/**
 * The staff report queue.
 *
 * Rendered per request rather than statically: the contents depend entirely on
 * who is signed in, and a cached queue would be a way to show one officer
 * another's authorized reports.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return { title: dict.staff.queueTitle, robots: { index: false, follow: false } };
}

export default async function StaffReportsPage({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return (
    <>
      <PageHeader title={dict.staff.queueTitle} />

      <Container size="wide" className="py-6 sm:py-8">
        <ReportQueue dict={dict} />
      </Container>
    </>
  );
}
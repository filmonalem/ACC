import Link from 'next/link';

import { getDictionary } from '@/lib/i18n/get-dictionary';

import { StaffLogin } from '@/components/staff/staff-login';
import { Container } from '@/components/ui/primitives';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return { title: dict.staff.title, robots: { index: false, follow: false } };
}

export default async function StaffLoginPage({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <StaffLogin dict={dict} />

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href={`/${locale}`} className="font-semibold text-brand-700 hover:underline">
          {dict.nav.home}
        </Link>
      </p>
    </Container>
  );
}
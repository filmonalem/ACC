import { getDictionary } from '@/lib/i18n/get-dictionary';

import { ContactDirectory } from '@/components/contacts/contact-directory';
import { Container, PageHeader } from '@/components/ui/primitives';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  return { title: dict.contacts.title, description: dict.contacts.intro };
}

export default async function ContactsPage({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);

  const contacts = await loadContacts(locale);

  return (
    <>
      <PageHeader title={dict.contacts.title} lede={dict.contacts.intro} />

      <Container size="wide" className="py-8 sm:py-10">
        <ContactDirectory contacts={contacts ?? []} dict={dict} locale={locale} />
      </Container>
    </>
  );
}

/**
 * Published, verified service contacts.
 *
 * The backend only ever returns contacts that are published, currently
 * `VERIFIED`, and not past their verification date — so an expired number cannot
 * reach this page even if a client asks for it. The frontend does not re-check
 * those conditions, because duplicating the rule here would be a second place
 * for it to be wrong.
 *
 * Cached for five minutes: a contact's details change rarely, and a stale entry
 * for five minutes is an acceptable trade against a database read on every
 * visitor.
 */
async function loadContacts(locale) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/contacts?locale=${encodeURIComponent(locale)}`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) },
    );

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    // An empty list renders an explanatory empty state rather than an error
    // page: "no contacts published yet" and "we could not reach the service"
    // lead the reader to the same next step — telephone a service directly.
    return [];
  }
}
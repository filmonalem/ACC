import Link from 'next/link';

import { defaultLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

import { Container } from '@/components/ui/primitives';

/**
 * 404 page.
 *
 * Rendered at the root rather than under `[locale]`, because Next renders a
 * `notFound()` from a locale route using the *root* not-found boundary — and a
 * visitor whose URL was wrong is exactly the visitor least likely to have a
 * valid locale prefix. Sending them to the default language is better than
 * showing them an error in a language they cannot read.
 */
export default async function NotFound() {
  const dict = await getDictionary(defaultLocale);

  return (
    <Container size="narrow" className="py-20 text-center">
      <p className="text-sm font-bold uppercase tracking-wide text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{dict.common.notFound}</h1>
      <p className="mt-3 text-ink-muted">{dict.common.notFoundHelp}</p>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href={`/${defaultLocale}`} className="btn btn-primary btn-md">
          {dict.nav.home}
        </Link>
        <Link href={`/${defaultLocale}/contacts`} className="btn btn-secondary btn-md">
          {dict.nav.contacts}
        </Link>
      </div>
    </Container>
  );
}
import { getDictionary } from '@/lib/i18n/get-dictionary';

import { Container } from '@/components/ui/primitives';

/**
 * Offline fallback.
 *
 * Deliberately plain, and reachable without a network. It carries the
 * emergency wording and a way back, because a resident who lost connection
 * mid-journey is the one person who most needs to know this site is not an
 * emergency service.
 */
export const dynamic = 'force-static';

export async function generateMetadata() {
  return { title: 'Offline · Adigrat Community Connect' };
}

export default async function OfflinePage() {
  const dict = await getDictionary('en');

  return (
    <Container size="narrow" className="py-16 text-center">
      <h1 className="text-2xl font-bold text-ink">You are offline</h1>
      <p className="mt-3 text-ink-muted">
        This page could not be loaded because the connection is unavailable.
        Anything you have already read is still available.
      </p>

      {/* The emergency message survives being offline. It is the one thing that
          matters most and it costs no network. */}
      <div className="alert alert-danger mt-8 text-left">
        <div>
          <p className="font-bold">{dict.emergency.title}</p>
          <p className="mt-1">{dict.emergency.body}</p>
          <p className="mt-2 font-semibold">{dict.emergency.action}</p>
        </div>
      </div>

      <a href="/" className="btn btn-primary btn-md mt-8">
        {dict.common.retry}
      </a>
    </Container>
  );
}
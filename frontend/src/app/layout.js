import './globals.css';

/**
 * Root layout.
 *
 * Intentionally thin. Next requires a root layout at `app/layout.js`, but
 * everything that depends on the locale — `lang`, fonts, direction, the shell —
 * lives in `app/[locale]/layout.js`, because the locale is only known there.
 *
 * Rendering a `<html>` element here without a language would make the whole
 * first paint inherit the wrong `lang`, and a screen reader would commit to the
 * wrong voice before the correct locale was even resolved.
 */

export const metadata = {
  title: {
    default: 'Adigrat Community Connect',
    template: '%s · Adigrat Community Connect',
  },
  description:
    'Report a community concern, check verified service contacts, and read approved public announcements for Adigrat.',
  applicationName: 'ACC',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'ACC',
    statusBarStyle: 'default',
  },
  formatDetection: {
    // A telephone number in ordinary prose should not be turned into a dial
    // link by the browser — on this site only contact numbers are actionable,
    // and auto-linking arbitrary digits causes accidental calls on mobile.
    telephone: false,
  },
  robots: {
    // A pilot has no business being indexed, and resident-facing pages here are
    // deliberately low-content.
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }) {
  // `<html>` is supplied by the locale layout, which is the only place the
  // language is known. Next renders the tree returned from here into that.
  return children;
}
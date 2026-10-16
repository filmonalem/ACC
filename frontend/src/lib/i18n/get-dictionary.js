import 'server-only';

import { defaultLocale, isLocale } from './config';

/**
 * Dictionary loading.
 *
 * Dictionaries are imported **statically by reference**, not dynamically per
 * request, and the locale tree-shakes to a single language.
 *
 * The alternative — dynamic `import()` per locale — is tempting and wrong here.
 * It would put three full dictionaries in the client bundle when the whole point
 * of the design is that a reader on a 2G connection in Adigrat pays for one
 * language, not three. The locale is a route segment, so each language is a
 * separate entry and Next serves exactly the one being visited.
 *
 * `interpolate` and `translate` live in `./format.js` rather than here, because
 * this module is `server-only` and a Client Component legitimately needs them.
 */

const DICTIONARIES = {
  en: () => import('./dictionaries/en').then((module) => module.default),
  ti: () => import('./dictionaries/ti').then((module) => module.default),
  am: () => import('./dictionaries/am').then((module) => module.default),
};

/**
 * Loads the dictionary for a locale.
 *
 * An unknown locale falls back to English rather than throwing: a hand-typed or
 * stale URL should still render something usable, and the middleware keeps
 * unknown locales out of the first place anyway.
 */
export async function getDictionary(locale) {
  const key = isLocale(locale) ? locale : defaultLocale;
  return DICTIONARIES[key]();
}
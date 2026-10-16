import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  hasTranslation,
  localise,
  toSupportedLocale,
} from './localise';

/**
 * Locale resolution.
 *
 * These tests exist because the behaviour is invisible in review and highly
 * consequential: a reader served the wrong language has no way to tell they are
 * not understanding what they are reading, and a leaked `Object.prototype` member
 * ends up rendered as a label in a public JSON response.
 */

describe('toSupportedLocale', () => {
  it('accepts each supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(toSupportedLocale(locale)).toBe(locale);
    }
  });

  it('is case-insensitive', () => {
    expect(toSupportedLocale('TI')).toBe('ti');
    expect(toSupportedLocale('Am')).toBe('am');
  });

  it('accepts a BCP 47 tag and takes the base language', () => {
    expect(toSupportedLocale('ti-Ethi')).toBe('ti');
    expect(toSupportedLocale('am_ET')).toBe('am');
  });

  it('trims surrounding whitespace', () => {
    expect(toSupportedLocale('  en  ')).toBe('en');
  });

  it('rejects anything unsupported', () => {
    expect(toSupportedLocale('fr')).toBeNull();
    expect(toSupportedLocale('')).toBeNull();
    expect(toSupportedLocale(null)).toBeNull();
    expect(toSupportedLocale(undefined)).toBeNull();
    expect(toSupportedLocale(42)).toBeNull();
  });

  /**
   * These are the values that made the prototype-leak reachable. They must be
   * rejected before they can index into a translation map.
   */
  it('rejects inherited Object.prototype keys', () => {
    for (const key of [
      'constructor',
      'toString',
      'valueOf',
      'hasOwnProperty',
      '__proto__',
      'isPrototypeOf',
    ]) {
      expect(toSupportedLocale(key), `${key} must not resolve to a locale`).toBeNull();
    }
  });
});

describe('localise', () => {
  const map = { en: 'Street light', ti: 'የጎዳና ብርሃን', am: 'የመንገድ ብርሃን' };

  it('returns the requested language', () => {
    expect(localise(map, 'ti')).toBe('የጎዳና ብርሃን');
    expect(localise(map, 'am')).toBe('የመንገድ ብርሃን');
    expect(localise(map, 'en')).toBe('Street light');
  });

  it('normalises the locale before indexing', () => {
    expect(localise(map, 'TI')).toBe('የጎዳና ብርሃን');
    expect(localise(map, 'ti-Ethi')).toBe('የጎዳና ብርሃን');
  });

  it('falls back to English when the requested language is missing', () => {
    // The most common real case: a category added to the seed before its
    // translations were written.
    expect(localise({ en: 'Only English' }, 'ti')).toBe('Only English');
  });

  /**
   * The fallback order is `requested → English → first available`. The third
   * step matters: an older record holding only `{ am }` should render its Amharic
   * label rather than showing nothing, because a blank is strictly worse for the
   * reader than the one language that *is* available.
   */
  it('falls back to the first available language when English is absent', () => {
    expect(localise({ am: 'የመንገድ ብርሃን' }, 'ti')).toBe('የመንገድ ብርሃን');
    expect(localise({ am: 'የመንገድ ብርሃን' }, 'en')).toBe('የመንገድ ብርሃን');
  });

  /**
   * A record with `{ en: "" }` must not serve an empty label. `??` alone would
   * have returned `""` here, because `''` is neither null nor undefined.
   */
  it('treats an empty string as missing', () => {
    expect(localise({ en: 'Real value', ti: '' }, 'ti')).toBe('Real value');
    expect(localise({ en: '' }, 'ti')).toBeNull();
  });

  it('returns null for a non-object', () => {
    expect(localise(null, 'en')).toBeNull();
    expect(localise(undefined, 'en')).toBeNull();
    expect(localise('a string', 'en')).toBeNull();
    expect(localise(42, 'en')).toBeNull();
  });

  it('returns null for an empty object', () => {
    expect(localise({}, 'en')).toBeNull();
  });

  it('ignores non-string values inside the map', () => {
    expect(localise({ en: 'Valid', ti: 123 }, 'ti')).toBe('Valid');
    expect(localise({ en: 'Valid', ti: null }, 'ti')).toBe('Valid');
  });

  it('ignores an array', () => {
    expect(localise(['a', 'b'], 'en')).toBeNull();
  });

  /**
   * The bug that motivated extracting this helper.
   *
   * `map[locale] ?? map.en` on a plain object returns whatever is inherited from
   * `Object.prototype` for a key like `constructor`, because a function is
   * truthy so `??` short-circuits past the fallback. The original three copies
   * all had this. Controllers validate the locale with `@IsEnum`, which closed
   * the door from outside; this test is what keeps it closed from inside too,
   * for any caller that forgets the decorator.
   */
  it('never returns an inherited Object.prototype member', () => {
    for (const key of [
      'constructor',
      'toString',
      'valueOf',
      'hasOwnProperty',
      '__proto__',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'toLocaleString',
    ]) {
      const result = localise(map, key);

      expect(typeof result, `${key} returned a ${typeof result}`).toBe('string');
      // Whatever it fell back to, it must be a real translation string and not
      // the stringification of a built-in.
      expect(result, `${key} leaked a prototype member`).toBe('Street light');
    }
  });

  it('does not mutate the map it is given', () => {
    const original = { ...map };
    localise(original, 'constructor');
    localise(original, 'ti');
    expect(original).toEqual(original);
    expect(Object.keys(original)).toEqual(Object.keys(map));
  });
});

describe('hasTranslation', () => {
  const map = { en: 'Street light', ti: 'የጎዳና ብርሃን' };

  it('is true only when the requested language has a non-empty value', () => {
    expect(hasTranslation(map, 'ti')).toBe(true);
    expect(hasTranslation(map, 'en')).toBe(true);
    expect(hasTranslation(map, 'am')).toBe(false);
  });

  it('is false for an empty string, matching how localise treats it', () => {
    // The two must agree: if `hasTranslation` said true while `localise` served
    // English, the interface would show "translated" over fallback text.
    const partial = { en: 'English', ti: '   ' };
    expect(hasTranslation(partial, 'ti')).toBe(false);
    expect(localise(partial, 'ti')).toBe('English');
  });

  it('is false for an unsupported or invalid locale', () => {
    expect(hasTranslation(map, 'fr')).toBe(false);
    expect(hasTranslation(map, 'constructor')).toBe(false);

    // Cast: the signature says `string`, but a caller reaching a query
    // parameter that failed validation can still pass undefined through. The
    // runtime must not index a map with it.
    expect(hasTranslation(map, undefined as unknown as string)).toBe(false);
    expect(hasTranslation(map, null as unknown as string)).toBe(false);
  });

  it('is false for a non-object', () => {
    expect(hasTranslation(null, 'en')).toBe(false);
    expect(hasTranslation('string', 'en')).toBe(false);
  });
});

describe('defaults', () => {
  it('defaults to English', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('lists exactly the three supported languages', () => {
    expect([...SUPPORTED_LOCALES]).toEqual(['en', 'ti', 'am']);
  });
});
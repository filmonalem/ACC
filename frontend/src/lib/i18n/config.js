/**
 * Supported locales.
 *
 * Tigrinya (`ti`) and Amharic (`am`) are not optional extras. They are named in
 * the project brief as core requirements, and a pilot for Adigrat that only
 * works in English excludes the people it is meant to serve.
 *
 * English is the development fallback only. Where a human-reviewed `ti` or `am`
 * translation is missing, the English string is shown and the gap is recorded —
 * never a machine translation, and never a raw key to a resident.
 */

export const locales = ['en', 'ti', 'am'];

export const defaultLocale = 'en';

/**
 * Endonyms — each language written in itself.
 *
 * Deliberately not `Tigrinya / Amharic / English`: someone who cannot read
 * Latin script cannot use a switcher labelled only in Latin script, which would
 * make the switcher useless to exactly the people it exists for.
 */
export const localeNames = {
  en: 'English',
  ti: 'ትግርኛ',
  am: 'አማርኛ',
};

export function isLocale(value) {
  return typeof value === 'string' && locales.includes(value);
}

/**
 * BCP 47 tags for `<html lang>`.
 *
 * `ti` is written with its own script tag because a screen reader uses it to
 * choose a voice. Getting this wrong makes Tigrinya read aloud with an English
 * voice, which for a low-literacy reader is the same as not being supported.
 */
export const htmlLang = {
  en: 'en',
  ti: 'ti-Ethi',
  am: 'am',
};

/** Right-to-left is not used by any supported locale, but the direction is
 *  derived rather than hard-coded so adding one later cannot be forgotten. */
export function directionFor(locale) {
  return locale === 'ar' || locale === 'he' || locale === 'fa' ? 'rtl' : 'ltr';
}
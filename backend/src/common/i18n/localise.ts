/**
 * Locale resolution for content stored in the database.
 *
 * ## Why this exists
 *
 * Reports, contacts, support services and announcements all carry `*I18n` JSON
 * columns shaped like `{ en, ti, am }`. Each module that reads one needs the same
 * two decisions: *which* language was actually served, and *what to do when the
 * requested one is missing*. Three modules had each grown their own copy of that
 * logic.
 *
 * The three copies were behaviourally identical, so this is primarily about
 * having one place to change — but the copies were all missing two guards, and
 * that is the part worth stating:
 *
 *  1. **They used `map[locale]` on a plain object.** Any inherited key —
 *     `constructor`, `toString`, `valueOf`, `__proto__` — is truthy, so a caller
 *     passing an unvalidated locale would have had `Function: Object()` written
 *     into a JSON response as the label. Every controller currently validates
 *     `locale` with `@IsEnum`, which closes the door from outside; this closes it
 *     from inside, so a future caller that forgets the decorator cannot reopen it.
 *  2. **They used `??` rather than checking for a non-empty string.** A record with
 *     `{ en: "" }` served an empty label instead of falling back.
 *
 * This module is the single answer to both questions.
 */

/** The locales the platform serves. Must stay in step with `frontend/src/lib/i18n/config.js`. */
export const SUPPORTED_LOCALES = ['en', 'ti', 'am'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

/** Narrows an arbitrary string to a supported locale, or `null`. */
export function toSupportedLocale(value: unknown): SupportedLocale | null {
  if (typeof value !== 'string') return null;

  const normalised = value.trim().toLowerCase().split(/[-_]/)[0];

  return (SUPPORTED_LOCALES as readonly string[]).includes(normalised)
    ? (normalised as SupportedLocale)
    : null;
}

/**
 * Reads one language out of a `{ en, ti, am }` map.
 *
 * ## The fallback order is deliberate, and is not simply "English"
 *
 * `requested → English → first available → null`
 *
 * The third step matters. An older record may hold only `{ am }` with no `en` at
 * all. Returning `null` there would blank out a perfectly good Amharic label,
 * which is strictly worse for the reader than showing them the one language that
 * *is* available. English is preferred only because it is the language the
 * development team can be certain is complete — not because it is superior.
 *
 * Returns `null` only when the map is empty or contains nothing string-like, so
 * a caller can distinguish "no translation at all" from "translated to empty".
 */
export function localise(value: unknown, locale: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const map = value as Record<string, unknown>;

  const pick = (key: string): string | null => {
    const candidate = map[key];
    return typeof candidate === 'string' && candidate.trim() !== ''
      ? candidate
      : null;
  };

  const requested = toSupportedLocale(locale);

  return (
    (requested ? pick(requested) : null) ??
    pick(DEFAULT_LOCALE) ??
    Object.values(map).find(
      (entry): entry is string =>
        typeof entry === 'string' && entry.trim() !== '',
    ) ??
    null
  );
}

/**
 * Reports whether a translation was found in the requested language.
 *
 * The public endpoints return this alongside the resolved text so the interface
 * can *tell* a reader "this is shown in English" rather than silently substituting
 * a language they did not ask for. Silently falling back is worse than showing
 * nothing, because the reader has no way to know they are not understanding what
 * they are reading.
 */
export function hasTranslation(value: unknown, locale: string): boolean {
  if (!value || typeof value !== 'object') return false;

  const requested = toSupportedLocale(locale);
  if (!requested) return false;

  const candidate = (value as Record<string, unknown>)[requested];

  return typeof candidate === 'string' && candidate.trim() !== '';
}
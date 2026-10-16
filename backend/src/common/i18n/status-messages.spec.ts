import { describe, expect, it } from 'vitest';

import { publicStatusMessage } from './status-messages';
import { SUPPORTED_LOCALES } from './localise';

/**
 * Resident status messages.
 *
 * These strings tell someone whether their report was received and what happens
 * to it next. Someone who cannot read the sentence cannot tell whether their
 * report was accepted, and will reasonably submit it again — or conclude that
 * nobody received the first one. That is why the completeness of the translations
 * is asserted here rather than left to review.
 */

describe('publicStatusMessage', () => {
  it('defaults to English', () => {
    const result = publicStatusMessage('SUBMITTED');

    expect(result.locale).toBe('en');
    expect(result.translationPending).toBe(false);
    expect(result.message).toMatch(/received your report/i);
  });

  it('returns a sentence, never a raw status name', () => {
    // The failure this guards: a missing translation falling through to
    // `SUBMITTED`, which tells a resident nothing.
    for (const status of [
      'SUBMITTED',
      'UNDER_REVIEW',
      'VERIFIED',
      'ASSIGNED',
      'IN_PROGRESS',
      'RESOLVED',
      'CLOSED',
      'REJECTED',
      'DUPLICATE',
    ]) {
      for (const locale of SUPPORTED_LOCALES) {
        const { message } = publicStatusMessage(status, locale);

        // The bound catches an empty or truncated string, not short copy: a
        // complete Ethiopic sentence is often shorter than its English rendering
        // because the script packs more meaning into fewer characters.
        expect(message.length, `${status}/${locale} is too short`).toBeGreaterThan(15);
        expect(message, `${status}/${locale} leaked the status name`).not.toBe(status);
      }
    }
  });

  it('translates every known status into every language', () => {
    const statuses = [
      'SUBMITTED',
      'UNDER_REVIEW',
      'VERIFIED',
      'ASSIGNED',
      'IN_PROGRESS',
      'RESOLVED',
      'CLOSED',
      'REJECTED',
      'DUPLICATE',
    ];

    for (const locale of SUPPORTED_LOCALES) {
      for (const status of statuses) {
        const result = publicStatusMessage(status, locale);

        expect(result.translationPending, `${status}/${locale} fell back`).toBe(false);
        expect(result.locale).toBe(locale);
        expect(result.message.trim()).not.toBe('');
      }
    }
  });

  /**
   * Tigrinya and Amharic are not Latin, so an English string surviving into a
   * non-English response means the lookup missed and silently fell back.
   */
  it('serves Ethiopic script for the Ethiopian locales', () => {
    const ethiopic = /[ሀ-፿]/;

    expect(publicStatusMessage('SUBMITTED', 'ti').message).toMatch(ethiopic);
    expect(publicStatusMessage('SUBMITTED', 'am').message).toMatch(ethiopic);
  });

  it('does not serve English into a non-English locale', () => {
    for (const locale of ['ti', 'am'] as const) {
      const { message } = publicStatusMessage('RESOLVED', locale);

      // Latin letters appear legitimately in codes and place names, so this
      // asserts the message is not *predominantly* English rather than that it
      // contains no Latin at all.
      const latin = (message.match(/[A-Za-z]/g) ?? []).length;
      const ethiopic = (message.match(/[ሀ-፿]/g) ?? []).length;

      expect(ethiopic, `${locale} message is not in Ethiopic script`).toBeGreaterThan(latin);
    }
  });

  it('gives each status a distinct message', () => {
    // Two statuses sharing a message would tell a resident their report was
    // resolved when it had only been assigned.
    const statuses = [
      'SUBMITTED',
      'UNDER_REVIEW',
      'VERIFIED',
      'ASSIGNED',
      'IN_PROGRESS',
      'RESOLVED',
      'CLOSED',
      'REJECTED',
      'DUPLICATE',
    ];

    for (const locale of SUPPORTED_LOCALES) {
      const messages = statuses.map((status) => publicStatusMessage(status, locale).message);

      expect(new Set(messages).size, `${locale} has duplicate messages`).toBe(
        statuses.length,
      );
    }
  });

  /**
   * Guards against wholesale table copy-paste between the two Ethiopian
   * languages.
   *
   * Deliberately does **not** assert that every single string differs. Tigrinya
   * and Amharic are closely related Ge'ez languages, and short administrative
   * phrases are frequently identical between them — "ሪፖርትዎ ተመዝግቧል" is correct in
   * both. Asserting per-string distinctness would fail on correct translations
   * and so would have been quietly deleted.
   *
   * What *is* a real signal is the whole table being a copy: if every status
   * matched, someone pasted one language over the other and the second language
   * was never actually written.
   */
  it('does not reuse an entire language table verbatim', () => {
    const statuses = [
      'SUBMITTED',
      'UNDER_REVIEW',
      'VERIFIED',
      'ASSIGNED',
      'IN_PROGRESS',
      'RESOLVED',
      'CLOSED',
      'REJECTED',
      'DUPLICATE',
    ];

    const renderings = Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [
        locale,
        statuses.map((status) => publicStatusMessage(status, locale).message),
      ]),
    );

    for (const locale of SUPPORTED_LOCALES) {
      const others = SUPPORTED_LOCALES.filter((other) => other !== locale);

      for (const other of others) {
        const identical = renderings[locale].filter(
          (message, index) => message === renderings[other][index],
        ).length;

        // A couple of coincidences are expected and fine. A wholesale match is
        // a missing translation.
        expect(identical, `${locale} is a verbatim copy of ${other}`).toBeLessThan(
          statuses.length / 2,
        );
      }
    }
  });

  it('falls back to English and flags it for an unsupported locale', () => {
    const result = publicStatusMessage('SUBMITTED', 'fr');

    expect(result.locale).toBe('en');
    expect(result.translationPending).toBe(true);
    expect(result.message).toMatch(/received your report/i);
  });

  it('falls back to English and flags it for a missing locale', () => {
    const result = publicStatusMessage('SUBMITTED');

    expect(result.message).toMatch(/received your report/i);
  });

  /**
   * A status the database can hold but this table does not know about — a new
   * enum value added without a matching message.
   */
  it('returns a generic sentence for an unknown status, not the status name', () => {
    const result = publicStatusMessage('SOMETHING_NEW');

    expect(result.message.length).toBeGreaterThan(10);
    expect(result.message).not.toContain('SOMETHING_NEW');
  });

  it('never claims a response time', () => {
    // The platform promises no response time anywhere. A translation that
    // accidentally introduced one would be a commitment the platform cannot
    // keep, and residents would act on it.
    const promises = /\b(within|in)\s+\d+\s*(hour|day|minute|week)s?\b/i;

    for (const locale of SUPPORTED_LOCALES) {
      for (const status of [
        'SUBMITTED',
        'UNDER_REVIEW',
        'VERIFIED',
        'ASSIGNED',
        'IN_PROGRESS',
        'RESOLVED',
      ]) {
        expect(
          promises.test(publicStatusMessage(status, locale).message),
          `${status}/${locale} promises a response time`,
        ).toBe(false);
      }
    }
  });
});
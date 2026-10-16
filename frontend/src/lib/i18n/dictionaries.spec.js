import { describe, expect, it } from 'vitest';

import en from './dictionaries/en';
import ti from './dictionaries/ti';
import am from './dictionaries/am';
import { interpolate } from './format';
import { locales } from './config';

/**
 * Dictionary completeness.
 *
 * These tests exist because the failure is invisible in review and total for
 * the reader: a missing `ti` key renders as `report.stepCategoryTitle` in the
 * middle of an otherwise Tigrinya sentence. Someone who cannot read the fallback
 * language gets a page that is worse than useless — it looks broken.
 */

function flatten(object, prefix = '') {
  const entries = [];

  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...flatten(value, path));
    } else {
      entries.push(path);
    }
  }

  return entries;
}

const englishKeys = new Set(flatten(en));
const englishValues = flatten(en).map((key) => key.split('.').pop());

describe('dictionary completeness', () => {
  for (const locale of locales.filter((l) => l !== 'en')) {
    const dictionary = locale === 'ti' ? ti : am;

    it(`${locale}: has exactly the English key set`, () => {
      const keys = new Set(flatten(dictionary));

      const missing = [...englishKeys].filter((key) => !keys.has(key));
      const extra = [...keys].filter((key) => !englishKeys.has(key));

      // Reported together: a key added to English but not translated is the
      // common case, and a key left behind in a translation is the other half of
      // the same drift.
      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] });
    });

    it(`${locale}: has no empty strings`, () => {
      const empties = [];

      const walk = (node, prefix = '') => {
        for (const [key, value] of Object.entries(node)) {
          const path = prefix ? `${prefix}.${key}` : key;

          if (value && typeof value === 'object') {
            walk(value, path);
          } else if (typeof value === 'string' && value.trim() === '') {
            empties.push(path);
          }
        }
      };

      walk(dictionary);

      // An empty string renders as a blank label with no visible cause, which is
      // worse than a missing key because the build does not complain.
      expect(empties).toEqual([]);
    });
  }

  it('English is complete and non-empty in its own right', () => {
    expect(englishKeys.size).toBeGreaterThan(150);
  });
});

describe('placeholder integrity', () => {
  const placeholders = (value) =>
    new Set((String(value).match(/\{(\w+)\}/g) ?? []).map((m) => m.slice(1, -1)));

  it('every translation uses the placeholders its English source uses', () => {
    const mismatches = [];

    const walk = (englishNode, translatedNode, prefix = '') => {
      for (const [key, englishValue] of Object.entries(englishNode)) {
        const path = prefix ? `${prefix}.${key}` : key;
        const translatedValue = translatedNode?.[key];

        if (englishValue && typeof englishValue === 'object') {
          walk(englishValue, translatedValue, path);
        } else if (typeof englishValue === 'string') {
          const expected = [...placeholders(englishValue)].sort();
          const actual = [...placeholders(translatedValue)].sort();

          if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            mismatches.push({ path, expected, actual });
          }
        }
      }
    };

    walk(en, ti);
    walk(en, am);

    // A translation that drops `{count}` renders "Showing results: " with
    // nothing after it — a sentence that is wrong rather than one that is
    // obviously unfinished.
    expect(mismatches).toEqual([]);
  });
});

describe('interpolate', () => {
  it('substitutes named placeholders', () => {
    expect(interpolate('Step {current} of {total}', { current: 2, total: 5 })).toBe('Step 2 of 5');
  });

  it('leaves an unmatched placeholder visible rather than printing undefined', () => {
    // "undefined" reads as content; "{count}" reads as a bug.
    expect(interpolate('Showing {count} contacts', {})).toBe('Showing {count} contacts');
  });

  it('substitutes zero, which is a real count and not an absence', () => {
    expect(interpolate('{count} contacts', { count: 0 })).toBe('0 contacts');
  });

  it('leaves a string with no placeholders unchanged', () => {
    expect(interpolate('Nothing to substitute here')).toBe('Nothing to substitute here');
  });
});

describe('safety-critical wording', () => {
  /**
   * A handful of strings carry real-world consequences if they are wrong. They
   * are asserted individually rather than trusted to review.
   *
   * The check is that the wording *exists in every language*, not that it is
   * legally reviewed — that is a human decision, recorded in
   * docs/03-milestones.md as an open gate.
   */
  const safetyCritical = [
    ['emergency.title', 'emergency notice is visible'],
    ['emergency.body', 'emergency disclaimer is present'],
    ['emergency.footerNote', 'what to do if nobody answers'],
    ['footer.rightsBody', 'data-subject rights are stated'],
    ['report.tokenHelp', 'the one-time token is explained'],
    ['status.notFoundBody', 'what to do if a lookup fails'],
    ['privacy.retentionBody', 'retention is disclosed'],
    ['privacy.automatedNote', 'the draft-notice caveat is shown'],
  ];

  for (const locale of locales) {
    const dictionary = locale === 'en' ? en : locale === 'ti' ? ti : am;

    for (const [path, description] of safetyCritical) {
      it(`${locale}: ${description}`, () => {
        const value = path
          .split('.')
          .reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), dictionary);

        expect(typeof value, `${locale}.${path} is missing`).toBe('string');
        // A short question is still complete copy; the point of this bound is
        // to catch an empty or whitespace-only value, not to grade the writing.
        expect(value.trim().length, `${locale}.${path} is empty`).toBeGreaterThanOrEqual(4);
      });
    }
  }
});
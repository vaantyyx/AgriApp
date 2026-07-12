import { describe, test, expect } from 'vitest';
import { translations } from './translations.js';

// Regression guard for the exact class of bug fixed earlier in this project:
// a key present in fr/ar but missing in en (or vice versa) meant a whole
// screen silently fell back to the wrong language for that locale.
describe('translations', () => {
  const locales = Object.keys(translations);

  test('has all three expected locales', () => {
    expect(locales.sort()).toEqual(['ar', 'en', 'fr']);
  });

  test('every locale defines the same set of keys', () => {
    const keySets = Object.fromEntries(locales.map(l => [l, new Set(Object.keys(translations[l]))]));
    const [firstLocale, ...rest] = locales;
    const reference = keySets[firstLocale];

    for (const locale of rest) {
      const current = keySets[locale];
      const missingInCurrent = [...reference].filter(k => !current.has(k));
      const extraInCurrent = [...current].filter(k => !reference.has(k));

      expect(missingInCurrent, `Keys present in "${firstLocale}" but missing in "${locale}"`).toEqual([]);
      expect(extraInCurrent, `Keys present in "${locale}" but missing in "${firstLocale}"`).toEqual([]);
    }
  });

  test('no translation value is an empty string', () => {
    for (const locale of locales) {
      for (const [key, value] of Object.entries(translations[locale])) {
        expect(typeof value === 'string' && value.trim() === '', `${locale}.${key} is empty`).toBe(false);
      }
    }
  });
});

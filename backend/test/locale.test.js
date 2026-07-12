import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocale, SUPPORTED_LOCALES } from '../utils/locale.js';

describe('resolveLocale', () => {
  test('accepts each supported locale unchanged', () => {
    for (const locale of SUPPORTED_LOCALES) {
      assert.equal(resolveLocale(locale), locale);
    }
  });

  test('falls back to fr for an unsupported value', () => {
    assert.equal(resolveLocale('de'), 'fr');
    assert.equal(resolveLocale('EN'), 'fr'); // case-sensitive, not normalized
  });

  test('falls back to fr for missing/invalid input', () => {
    assert.equal(resolveLocale(undefined), 'fr');
    assert.equal(resolveLocale(null), 'fr');
    assert.equal(resolveLocale(''), 'fr');
    assert.equal(resolveLocale(42), 'fr');
  });
});

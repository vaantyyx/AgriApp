// @ts-check

/** @type {readonly ['fr', 'en', 'ar']} */
export const SUPPORTED_LOCALES = /** @type {const} */ (['fr', 'en', 'ar']);

/** @typedef {typeof SUPPORTED_LOCALES[number]} Locale */

/**
 * @param {unknown} raw
 * @returns {Locale}
 */
export function resolveLocale(raw) {
  return SUPPORTED_LOCALES.includes(/** @type {Locale} */ (raw)) ? /** @type {Locale} */ (raw) : 'fr';
}

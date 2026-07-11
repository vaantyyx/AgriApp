export const SUPPORTED_LOCALES = ['fr', 'en', 'ar'];

export function resolveLocale(raw) {
  return SUPPORTED_LOCALES.includes(raw) ? raw : 'fr';
}

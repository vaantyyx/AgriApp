/**
 * CAPTCHA category catalog.
 *
 * Each tile in the CAPTCHA grid is a server-generated SVG (see
 * captchaService.js#renderTileSvg) — no image files, no filesystem scan.
 *
 * To add a category: add one entry below (emoji + color + fr/en/ar label).
 * No other file needs to change — captchaService.js reads this object
 * generically. If real photos ever replace the emoji tiles, only
 * renderTileSvg() needs to change to read a file instead of generating one;
 * this manifest's shape (key -> label) stays the same.
 */
export const CAPTCHA_CATEGORIES = {
  tracteurs:       { emoji: '🚜', color: '#2f6b3a', label: { fr: 'un tracteur',        en: 'a tractor',          ar: 'جرار' } },
  vaches:          { emoji: '🐄', color: '#8a5a34', label: { fr: 'une vache',           en: 'a cow',              ar: 'بقرة' } },
  moutons:         { emoji: '🐑', color: '#6b7280', label: { fr: 'un mouton',           en: 'a sheep',            ar: 'خروف' } },
  chevres:         { emoji: '🐐', color: '#78716c', label: { fr: 'une chèvre',          en: 'a goat',             ar: 'ماعز' } },
  poules:          { emoji: '🐔', color: '#c2410c', label: { fr: 'une poule',           en: 'a chicken',          ar: 'دجاجة' } },
  ble:             { emoji: '🌾', color: '#b45309', label: { fr: 'du blé',              en: 'wheat',              ar: 'قمح' } },
  mais:            { emoji: '🌽', color: '#ca8a04', label: { fr: 'du maïs',             en: 'corn',               ar: 'ذرة' } },
  tomates:         { emoji: '🍅', color: '#b91c1c', label: { fr: 'une tomate',          en: 'a tomato',           ar: 'طماطم' } },
  carottes:        { emoji: '🥕', color: '#c2410c', label: { fr: 'une carotte',         en: 'a carrot',           ar: 'جزر' } },
  irrigation:      { emoji: '💧', color: '#0e7490', label: { fr: "de l'irrigation",     en: 'irrigation',         ar: 'ري' } },
  arbresFruitiers: { emoji: '🍎', color: '#166534', label: { fr: 'un arbre fruitier',   en: 'a fruit tree',       ar: 'شجرة مثمرة' } },
  champsCultives:  { emoji: '🌱', color: '#15803d', label: { fr: 'un champ cultivé',    en: 'a cultivated field', ar: 'حقل مزروع' } },
};

export function getCategoryLabel(key, locale) {
  const cat = CAPTCHA_CATEGORIES[key];
  if (!cat) return key;
  return cat.label[locale] || cat.label.fr;
}

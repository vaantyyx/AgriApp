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
  pommes:          { emoji: '🍎', color: '#b91c1c', label: { fr: 'une pomme', en: 'an apple', ar: 'تفاحة' } },
  pommesVertes:    { emoji: '🍏', color: '#65a30d', label: { fr: 'une pomme verte', en: 'a green apple', ar: 'تفاح أخضر' } },
  bananes:         { emoji: '🍌', color: '#eab308', label: { fr: 'une banane', en: 'a banana', ar: 'موز' } },
  raisins:         { emoji: '🍇', color: '#6d28d9', label: { fr: 'du raisin', en: 'grapes', ar: 'عنب' } },
  fraises:         { emoji: '🍓', color: '#dc2626', label: { fr: 'une fraise', en: 'a strawberry', ar: 'فراولة' } },
  myrtilles:       { emoji: '🫐', color: '#1d4ed8', label: { fr: 'des myrtilles', en: 'blueberries', ar: 'توت أزرق' } },
  cerises:         { emoji: '🍒', color: '#991b1b', label: { fr: 'des cerises', en: 'cherries', ar: 'كرز' } },
  peches:          { emoji: '🍑', color: '#f97316', label: { fr: 'une pêche', en: 'a peach', ar: 'خوخ' } },
  poires:          { emoji: '🍐', color: '#84cc16', label: { fr: 'une poire', en: 'a pear', ar: 'كمثرى' } },
  ananas:          { emoji: '🍍', color: '#ca8a04', label: { fr: 'un ananas', en: 'a pineapple', ar: 'أناناس' } },
  kiwis:           { emoji: '🥝', color: '#65a30d', label: { fr: 'un kiwi', en: 'a kiwi', ar: 'كيوي' } },
  noixDeCoco:      { emoji: '🥥', color: '#92400e', label: { fr: 'une noix de coco', en: 'a coconut', ar: 'جوز الهند' } },
  pasteques:       { emoji: '🍉', color: '#166534', label: { fr: 'une pastèque', en: 'a watermelon', ar: 'بطيخ' } },
  melons:          { emoji: '🍈', color: '#ca8a04', label: { fr: 'un melon', en: 'a melon', ar: 'شمام' } },
  mangues:         { emoji: '🥭', color: '#f59e0b', label: { fr: 'une mangue', en: 'a mango', ar: 'مانجو' } },
  citrons:         { emoji: '🍋', color: '#eab308', label: { fr: 'un citron', en: 'a lemon', ar: 'ليمون' } },
  oranges:         { emoji: '🍊', color: '#ea580c', label: { fr: 'une orange', en: 'an orange', ar: 'برتقال' } },
  mandarines:      { emoji: '🍊', color: '#f97316', label: { fr: 'une mandarine', en: 'a mandarin', ar: 'يوسفي' } },
  aubergines:      { emoji: '🍆', color: '#581c87', label: { fr: 'une aubergine', en: 'an eggplant', ar: 'باذنجان' } },
  piments:         { emoji: '🌶️', color: '#dc2626', label: { fr: 'un piment', en: 'a chili pepper', ar: 'فلفل حار' } },
  poivrons:        { emoji: '🫑', color: '#16a34a', label: { fr: 'un poivron', en: 'a bell pepper', ar: 'فلفل' } },
  concombres:      { emoji: '🥒', color: '#22c55e', label: { fr: 'un concombre', en: 'a cucumber', ar: 'خيار' } },
  salades:         { emoji: '🥬', color: '#65a30d', label: { fr: 'de la laitue', en: 'lettuce', ar: 'خس' } },
  brocolis:        { emoji: '🥦', color: '#166534', label: { fr: 'un brocoli', en: 'broccoli', ar: 'بروكلي' } },
  ail:             { emoji: '🧄', color: '#a8a29e', label: { fr: "de l'ail", en: 'garlic', ar: 'ثوم' } },
  oignons:         { emoji: '🧅', color: '#b45309', label: { fr: 'un oignon', en: 'an onion', ar: 'بصل' } },
  champignons:     { emoji: '🍄', color: '#b91c1c', label: { fr: 'un champignon', en: 'a mushroom', ar: 'فطر' } },
  pommesDeTerre:   { emoji: '🥔', color: '#92400e', label: { fr: 'une pomme de terre', en: 'a potato', ar: 'بطاطا' } },
  patatesDouces:   { emoji: '🍠', color: '#c2410c', label: { fr: 'une patate douce', en: 'a sweet potato', ar: 'بطاطا حلوة' } },
  haricots:        { emoji: '🫘', color: '#7c2d12', label: { fr: 'des haricots', en: 'beans', ar: 'فاصوليا' } },
  petitsPois:      { emoji: '🫛', color: '#16a34a', label: { fr: 'des petits pois', en: 'peas', ar: 'بازلاء' } },
  tournesols:      { emoji: '🌻', color: '#eab308', label: { fr: 'un tournesol', en: 'a sunflower', ar: 'عباد الشمس' } },
  fleurs:          { emoji: '🌼', color: '#ca8a04', label: { fr: 'une fleur', en: 'a flower', ar: 'زهرة' } },
  arbres:          { emoji: '🌳', color: '#166534', label: { fr: 'un arbre', en: 'a tree', ar: 'شجرة' } },
  jeunesArbres:    { emoji: '🌱', color: '#22c55e', label: { fr: 'une jeune pousse', en: 'a seedling', ar: 'نبتة' } },
  feuilles:        { emoji: '🍃', color: '#22c55e', label: { fr: 'une feuille', en: 'a leaf', ar: 'ورقة' } },
  lapins:          { emoji: '🐇', color: '#a8a29e', label: { fr: 'un lapin', en: 'a rabbit', ar: 'أرنب' } },
  canards:         { emoji: '🦆', color: '#0891b2', label: { fr: 'un canard', en: 'a duck', ar: 'بطة' } },
  oies:            { emoji: '🪿', color: '#78716c', label: { fr: 'une oie', en: 'a goose', ar: 'إوزة' } },
  coqs:            { emoji: '🐓', color: '#c2410c', label: { fr: 'un coq', en: 'a rooster', ar: 'ديك' } },
  chevaux:         { emoji: '🐎', color: '#8a5a34', label: { fr: 'un cheval', en: 'a horse', ar: 'حصان' } },
  anes:            { emoji: '🫏', color: '#78716c', label: { fr: 'un âne', en: 'a donkey', ar: 'حمار' } },
  cochons:         { emoji: '🐖', color: '#db2777', label: { fr: 'un cochon', en: 'a pig', ar: 'خنزير' } },
};

export function getCategoryLabel(key, locale) {
  const cat = CAPTCHA_CATEGORIES[key];
  if (!cat) return key;
  return cat.label[locale] || cat.label.fr;
}

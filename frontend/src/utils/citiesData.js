// Lazily fetches public/cities.json (69 wilayas + 1541 communes, each with a
// French/Latin and an Arabic name) and caches the result at module scope, so
// every caller across the app shares one fetch instead of each component
// loading its own copy.
let citiesPromise = null;

export function loadCitiesData() {
  if (!citiesPromise) {
    citiesPromise = fetch('/cities.json')
      .then(r => r.json())
      .catch(() => ({ wilayas: [], communes: [] }));
  }
  return citiesPromise;
}

/** Translates a stored French/Latin commune name to Arabic when locale is 'ar'; falls back to the original name otherwise or if not found. */
export function communeDisplayName(communes, latinName, locale) {
  if (locale !== 'ar' || !latinName) return latinName;
  const c = communes.find(c => c.commune_name_latin.toLowerCase() === latinName.toLowerCase());
  return c ? c.commune_name_arabic : latinName;
}

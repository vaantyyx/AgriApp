/**
 * Approximate geographic centers (latitude, longitude) for each of Algeria's 69 wilayas.
 * Sources: approximate administrative centroids.
 *
 * `name` is the canonical (French/Latin) wilaya name — this is what's stored
 * everywhere in the app (forms, DB). `nameAr` is only used for display when
 * the UI locale is Arabic (see wilayaLabel below); there is no separate
 * English form, wilaya names are kept as their Latin transliteration in en.
 */
export const WILAYA_COORDS = {
  1:  { lat: 27.87,  lng: -0.29,  name: 'Adrar', nameAr: 'أدرار' },
  2:  { lat: 36.17,  lng: 1.33,   name: 'Chlef', nameAr: 'الشلف' },
  3:  { lat: 33.80,  lng: 2.88,   name: 'Laghouat', nameAr: 'الأغواط' },
  4:  { lat: 35.93,  lng: 7.11,   name: 'Oum El Bouaghi', nameAr: 'أم البواقي' },
  5:  { lat: 35.56,  lng: 6.17,   name: 'Batna', nameAr: 'باتنة' },
  6:  { lat: 36.75,  lng: 5.08,   name: 'Bejaia', nameAr: 'بجاية' },
  7:  { lat: 34.85,  lng: 5.73,   name: 'Biskra', nameAr: 'بسكرة' },
  8:  { lat: 31.61,  lng: -2.21,  name: 'Bechar', nameAr: 'بشار' },
  9:  { lat: 36.47,  lng: 2.83,   name: 'Blida', nameAr: 'البليدة' },
  10: { lat: 36.37,  lng: 3.90,   name: 'Bouira', nameAr: 'البويرة' },
  11: { lat: 22.79,  lng: 5.52,   name: 'Tamanrasset', nameAr: 'تمنراست' },
  12: { lat: 35.40,  lng: 8.12,   name: 'Tebessa', nameAr: 'تبسة' },
  13: { lat: 34.88,  lng: -1.32,  name: 'Tlemcen', nameAr: 'تلمسان' },
  14: { lat: 35.37,  lng: 1.32,   name: 'Tiaret', nameAr: 'تيارت' },
  15: { lat: 36.71,  lng: 4.05,   name: 'Tizi Ouzou', nameAr: 'تيزي وزو' },
  16: { lat: 36.73,  lng: 3.09,   name: 'Alger', nameAr: 'الجزائر' },
  17: { lat: 34.67,  lng: 3.25,   name: 'Djelfa', nameAr: 'الجلفة' },
  18: { lat: 36.82,  lng: 5.77,   name: 'Jijel', nameAr: 'جيجل' },
  19: { lat: 36.19,  lng: 5.41,   name: 'Setif', nameAr: 'سطيف' },
  20: { lat: 34.83,  lng: 0.15,   name: 'Saida', nameAr: 'سعيدة' },
  21: { lat: 36.90,  lng: 6.91,   name: 'Skikda', nameAr: 'سكيكدة' },
  22: { lat: 35.19,  lng: -0.63,  name: 'Sidi Bel Abbes', nameAr: 'سيدي بلعباس' },
  23: { lat: 36.90,  lng: 7.77,   name: 'Annaba', nameAr: 'عنابة' },
  24: { lat: 36.46,  lng: 7.43,   name: 'Guelma', nameAr: 'قالمة' },
  25: { lat: 36.37,  lng: 6.61,   name: 'Constantine', nameAr: 'قسنطينة' },
  26: { lat: 36.27,  lng: 2.75,   name: 'Medea', nameAr: 'المدية' },
  27: { lat: 35.93,  lng: 0.09,   name: 'Mostaganem', nameAr: 'مستغانم' },
  28: { lat: 35.70,  lng: 4.54,   name: 'M\'Sila', nameAr: 'المسيلة' },
  29: { lat: 35.40,  lng: 0.14,   name: 'Mascara', nameAr: 'معسكر' },
  30: { lat: 31.95,  lng: 5.33,   name: 'Ouargla', nameAr: 'ورقلة' },
  31: { lat: 35.70,  lng: -0.63,  name: 'Oran', nameAr: 'وهران' },
  32: { lat: 33.68,  lng: 1.02,   name: 'El Bayadh', nameAr: 'البيض' },
  33: { lat: 26.50,  lng: 8.47,   name: 'Illizi', nameAr: 'إليزي' },
  34: { lat: 36.07,  lng: 4.76,   name: 'Bordj Bou Arreridj', nameAr: 'برج بوعريريج' },
  35: { lat: 36.77,  lng: 3.48,   name: 'Boumerdes', nameAr: 'بومرداس' },
  36: { lat: 36.77,  lng: 8.31,   name: 'El Tarf', nameAr: 'الطارف' },
  37: { lat: 27.67,  lng: -8.14,  name: 'Tindouf', nameAr: 'تندوف' },
  38: { lat: 35.59,  lng: 1.81,   name: 'Tissemsilt', nameAr: 'تيسمسيلت' },
  39: { lat: 33.37,  lng: 6.86,   name: 'El Oued', nameAr: 'الوادي' },
  40: { lat: 35.43,  lng: 7.14,   name: 'Khenchela', nameAr: 'خنشلة' },
  41: { lat: 36.29,  lng: 7.94,   name: 'Souk Ahras', nameAr: 'سوق أهراس' },
  42: { lat: 36.58,  lng: 2.46,   name: 'Tipaza', nameAr: 'تيبازة' },
  43: { lat: 36.45,  lng: 6.27,   name: 'Mila', nameAr: 'ميلة' },
  44: { lat: 36.26,  lng: 1.97,   name: 'Ain Defla', nameAr: 'عين الدفلى' },
  45: { lat: 33.27,  lng: -0.31,  name: 'Naama', nameAr: 'النعامة' },
  46: { lat: 35.30,  lng: -1.14,  name: 'Ain Temouchent', nameAr: 'عين تموشنت' },
  47: { lat: 32.49,  lng: 3.67,   name: 'Ghardaia', nameAr: 'غرداية' },
  48: { lat: 35.73,  lng: 0.56,   name: 'Relizane', nameAr: 'غليزان' },
  49: { lat: 29.26,  lng: 0.23,   name: 'Timimoun', nameAr: 'تيميمون' },
  50: { lat: 21.33,  lng: 0.95,   name: 'Bordj Badji Mokhtar', nameAr: 'برج باجي مختار' },
  51: { lat: 34.42,  lng: 5.07,   name: 'Ouled Djellal', nameAr: 'أولاد جلال' },
  52: { lat: 30.13,  lng: -2.16,  name: 'Beni Abbes', nameAr: 'بني عباس' },
  53: { lat: 27.22,  lng: 2.47,   name: 'In Salah', nameAr: 'عين صالح' },
  54: { lat: 19.57,  lng: 5.77,   name: 'In Guezzam', nameAr: 'عين قزام' },
  55: { lat: 33.09,  lng: 6.06,   name: 'Touggourt', nameAr: 'تقرت' },
  56: { lat: 24.56,  lng: 9.48,   name: 'Djanet', nameAr: 'جانت' },
  57: { lat: 33.93,  lng: 6.13,   name: 'El M\'Ghair', nameAr: 'المغير' },
  58: { lat: 30.58,  lng: 2.88,   name: 'El Meniaa', nameAr: 'المنيعة' },
  59: { lat: 33.81,  lng: 2.01,   name: 'Aflou', nameAr: 'أفلو' },
  60: { lat: 32.89,  lng: 0.53,   name: 'El Abiodh Sidi Cheikh', nameAr: 'الأبيض سيدي الشيخ' },
  61: { lat: 34.22,  lng: -1.26,  name: 'El Aricha', nameAr: 'العريشة' },
  62: { lat: 35.02,  lng: 5.73,   name: 'El Kantara', nameAr: 'القنطرة' },
  63: { lat: 35.38,  lng: 5.37,   name: 'Barika', nameAr: 'بريكة' },
  64: { lat: 35.21,  lng: 4.18,   name: 'Bou Saada', nameAr: 'بوسعادة' },
  65: { lat: 35.01,  lng: 7.94,   name: 'Bir El Ater', nameAr: 'بير العاتر' },
  66: { lat: 35.88,  lng: 2.75,   name: 'Ksar El Boukhari', nameAr: 'قصر البخاري' },
  67: { lat: 35.18,  lng: 2.32,   name: 'Ksar Chellala', nameAr: 'قصر الشلالة' },
  68: { lat: 35.45,  lng: 2.64,   name: 'Ain Oussara', nameAr: 'عين وسارة' },
  69: { lat: 34.15,  lng: 3.55,   name: 'Messaad', nameAr: 'مسعد' },
};

/**
 * Haversine formula – returns distance in kilometers between two lat/lng points.
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Returns approximate coordinates for a commune using a deterministic offset
 * derived from the commune's ID. This gives each commune a unique but stable
 * position within its wilaya, without needing coordinate data for each commune.
 *
 * Spread radius: ~0.5 degrees (~55 km max offset), which keeps communes
 * reasonably within their wilaya's territory.
 */
export function getCommuneCoords(wilayaId, communeId) {
  if (!wilayaId) return { lat: 36.73, lng: 3.09 };

  const wId = parseInt(wilayaId);
  const base = (!isNaN(wId) && WILAYA_COORDS[wId])
    ? WILAYA_COORDS[wId]
    : getCoordsForWilayaName(String(wilayaId));

  if (!base) return { lat: 36.73, lng: 3.09 }; // fallback to Algiers
  if (!communeId) return { lat: base.lat, lng: base.lng };

  // Deterministic offset using communeId as a seed
  let seed = 0;
  const cId = parseInt(communeId);
  if (!isNaN(cId)) {
    seed = cId * 2654435761; // Knuth multiplicative hash
  } else {
    const cStr = String(communeId);
    for (let i = 0; i < cStr.length; i++) {
      seed = (seed << 5) - seed + cStr.charCodeAt(i);
      seed |= 0; // Convert to 32bit integer
    }
  }

  const u1 = ((seed & 0xFFFF) / 0xFFFF) - 0.5;          // [-0.5, 0.5]
  const u2 = (((seed >> 16) & 0xFFFF) / 0xFFFF) - 0.5;  // [-0.5, 0.5]

  const SPREAD = 0.45; // degrees
  return {
    lat: base.lat + u1 * SPREAD,
    lng: base.lng + u2 * SPREAD,
  };
}

/**
 * Returns the center coordinates of a wilaya by its name (string match).
 */
export function getCoordsForWilayaName(wilayaName) {
  if (!wilayaName) return null;
  const entry = Object.values(WILAYA_COORDS).find(
    w => w.name.toLowerCase() === wilayaName.toLowerCase()
  );
  return entry ? { lat: entry.lat, lng: entry.lng } : null;
}

/**
 * Returns the wilaya ID for a given wilaya name.
 */
export function getWilayaIdForName(wilayaName) {
  if (!wilayaName) return null;
  const entry = Object.entries(WILAYA_COORDS).find(
    ([, w]) => w.name.toLowerCase() === wilayaName.toLowerCase()
  );
  return entry ? parseInt(entry[0]) : null;
}

/**
 * Display label for a wilaya, translated for the given locale. The
 * canonical (stored) name stays French/Latin — only the label shown to the
 * user changes. No separate English name exists, so 'en' falls back to the
 * Latin name, same as 'fr'.
 */
export function wilayaDisplayName(wilayaIdOrName, locale) {
  const entry = typeof wilayaIdOrName === 'number' || /^\d+$/.test(String(wilayaIdOrName))
    ? WILAYA_COORDS[parseInt(wilayaIdOrName)]
    : Object.values(WILAYA_COORDS).find(w => w.name.toLowerCase() === String(wilayaIdOrName).toLowerCase());
  if (!entry) return typeof wilayaIdOrName === 'string' ? wilayaIdOrName : '';
  return locale === 'ar' ? entry.nameAr : entry.name;
}

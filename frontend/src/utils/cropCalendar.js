/**
 * Indicative sowing/harvest month ranges (1-12) for Algeria's climate.
 * Keyed by the exact French crop-name strings stored on a parcelle's
 * `cultures[].sous_type_culture` (see ProducerParcellesPage.jsx's `subTypes`).
 * Perennial crops (trees/vines) only carry a harvest window.
 */
export const CROP_CALENDAR = {
  'Blé Dur': { sowing: [11, 12], harvest: [6, 7] },
  'Blé Tendre': { sowing: [11, 12], harvest: [6, 7] },
  'Orge': { sowing: [10, 11], harvest: [5, 6] },
  'Maïs': { sowing: [4, 5], harvest: [9, 10] },
  'Avoine': { sowing: [10, 11], harvest: [6] },
  'Légumineuses': { sowing: [11, 12], harvest: [5, 6] },

  'Olivier': { sowing: [], harvest: [11, 12, 1], perennial: true },
  'Pommier': { sowing: [], harvest: [8, 9, 10], perennial: true },
  'Agrumes': { sowing: [], harvest: [11, 12, 1, 2, 3], perennial: true },
  'Datte': { sowing: [], harvest: [10, 11, 12], perennial: true },
  'Amandier': { sowing: [], harvest: [8, 9], perennial: true },
  'Cerisier': { sowing: [], harvest: [5, 6], perennial: true },
  'Figuier': { sowing: [], harvest: [8, 9], perennial: true },
  'Abricotier': { sowing: [], harvest: [6, 7], perennial: true },

  'Tomate': { sowing: [3, 4], harvest: [6, 7, 8] },
  'Pomme de terre': { sowing: [2, 3], harvest: [5, 6] },
  'Oignon': { sowing: [9, 10], harvest: [5, 6] },
  'Piment': { sowing: [3, 4], harvest: [7, 8, 9] },
  'Laitue': { sowing: [9, 10], harvest: [11, 12] },
  'Carotte': { sowing: [2, 3], harvest: [5, 6] },
  'Melon': { sowing: [3, 4], harvest: [7, 8] },
  'Pastèque': { sowing: [3, 4], harvest: [7, 8] },

  'Luzerne': { sowing: [9, 10], harvest: [4, 5, 6, 7, 8, 9], perennial: true },
  'Sorgho': { sowing: [4, 5], harvest: [8, 9] },
  'Bersim': { sowing: [10, 11], harvest: [2, 3, 4] },
  'Maïs fourrager': { sowing: [4, 5], harvest: [8, 9] },

  'Raisin de table': { sowing: [], harvest: [8, 9], perennial: true },
  'Raisin de cuve': { sowing: [], harvest: [9, 10], perennial: true },
};

/** Used when a parcelle only specifies a culture category with no sub-type. */
export const CATEGORY_FALLBACK = {
  'Grandes Cultures': { sowing: [11, 12], harvest: [6, 7] },
  'Arboriculture': { sowing: [], harvest: [9, 10, 11], perennial: true },
  'Maraîchage': { sowing: [3, 4], harvest: [6, 7, 8] },
  'Fourrage': { sowing: [4, 5], harvest: [8, 9] },
  'Viticulture': { sowing: [], harvest: [8, 9], perennial: true },
};

export function getCropInfo(cropName, categoryName) {
  return CROP_CALENDAR[cropName] || CATEGORY_FALLBACK[categoryName] || null;
}

export const IRRIGATION_TIP_KEYS = {
  'Goutte à goutte': 'irrigationTip_GoutteAGoutte',
  'Aspersion': 'irrigationTip_Aspersion',
  'Gravitaire': 'irrigationTip_Gravitaire',
  'Pluvial': 'irrigationTip_Pluvial',
  'Pivot': 'irrigationTip_Pivot',
};

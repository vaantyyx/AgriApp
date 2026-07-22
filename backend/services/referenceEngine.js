// Bloc A — reference price engine (محرك السعر المرجعي).
//
// Neither a wholesale-price API nor recurring manual admin entry is
// available, so this engine is built entirely from AgriApp's own data: the
// "settled deals" leg of the PDF's design (trimmed median of accepted bids)
// combined with a seasonal modifier derived from the existing crop calendar.
// The "public data" leg from the PDF is deliberately dropped.
//
// Because a self-generated reference is easier to game than an independent
// external source (a handful of colluding accounts could settle fake deals
// to move it), two guards compensate:
//   - MIN_SAMPLE_SIZE: a (product, wilaya, unit) combo is only trusted once
//     enough recent deals back it; below that there is no reference at all
//     for that wilaya (see getReferencePrice) — deliberately not blended
//     with other wilayas, since prices can genuinely differ by region.
//   - MAX_DAILY_CHANGE_PERCENT: each recompute is clamped relative to
//     yesterday's stored value, so a burst of deals can't swing the
//     reference in one step.
//
// Cold start is expected and handled gracefully: for most (product, wilaya)
// pairs there will be no reference for a while — validateTender() already
// treats a missing reference as "no data yet", not as a rejection.

import { PRODUCTS_MAP, getWilayaNameById } from './auctionMatching.js';

export const SETTLEMENT_WINDOW_DAYS = 60;
export const MIN_SAMPLE_SIZE = 5;
export const TRIM_RATIO = 0.1;
export const MAX_DAILY_CHANGE_PERCENT = 10;

// Harvest-month windows, mirrored from frontend/src/utils/cropCalendar.js —
// keep both in sync if either changes. Only harvest months matter here: a
// crop in harvest means abundant local supply (reference pulled down);
// outside harvest it's scarcer (reference pushed up). This is the heuristic
// stand-in for the LSTM forecast in the PDF (decision: no ML for now).
const HARVEST_MONTHS = {
  'Blé Dur': [6, 7], 'Blé Tendre': [6, 7], 'Orge': [5, 6], 'Maïs': [9, 10],
  'Avoine': [6], 'Légumineuses': [5, 6],
  'Olivier': [11, 12, 1], 'Pommier': [8, 9, 10], 'Agrumes': [11, 12, 1, 2, 3],
  'Datte': [10, 11, 12], 'Amandier': [8, 9], 'Cerisier': [5, 6],
  'Figuier': [8, 9], 'Abricotier': [6, 7],
  'Tomate': [6, 7, 8], 'Pomme de terre': [5, 6], 'Oignon': [5, 6],
  'Piment': [7, 8, 9], 'Laitue': [11, 12], 'Carotte': [5, 6],
  'Melon': [7, 8], 'Pastèque': [7, 8],
  'Luzerne': [4, 5, 6, 7, 8, 9], 'Sorgho': [8, 9], 'Bersim': [2, 3, 4],
  'Maïs fourrager': [8, 9],
  'Raisin de table': [8, 9], 'Raisin de cuve': [9, 10],
};

const IN_HARVEST_MODIFIER = 0.92;
const OUT_OF_HARVEST_MODIFIER = 1.05;

/** 0.92 in harvest (abundant supply), 1.05 otherwise, 1 for an unknown crop. */
export function getSeasonalModifier(cropName, date = new Date()) {
  const months = HARVEST_MONTHS[cropName];
  if (!months || months.length === 0) return 1;
  const month = date.getMonth() + 1;
  return months.includes(month) ? IN_HARVEST_MODIFIER : OUT_OF_HARVEST_MODIFIER;
}

/** Median of `values` after dropping the top/bottom TRIM_RATIO fraction. Returns null for an empty array. */
export function trimmedMedian(values) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * TRIM_RATIO);
  const trimmed = (trimCount > 0 && sorted.length - 2 * trimCount > 0)
    ? sorted.slice(trimCount, sorted.length - trimCount)
    : sorted;
  const mid = Math.floor(trimmed.length / 2);
  return trimmed.length % 2 !== 0
    ? trimmed[mid]
    : (trimmed[mid - 1] + trimmed[mid]) / 2;
}

/** Clamps `newPrice` to at most ±MAX_DAILY_CHANGE_PERCENT away from `previousPrice`. No-op when there's no prior value. */
export function applyRateCap(newPrice, previousPrice) {
  if (previousPrice == null || !(previousPrice > 0)) return newPrice;
  const maxUp = previousPrice * (1 + MAX_DAILY_CHANGE_PERCENT / 100);
  const maxDown = previousPrice * (1 - MAX_DAILY_CHANGE_PERCENT / 100);
  return Math.min(Math.max(newPrice, maxDown), maxUp);
}

/** A single comparable price for an accepted bid — the average across its lines when it has several. */
export function acceptedBidPrice(bid) {
  const lines = bid?.lines || [];
  if (lines.length === 0) return null;
  const sum = lines.reduce((acc, l) => acc + (parseFloat(l.price) || 0), 0);
  const avg = sum / lines.length;
  return avg > 0 ? avg : null;
}

/**
 * Recomputes and upserts the reference price for every (product, wilaya,
 * unit) combo with enough recent settled deals, strictly within that wilaya
 * — combos below MIN_SAMPLE_SIZE are left untouched (no cross-wilaya
 * blending). Meant to run once a day (see server.js); safe to re-run any time.
 */
export async function recomputeReferencePrices(db, { now = new Date() } = {}) {
  const since = new Date(now.getTime() - SETTLEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const settled = await db.collection('auctions').find({
    status: 'closed',
    acceptedBidId: { $ne: null },
    createdAt: { $gte: since.toISOString() },
  }, { projection: { lots: 1, bids: 1, acceptedBidId: 1 } }).toArray();

  const wilayaGroups = new Map();

  for (const auction of settled) {
    const productId = auction.lots?.[0]?.productId;
    // Grouped by the lot's *origin* wilaya (where the produce comes from),
    // not the buyer's own account wilaya — a buyer in Alger sourcing from
    // Béjaïa should feed Béjaïa's reference, not Alger's.
    const wilaya = getWilayaNameById(auction.lots?.[0]?.wilayaId);
    if (!productId || !PRODUCTS_MAP[productId] || !wilaya) continue;

    const bid = (auction.bids || []).find(b => b.id === auction.acceptedBidId);
    const price = acceptedBidPrice(bid);
    if (!price) continue;

    const unit = bid.lines?.[0]?.unit || auction.lots?.[0]?.unit || 'tonnes';

    const key = `${productId}::${wilaya}::${unit}`;
    if (!wilayaGroups.has(key)) wilayaGroups.set(key, { productId, wilaya, unit, prices: [] });
    wilayaGroups.get(key).prices.push(price);
  }

  let referencesUpdated = 0;
  for (const { productId, wilaya, unit, prices } of wilayaGroups.values()) {
    if (prices.length < MIN_SAMPLE_SIZE) continue;

    const cropName = PRODUCTS_MAP[productId];
    const rawMedian = trimmedMedian(prices);
    const seasonalModifier = getSeasonalModifier(cropName, now);
    const target = rawMedian * seasonalModifier;

    const key = { productId, wilaya, unit };
    const existing = await db.collection('referencePrices').findOne(key);
    const price = applyRateCap(target, existing?.price ?? null);

    await db.collection('referencePrices').updateOne(
      key,
      {
        $set: {
          ...key,
          crop: cropName,
          price,
          previousPrice: existing?.price ?? null,
          sampleSize: prices.length,
          rawMedian,
          seasonalModifier,
          source: 'settled_deals',
          computedAt: now.toISOString(),
        },
      },
      { upsert: true }
    );
    referencesUpdated++;
  }

  return { wilayaGroupsConsidered: wilayaGroups.size, referencesUpdated };
}

/**
 * Bloc B's price-fairness lookup, strictly scoped to `wilaya` — returns null
 * (never blends in other wilayas) when there isn't enough local history yet.
 */
export async function getReferencePrice(productId, wilaya, unit, db) {
  if (!productId || !wilaya || !db) return null;
  return db.collection('referencePrices').findOne({
    productId, wilaya: wilaya.toLowerCase().trim(), unit: unit || 'tonnes',
  });
}

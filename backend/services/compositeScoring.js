// Bloc C — composite scoring engine (SAW pondéré / weighted-sum, "classement
// aveugle"). Combines four normalized (0-1) criteria per bid: Price 35%,
// Quality 25%, Souk (delivery reliability) 25%, Logistics 15% — matching the
// moteur enchère inversée logigramme.
//
// Quality and Souk come from the producer's history (Bloc D: averageQualityScore
// and averageRating respectively). A producer with no history yet gets the
// neutral score below rather than being penalized or favored — same
// cold-start philosophy as Blocs A and D.

export const DEFAULT_SCORE_WEIGHTS = { price: 0.35, quality: 0.25, souk: 0.25, logistics: 0.15 };
// A live binding (ES module `let` export, not a snapshot) — computeCompositeScore()
// below always reads the current value, so admin-saved weights (see
// setScoreWeights) take effect immediately, no restart needed.
export let SCORE_WEIGHTS = { ...DEFAULT_SCORE_WEIGHTS };
export const NEUTRAL_NORMALIZED_SCORE = 0.5;

/** Called once at server startup (loaded from the `settings` collection, if
 * saved before) and again whenever an admin saves new weights from the
 * dashboard — see PUT /api/admin/score-weights. */
export function setScoreWeights(weights) {
  SCORE_WEIGHTS = { ...weights };
}

/** Maps a 1-5 star average to 0-1. No history yet (count 0) => neutral, not penalized. */
export function normalizeStarAverage(average, count) {
  if (!count || average == null) return NEUTRAL_NORMALIZED_SCORE;
  return Math.min(Math.max((average - 1) / 4, 0), 1);
}

/** Cheaper is better: min-max normalized against every bid on the same auction. */
export function normalizePriceScore(price, allPrices) {
  const valid = (allPrices || []).filter(p => p > 0);
  if (valid.length === 0 || price == null || !(price > 0)) return NEUTRAL_NORMALIZED_SCORE;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return 1;
  return (max - price) / (max - min);
}

/** Closer + cold-chain capable is better. Unknown distance => neutral for that half. */
export function normalizeLogisticsScore({ distanceKm, radiusKm, hasColdChain }) {
  const effectiveRadius = radiusKm > 0 ? radiusKm : 100;
  const distanceScore = distanceKm == null
    ? NEUTRAL_NORMALIZED_SCORE
    : 1 - Math.min(Math.max(distanceKm / effectiveRadius, 0), 1);
  const coldChainScore = hasColdChain ? 1 : 0;
  return distanceScore * 0.7 + coldChainScore * 0.3;
}

/**
 * Returns { score, breakdown } — the composite 0-1 score plus each
 * normalized sub-score, so a buyer's view can show the full breakdown
 * (producers only ever see their own rank, never this breakdown — see
 * sanitizeAuctions in auctionMatching.js).
 */
export function computeCompositeScore({
  price, allPrices,
  qualityAverage, qualityCount,
  soukAverage, soukCount,
  distanceKm, radiusKm, hasColdChain,
}) {
  const priceScore = normalizePriceScore(price, allPrices);
  const qualityScore = normalizeStarAverage(qualityAverage, qualityCount);
  const soukScore = normalizeStarAverage(soukAverage, soukCount);
  const logisticsScore = normalizeLogisticsScore({ distanceKm, radiusKm, hasColdChain });

  const score =
    priceScore * SCORE_WEIGHTS.price +
    qualityScore * SCORE_WEIGHTS.quality +
    soukScore * SCORE_WEIGHTS.souk +
    logisticsScore * SCORE_WEIGHTS.logistics;

  return { score, breakdown: { priceScore, qualityScore, soukScore, logisticsScore } };
}

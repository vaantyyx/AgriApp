import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStarAverage,
  normalizePriceScore,
  normalizeLogisticsScore,
  computeCompositeScore,
  SCORE_WEIGHTS,
  NEUTRAL_NORMALIZED_SCORE,
} from '../services/compositeScoring.js';

describe('normalizeStarAverage', () => {
  test('returns the neutral score for a producer with no rating history', () => {
    assert.equal(normalizeStarAverage(null, 0), NEUTRAL_NORMALIZED_SCORE);
    assert.equal(normalizeStarAverage(undefined, undefined), NEUTRAL_NORMALIZED_SCORE);
  });

  test('maps 1-5 stars to 0-1', () => {
    assert.equal(normalizeStarAverage(1, 3), 0);
    assert.equal(normalizeStarAverage(5, 3), 1);
    assert.equal(normalizeStarAverage(3, 3), 0.5);
  });
});

describe('normalizePriceScore', () => {
  test('the cheapest bid scores 1, the most expensive scores 0', () => {
    const allPrices = [100, 150, 200];
    assert.equal(normalizePriceScore(100, allPrices), 1);
    assert.equal(normalizePriceScore(200, allPrices), 0);
    assert.equal(normalizePriceScore(150, allPrices), 0.5);
  });

  test('returns 1 when every bid is priced the same', () => {
    assert.equal(normalizePriceScore(100, [100, 100, 100]), 1);
  });

  test('returns the neutral score for missing/invalid price data', () => {
    assert.equal(normalizePriceScore(null, [100, 200]), NEUTRAL_NORMALIZED_SCORE);
    assert.equal(normalizePriceScore(100, []), NEUTRAL_NORMALIZED_SCORE);
  });
});

describe('normalizeLogisticsScore', () => {
  test('closer is better', () => {
    const near = normalizeLogisticsScore({ distanceKm: 10, radiusKm: 100, hasColdChain: false });
    const far = normalizeLogisticsScore({ distanceKm: 90, radiusKm: 100, hasColdChain: false });
    assert.ok(near > far);
  });

  test('cold-chain capability adds a bonus at the same distance', () => {
    const withCold = normalizeLogisticsScore({ distanceKm: 50, radiusKm: 100, hasColdChain: true });
    const withoutCold = normalizeLogisticsScore({ distanceKm: 50, radiusKm: 100, hasColdChain: false });
    assert.ok(withCold > withoutCold);
    assert.ok(Math.abs((withCold - withoutCold) - 0.3) < 1e-9);
  });

  test('unknown distance falls back to neutral for that half of the score', () => {
    const unknown = normalizeLogisticsScore({ distanceKm: null, radiusKm: 100, hasColdChain: false });
    assert.equal(unknown, NEUTRAL_NORMALIZED_SCORE * 0.7);
  });
});

describe('computeCompositeScore', () => {
  test('weights sum to 1 (sanity check on the constants)', () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 1) < 1e-9);
  });

  test('a cheaper bid can still lose to a pricier one with better quality/souk/logistics', () => {
    const cheapButWeak = computeCompositeScore({
      price: 80, allPrices: [80, 100],
      qualityAverage: 1, qualityCount: 10,
      soukAverage: 1, soukCount: 10,
      distanceKm: 95, radiusKm: 100, hasColdChain: false,
    });
    const pricierButStrong = computeCompositeScore({
      price: 100, allPrices: [80, 100],
      qualityAverage: 5, qualityCount: 10,
      soukAverage: 5, soukCount: 10,
      distanceKm: 5, radiusKm: 100, hasColdChain: true,
    });
    assert.ok(pricierButStrong.score > cheapButWeak.score, '"le moins cher peut perdre" — the PDF\'s own framing');
  });

  test('new producers (no quality/souk history) are neutral, not penalized', () => {
    const newProducer = computeCompositeScore({
      price: 100, allPrices: [100, 100],
      qualityAverage: null, qualityCount: 0,
      soukAverage: null, soukCount: 0,
      distanceKm: 50, radiusKm: 100, hasColdChain: false,
    });
    // price 1 (a tie among all bids scores everyone the max) *0.35
    // + quality 0.5 (neutral, no history) *0.25 + souk 0.5 (neutral) *0.25
    // + logistics (0.5 distance-neutral * 0.7) *0.15
    const expected = 1 * 0.35 + 0.5 * 0.25 + 0.5 * 0.25 + (0.5 * 0.7) * 0.15;
    assert.ok(Math.abs(newProducer.score - expected) < 1e-9);
    // The quality/souk components specifically are neutral, not zero/penalized.
    assert.equal(newProducer.breakdown.qualityScore, NEUTRAL_NORMALIZED_SCORE);
    assert.equal(newProducer.breakdown.soukScore, NEUTRAL_NORMALIZED_SCORE);
  });

  test('returns the per-criterion breakdown alongside the score', () => {
    const { breakdown } = computeCompositeScore({
      price: 100, allPrices: [100, 200],
      qualityAverage: 5, qualityCount: 2,
      soukAverage: 1, soukCount: 2,
      distanceKm: 0, radiusKm: 100, hasColdChain: true,
    });
    assert.equal(breakdown.priceScore, 1);
    assert.equal(breakdown.qualityScore, 1);
    assert.equal(breakdown.soukScore, 0);
    assert.equal(breakdown.logisticsScore, 1);
  });
});

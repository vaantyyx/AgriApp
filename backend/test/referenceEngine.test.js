import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  trimmedMedian,
  getSeasonalModifier,
  applyRateCap,
  acceptedBidPrice,
  recomputeReferencePrices,
  getReferencePrice,
  MIN_SAMPLE_SIZE,
} from '../services/referenceEngine.js';
import { WILAYA_NAME_TO_ID } from '../services/auctionMatching.js';

describe('trimmedMedian', () => {
  test('returns null for an empty array', () => {
    assert.equal(trimmedMedian([]), null);
  });

  test('plain median when the sample is too small to trim', () => {
    assert.equal(trimmedMedian([10, 20, 30]), 20);
  });

  test('drops extreme outliers from each tail before taking the median', () => {
    // 10 values, TRIM_RATIO=0.1 => 1 dropped from each end (1 and 1000).
    const values = [1, 95, 98, 100, 100, 101, 102, 105, 110, 1000];
    const result = trimmedMedian(values);
    // Remaining after trim: 95,98,100,100,101,102,105,110 -> median of middle two (100,101)
    assert.equal(result, 100.5);
  });
});

describe('getSeasonalModifier', () => {
  test('returns the in-harvest modifier during a crop\'s harvest months', () => {
    const july = new Date('2026-07-15T00:00:00.000Z');
    assert.equal(getSeasonalModifier('Tomate', july), 0.92);
  });

  test('returns the out-of-harvest modifier outside those months', () => {
    const january = new Date('2026-01-15T00:00:00.000Z');
    assert.equal(getSeasonalModifier('Tomate', january), 1.05);
  });

  test('returns 1 for a crop with no calendar entry', () => {
    assert.equal(getSeasonalModifier('Culture Inconnue', new Date()), 1);
  });
});

describe('applyRateCap', () => {
  test('passes the new price through when there is no prior value', () => {
    assert.equal(applyRateCap(150, null), 150);
  });

  test('clamps an increase beyond MAX_DAILY_CHANGE_PERCENT', () => {
    assert.ok(Math.abs(applyRateCap(200, 100) - 110) < 1e-9);
  });

  test('clamps a decrease beyond MAX_DAILY_CHANGE_PERCENT', () => {
    assert.ok(Math.abs(applyRateCap(50, 100) - 90) < 1e-9);
  });

  test('leaves a move within bounds untouched', () => {
    assert.equal(applyRateCap(105, 100), 105);
  });
});

describe('acceptedBidPrice', () => {
  test('returns null when the bid has no lines', () => {
    assert.equal(acceptedBidPrice({ lines: [] }), null);
    assert.equal(acceptedBidPrice(undefined), null);
  });

  test('returns the single line price for a one-line bid', () => {
    assert.equal(acceptedBidPrice({ lines: [{ price: 42 }] }), 42);
  });

  test('averages across lines for a multi-option bid', () => {
    assert.equal(acceptedBidPrice({ lines: [{ price: 10 }, { price: 20 }] }), 15);
  });

  test('returns null for a non-positive average', () => {
    assert.equal(acceptedBidPrice({ lines: [{ price: 0 }] }), null);
  });
});

/** Minimal fake of the MongoDB driver surface recomputeReferencePrices/getReferencePrice actually use. */
function fakeDb(auctions) {
  const referenceStore = new Map();
  const storeKey = (q) => `${q.productId}::${q.wilaya}::${q.unit}`;

  return {
    collection(name) {
      if (name === 'auctions') {
        return {
          find(query) {
            return {
              async toArray() {
                return auctions.filter(a => {
                  if (query.status && a.status !== query.status) return false;
                  if (query.acceptedBidId?.$ne === null && a.acceptedBidId == null) return false;
                  if (query.createdAt?.$gte && a.createdAt < query.createdAt.$gte) return false;
                  return true;
                });
              },
            };
          },
        };
      }
      if (name === 'referencePrices') {
        return {
          async findOne(query) {
            return referenceStore.get(storeKey(query)) || null;
          },
          async updateOne(filter, update) {
            referenceStore.set(storeKey(filter), { ...update.$set });
          },
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
    _referenceStore: referenceStore,
  };
}

// The reference engine groups by the lot's *origin* wilaya (wilayaId), not
// the buyer's own account wilaya — see referenceEngine.js's recompute.
function settledAuction({ productId = '15', wilaya = 'alger', unit = 'tonnes', price, createdAt = '2026-01-15T00:00:00.000Z' }) {
  return {
    status: 'closed',
    acceptedBidId: 'bid1',
    lots: [{ productId, unit, wilayaId: WILAYA_NAME_TO_ID[wilaya] }],
    createdAt,
    bids: [{ id: 'bid1', lines: [{ price, unit }] }],
  };
}

describe('recomputeReferencePrices', () => {
  const now = new Date('2026-01-20T00:00:00.000Z');

  test('skips a (product, wilaya, unit) combo below MIN_SAMPLE_SIZE', async () => {
    assert.ok(MIN_SAMPLE_SIZE > 3);
    const auctions = [100, 101, 102].map(price => settledAuction({ price }));
    const db = fakeDb(auctions);
    const result = await recomputeReferencePrices(db, { now });
    assert.equal(result.referencesUpdated, 0);
  });

  test('computes a wilaya-level reference once enough settled deals exist', async () => {
    const prices = [100, 101, 99, 102, 98];
    const auctions = prices.map(price => settledAuction({ price }));
    const db = fakeDb(auctions);
    await recomputeReferencePrices(db, { now });

    const stored = await getReferencePrice('15', 'alger', 'tonnes', db);
    assert.ok(stored);
    assert.equal(stored.wilaya, 'alger');
    assert.equal(stored.sampleSize, 5);
    assert.equal(stored.crop, 'Tomate');
    // January is outside Tomate's harvest window -> out-of-harvest modifier (1.05) applied to the raw median (100)
    assert.equal(stored.rawMedian, 100);
    assert.equal(stored.price, 105);
  });

  test('ignores auctions outside the settlement window', async () => {
    const recent = [100, 101, 99, 102, 98].map(price => settledAuction({ price }));
    const stale = [1, 2, 3].map(price => settledAuction({ price, createdAt: '2020-01-01T00:00:00.000Z' }));
    const db = fakeDb([...recent, ...stale]);
    await recomputeReferencePrices(db, { now });

    const stored = await getReferencePrice('15', 'alger', 'tonnes', db);
    assert.equal(stored.sampleSize, 5);
  });

  test('never blends other wilayas in: each wilaya must reach MIN_SAMPLE_SIZE on its own', async () => {
    const algerDeals = [100, 102, 98].map(price => settledAuction({ price, wilaya: 'alger' }));
    const oranDeals = [101, 99, 100].map(price => settledAuction({ price, wilaya: 'oran' }));
    const db = fakeDb([...algerDeals, ...oranDeals]);
    const result = await recomputeReferencePrices(db, { now });

    // Neither wilaya alone reaches MIN_SAMPLE_SIZE (3 each) — combining them into a
    // national figure is deliberately not done, so no reference is produced at all.
    assert.equal(result.referencesUpdated, 0);
    assert.equal(await getReferencePrice('15', 'alger', 'tonnes', db), null);
    assert.equal(await getReferencePrice('15', 'oran', 'tonnes', db), null);
  });

  test('clamps a manipulated price spike on the next recompute (rate cap)', async () => {
    const baseline = [100, 101, 99, 102, 98].map(price => settledAuction({ price }));
    const db = fakeDb(baseline);
    await recomputeReferencePrices(db, { now });
    const first = await getReferencePrice('15', 'alger', 'tonnes', db);
    assert.equal(first.price, 105); // 100 raw median * 1.05 seasonal

    // A burst of colluding deals tries to push the price far above the prior reference.
    const spike = [500, 510, 490, 505, 495].map(price => settledAuction({ price }));
    const db2 = fakeDb([...baseline, ...spike]);
    // Seed db2's store with the previous day's reference so the rate cap has something to clamp against.
    await db2.collection('referencePrices').updateOne(
      { productId: '15', wilaya: 'alger', unit: 'tonnes' },
      { $set: { ...first } }
    );
    await recomputeReferencePrices(db2, { now: new Date('2026-01-21T00:00:00.000Z') });
    const second = await getReferencePrice('15', 'alger', 'tonnes', db2);
    // Even though the raw median jumped far above 105, the move is capped at +10%.
    assert.ok(second.price <= first.price * 1.10 + 1e-9);
  });
});

describe('getReferencePrice', () => {
  test('returns null when there is no reference for this wilaya', async () => {
    const db = fakeDb([]);
    const result = await getReferencePrice('15', 'alger', 'tonnes', db);
    assert.equal(result, null);
  });

  test('returns null when productId is missing', async () => {
    const db = fakeDb([]);
    assert.equal(await getReferencePrice(null, 'alger', 'tonnes', db), null);
  });

  test('returns null when wilaya is missing', async () => {
    const db = fakeDb([]);
    assert.equal(await getReferencePrice('15', null, 'tonnes', db), null);
  });
});

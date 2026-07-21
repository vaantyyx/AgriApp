import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineKm,
  getWilayaCoords,
  getCommuneCoords,
  isProducerInZone,
  hasProducerProduct,
  canProducerParticipate,
  sanitizeAuctions,
  wilayaRoomName,
  getAllWilayaRoomNames,
  getEligibleWilayaRooms,
  normalizeRoundConfig,
  computeRoundPriceBounds,
} from '../services/auctionMatching.js';

/** Minimal fake of the MongoDB driver surface these functions actually use. */
function fakeDb(parcellesByUserId) {
  return {
    collection(name) {
      assert.equal(name, 'parcelles');
      return {
        find(query) {
          return {
            async toArray() {
              return parcellesByUserId[query.userId] || [];
            },
          };
        },
      };
    },
  };
}

describe('haversineKm', () => {
  test('distance from a point to itself is 0', () => {
    assert.equal(haversineKm(36.75, 3.06, 36.75, 3.06), 0);
  });

  test('is symmetric', () => {
    const a = haversineKm(36.75, 3.06, 35.70, -0.63);
    const b = haversineKm(35.70, -0.63, 36.75, 3.06);
    assert.ok(Math.abs(a - b) < 1e-9);
  });

  test('roughly matches the real-world Algiers-Oran distance (~350-420km)', () => {
    const dist = haversineKm(36.75, 3.06, 35.70, -0.63);
    assert.ok(dist > 350 && dist < 420, `expected ~350-420km, got ${dist}`);
  });
});

describe('getWilayaCoords', () => {
  test('resolves a known wilaya name', () => {
    const coords = getWilayaCoords('Alger');
    assert.ok(coords);
    assert.equal(coords.lat, 36.73);
  });

  test('is case-insensitive and trims whitespace', () => {
    assert.deepEqual(getWilayaCoords('  ALGER '), getWilayaCoords('alger'));
  });

  test('returns null for an unknown or empty name', () => {
    assert.equal(getWilayaCoords('Atlantis'), null);
    assert.equal(getWilayaCoords(''), null);
    assert.equal(getWilayaCoords(undefined), null);
  });
});

describe('getCommuneCoords', () => {
  test('is deterministic for the same wilaya+commune', () => {
    const a = getCommuneCoords('Alger', 'Bab Ezzouar');
    const b = getCommuneCoords('Alger', 'Bab Ezzouar');
    assert.deepEqual(a, b);
  });

  test('offsets stay near the wilaya center', () => {
    const base = getWilayaCoords('Alger');
    const commune = getCommuneCoords('Alger', 'Bab Ezzouar');
    assert.ok(Math.abs(commune.lat - base.lat) <= 0.25);
    assert.ok(Math.abs(commune.lng - base.lng) <= 0.25);
  });

  test('returns null when the wilaya is unknown', () => {
    assert.equal(getCommuneCoords('Atlantis', 'Anywhere'), null);
  });
});

describe('isProducerInZone', () => {
  const buyerAtAlger = { buyerLat: 36.75, buyerLng: 3.06, radiusKm: 50 };

  test('defaults to true when producer coords are unknown', () => {
    assert.equal(isProducerInZone(buyerAtAlger, null), true);
  });

  test('defaults to true when the buyer has no coordinates', () => {
    assert.equal(isProducerInZone({ radiusKm: 50 }, { lat: 36.75, lng: 3.06 }), true);
  });

  test('true when within radius, false when outside it', () => {
    const nearby = { lat: 36.80, lng: 3.10 }; // a few km away
    const farAway = { lat: 31.95, lng: 5.33 }; // Ouargla, hundreds of km away
    assert.equal(isProducerInZone(buyerAtAlger, nearby), true);
    assert.equal(isProducerInZone(buyerAtAlger, farAway), false);
  });
});

describe('canProducerParticipate', () => {
  const pCoords = { lat: 36.75, lng: 3.06 };

  test('rejects producers outside the zone regardless of auction type', async () => {
    const auction = { buyerLat: 31.95, buyerLng: 5.33, radiusKm: 10, auctionType: 'open' };
    const db = fakeDb({});
    assert.equal(await canProducerParticipate(auction, 'producer1', pCoords, db), false);
  });

  test('open auctions accept any in-zone producer without a product check', async () => {
    const auction = { buyerLat: 36.75, buyerLng: 3.06, radiusKm: 50, auctionType: 'open' };
    const db = fakeDb({}); // no parcelles at all — must not matter for 'open'
    assert.equal(await canProducerParticipate(auction, 'producer1', pCoords, db), true);
  });

  test('smart auctions require the producer to grow a requested product', async () => {
    const auction = {
      buyerLat: 36.75, buyerLng: 3.06, radiusKm: 50, auctionType: 'smart',
      lots: [{ productId: '15' }], // '15' => Tomate, per PRODUCTS_MAP
    };
    const dbWithMatch = fakeDb({
      producer1: [{ userId: 'producer1', cultures: [{ sous_type_culture: ['Tomate'] }] }],
    });
    const dbWithoutMatch = fakeDb({
      producer1: [{ userId: 'producer1', cultures: [{ sous_type_culture: ['Orge'] }] }],
    });
    assert.equal(await canProducerParticipate(auction, 'producer1', pCoords, dbWithMatch), true);
    assert.equal(await canProducerParticipate(auction, 'producer1', pCoords, dbWithoutMatch), false);
  });
});

describe('wilayaRoomName', () => {
  test('resolves a known wilaya to its id-based room', () => {
    assert.equal(wilayaRoomName('Alger'), 'wilaya:16');
  });

  test('is case-insensitive and trims whitespace, like getWilayaCoords', () => {
    assert.equal(wilayaRoomName('  ALGER '), wilayaRoomName('alger'));
  });

  test('falls back to the catch-all room for unknown or empty names', () => {
    assert.equal(wilayaRoomName('Atlantis'), 'wilaya:unknown');
    assert.equal(wilayaRoomName(''), 'wilaya:unknown');
    assert.equal(wilayaRoomName(undefined), 'wilaya:unknown');
  });
});

describe('getEligibleWilayaRooms', () => {
  test('falls back to every wilaya room when the auction has no buyer coordinates', () => {
    const rooms = getEligibleWilayaRooms(null, null, 50);
    assert.deepEqual(rooms.sort(), getAllWilayaRoomNames().sort());
  });

  test('always includes the unknown-location catch-all room', () => {
    const rooms = getEligibleWilayaRooms(36.75, 3.06, 10);
    assert.ok(rooms.includes('wilaya:unknown'));
  });

  test('includes a producer\'s own room whenever isProducerInZone would allow them', () => {
    // Cross-check against the exact per-producer function this coarse
    // filter must never disagree with in the "would wrongly exclude" direction.
    const buyerLat = 36.75, buyerLng = 3.06, radiusKm = 50;
    const rooms = getEligibleWilayaRooms(buyerLat, buyerLng, radiusKm);

    const nearbyProducerCoords = { lat: 36.80, lng: 3.10 }; // a few km from Alger
    const nearbyProducerRoom = wilayaRoomName('Alger');
    assert.equal(
      isProducerInZone({ buyerLat, buyerLng, radiusKm }, nearbyProducerCoords),
      true,
    );
    assert.ok(rooms.includes(nearbyProducerRoom), 'exact-match producer\'s room must be in the coarse candidate set');
  });

  test('excludes distant wilayas outside the radius + buffer', () => {
    // Tamanrasset (far south) shouldn't be a candidate for a 10km-radius Alger auction.
    const rooms = getEligibleWilayaRooms(36.75, 3.06, 10);
    assert.ok(!rooms.includes(wilayaRoomName('Tamanrasset')));
  });
});

describe('hasProducerProduct', () => {
  test('is trivially true when no product is requested', async () => {
    assert.equal(await hasProducerProduct('producer1', [], fakeDb({})), true);
  });

  test('matches case- and whitespace-insensitively', async () => {
    const db = fakeDb({
      producer1: [{ userId: 'producer1', cultures: [{ sous_type_culture: [' tomate '] }] }],
    });
    assert.equal(await hasProducerProduct('producer1', ['Tomate'], db), true);
  });

  test('false when the producer has no matching parcelle', async () => {
    const db = fakeDb({ producer1: [] });
    assert.equal(await hasProducerProduct('producer1', ['Tomate'], db), false);
  });
});

describe('sanitizeAuctions', () => {
  const auction = {
    id: 'auc_1',
    buyerId: 'buyer1',
    buyerName: 'Real Buyer Name',
    product: 'Tomate',
    unit: 'tonnes',
    bids: [
      { id: 'bid_a', producerId: 'producerA', lines: [{ id: 'l1', price: 100 }], timestamp: 't1' },
      { id: 'bid_b', producerId: 'producerB', lines: [{ id: 'l2', price: 80 }], timestamp: 't2' },
    ],
  };

  test('hides the buyer name from everyone except the buyer', () => {
    const [asOtherBuyer] = sanitizeAuctions([auction], 'someone-else', 'buyer');
    const [asRealBuyer] = sanitizeAuctions([auction], 'buyer1', 'buyer');
    assert.equal(asOtherBuyer.buyerDisplay, 'Acheteur Anonyme');
    assert.equal(asRealBuyer.buyerDisplay, 'Real Buyer Name');
  });

  test('aliases producers to competitors, but labels the requester "Vous"', () => {
    const [sanitized] = sanitizeAuctions([auction], 'producerA', 'producer');
    const mine = sanitized.bids.find(b => b.id === 'bid_a');
    const other = sanitized.bids.find(b => b.id === 'bid_b');
    assert.equal(mine.producerAlias, 'Vous');
    assert.equal(other.producerAlias, 'Producteur #1');
  });

  test('hides competitor prices from a producer, but not their own', () => {
    const [sanitized] = sanitizeAuctions([auction], 'producerA', 'producer');
    const mine = sanitized.bids.find(b => b.id === 'bid_a');
    const other = sanitized.bids.find(b => b.id === 'bid_b');
    assert.equal(mine.lines[0].price, 100);
    assert.equal(other.lines[0].price, null);
  });

  test('ranks the cheapest average price first', () => {
    const [sanitized] = sanitizeAuctions([auction], 'producerB', 'producer');
    // producerB bid 80 < producerA bid 100, so producerB should rank 1st.
    assert.equal(sanitized.myRank, 1);
    assert.equal(sanitized.totalBidders, 2);
  });

  test('exposes roundConfig/currentRound/myRoundBounds for a progressive auction, null otherwise', () => {
    const progressiveAuction = {
      ...auction,
      targetPrice: 100,
      roundConfig: { enabled: true, totalRounds: 3, roundDurationHours: 8, maxDecreasePercent: 5, initialMinPercent: 80 },
      currentRound: 1,
      roundStartedAt: '2026-01-01T00:00:00.000Z',
    };
    const [asProducer] = sanitizeAuctions([progressiveAuction], 'producerA', 'producer');
    assert.equal(asProducer.currentRound, 1);
    assert.deepEqual(asProducer.myRoundBounds, { min: 80, max: 100, round: 1 });

    const [asBuyer] = sanitizeAuctions([progressiveAuction], 'buyer1', 'buyer');
    assert.equal(asBuyer.myRoundBounds, null);

    const [nonProgressive] = sanitizeAuctions([auction], 'producerA', 'producer');
    assert.equal(nonProgressive.roundConfig, null);
    assert.equal(nonProgressive.myRoundBounds, null);
  });

  test('only exposes roundHistory on the requesting producer\'s own bid', () => {
    const withHistory = {
      ...auction,
      bids: [
        { ...auction.bids[0], roundHistory: [{ round: 1, price: 100, timestamp: 't1' }] },
        { ...auction.bids[1], roundHistory: [{ round: 1, price: 80, timestamp: 't1' }] },
      ],
    };
    const [sanitized] = sanitizeAuctions([withHistory], 'producerA', 'producer');
    const mine = sanitized.bids.find(b => b.id === 'bid_a');
    const other = sanitized.bids.find(b => b.id === 'bid_b');
    assert.deepEqual(mine.roundHistory, [{ round: 1, price: 100, timestamp: 't1' }]);
    assert.equal(other.roundHistory, null);
  });
});

describe('normalizeRoundConfig', () => {
  test('returns { enabled: false } for missing/disabled input', () => {
    assert.deepEqual(normalizeRoundConfig(undefined), { enabled: false });
    assert.deepEqual(normalizeRoundConfig(null), { enabled: false });
    assert.deepEqual(normalizeRoundConfig({ enabled: false }), { enabled: false });
  });

  test('fills in defaults when enabled with no other fields', () => {
    assert.deepEqual(normalizeRoundConfig({ enabled: true }), {
      enabled: true,
      totalRounds: 3,
      roundDurationHours: 8,
      maxDecreasePercent: 5,
      initialMinPercent: 80,
    });
  });

  test('clamps out-of-range values instead of trusting the client', () => {
    const cfg = normalizeRoundConfig({
      enabled: true,
      totalRounds: 99,
      roundDurationHours: 1,
      maxDecreasePercent: 999,
      initialMinPercent: 1,
    });
    assert.equal(cfg.totalRounds, 5);
    assert.equal(cfg.roundDurationHours, 8);
    assert.equal(cfg.maxDecreasePercent, 20);
    assert.equal(cfg.initialMinPercent, 50);
  });
});

describe('computeRoundPriceBounds', () => {
  const roundConfig = { enabled: true, totalRounds: 3, roundDurationHours: 8, maxDecreasePercent: 5, initialMinPercent: 80 };

  test('returns null when progressive mode is disabled or reference price is missing', () => {
    assert.equal(computeRoundPriceBounds({ roundConfig: { enabled: false }, targetPrice: 100 }, null), null);
    assert.equal(computeRoundPriceBounds({ roundConfig, targetPrice: null }, null), null);
  });

  test('round 1 (first bid) is a free choice within [initialMinPercent%, 100%] of the reference price', () => {
    const auction = { roundConfig, targetPrice: 1000, currentRound: 1 };
    assert.deepEqual(computeRoundPriceBounds(auction, null), { min: 800, max: 1000, round: 1 });
  });

  test('round 1 resubmission is still bound to the reference price, not the prior submission', () => {
    const auction = { roundConfig, targetPrice: 1000, currentRound: 1 };
    const existingBid = { roundHistory: [{ round: 1, price: 850, timestamp: 't1' }] };
    assert.deepEqual(computeRoundPriceBounds(auction, existingBid), { min: 800, max: 1000, round: 1 });
  });

  test('round 2 caps the drop relative to the producer\'s own last price, not the reference price', () => {
    const auction = { roundConfig, targetPrice: 1000, currentRound: 2 };
    const existingBid = { roundHistory: [{ round: 1, price: 900, timestamp: 't1' }] };
    // 900 * (1 - 5/100) = 855
    assert.deepEqual(computeRoundPriceBounds(auction, existingBid), { min: 855, max: 900, round: 2 });
  });

  test('a late joiner (no prior bid) at round 2+ still gets the free round-1 range', () => {
    const auction = { roundConfig, targetPrice: 1000, currentRound: 2 };
    assert.deepEqual(computeRoundPriceBounds(auction, null), { min: 800, max: 1000, round: 2 });
  });

  test('a producer who skipped a round is capped relative to their last actual submission', () => {
    const auction = { roundConfig, targetPrice: 1000, currentRound: 3 };
    // Only bid in round 1; round 2 was skipped.
    const existingBid = { roundHistory: [{ round: 1, price: 900, timestamp: 't1' }] };
    assert.deepEqual(computeRoundPriceBounds(auction, existingBid), { min: 855, max: 900, round: 3 });
  });
});

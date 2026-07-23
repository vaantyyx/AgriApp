import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectRepeatedPairing,
  checkForCollusion,
  MIN_HISTORY_SAMPLE,
  REPEATED_PAIRING_THRESHOLD,
} from '../services/collusionDetection.js';

describe('detectRepeatedPairing', () => {
  test('never flags below MIN_HISTORY_SAMPLE, however lopsided', () => {
    assert.ok(MIN_HISTORY_SAMPLE > 3);
    const allSameProducer = Array(3).fill('p1');
    const result = detectRepeatedPairing(allSameProducer, 'p1');
    assert.equal(result.flagged, false);
    assert.equal(result.ratio, null);
  });

  test('flags a producer winning at/above the threshold share of recent auctions', () => {
    assert.equal(REPEATED_PAIRING_THRESHOLD, 0.7);
    // 4 out of 5 = 80% for p1
    const history = ['p1', 'p1', 'p1', 'p1', 'p2'];
    const result = detectRepeatedPairing(history, 'p1');
    assert.equal(result.flagged, true);
    assert.equal(result.ratio, 0.8);
    assert.equal(result.sampleSize, 5);
  });

  test('does not flag a healthy spread of wins across producers', () => {
    const history = ['p1', 'p2', 'p3', 'p1', 'p4', 'p2'];
    const result = detectRepeatedPairing(history, 'p1');
    assert.equal(result.flagged, false);
  });

  test('does not flag exactly at the boundary just under the threshold', () => {
    // 3 out of 5 = 60%, below the 70% threshold
    const history = ['p1', 'p1', 'p1', 'p2', 'p3'];
    const result = detectRepeatedPairing(history, 'p1');
    assert.equal(result.flagged, false);
    assert.equal(result.ratio, 0.6);
  });
});

/** Minimal fake of the MongoDB driver surface checkForCollusion uses. */
function fakeDb(auctions) {
  return {
    collection(name) {
      assert.equal(name, 'auctions');
      return {
        find(query) {
          return {
            sort() { return this; },
            limit() { return this; },
            async toArray() {
              return auctions.filter(a =>
                a.buyerId === query.buyerId &&
                a.status === query.status &&
                a.id !== query.id.$ne
              );
            },
          };
        },
      };
    },
  };
}

function closedAuction(id, buyerId, winnerProducerId) {
  return {
    id, buyerId, status: 'closed', acceptedBidId: 'bidx',
    bids: [{ id: 'bidx', producerId: winnerProducerId }],
  };
}

describe('checkForCollusion', () => {
  test('flags when one producer dominates a buyer\'s history', async () => {
    const auctions = [
      closedAuction('a1', 'buyer1', 'p1'),
      closedAuction('a2', 'buyer1', 'p1'),
      closedAuction('a3', 'buyer1', 'p1'),
      closedAuction('a4', 'buyer1', 'p1'),
      closedAuction('a5', 'buyer1', 'p2'),
    ];
    const db = fakeDb(auctions);
    const result = await checkForCollusion(db, { buyerId: 'buyer1', producerId: 'p1', excludeAuctionId: 'a6' });
    assert.equal(result.flagged, true);
  });

  test('excludes the given auction id from the history sample', async () => {
    // Without excluding a6, p1's share would be 4/6 = 67% (below threshold);
    // excluding it correctly makes the sample 4/5 = 80% (flagged).
    const auctions = [
      closedAuction('a1', 'buyer1', 'p2'),
      closedAuction('a2', 'buyer1', 'p1'),
      closedAuction('a3', 'buyer1', 'p1'),
      closedAuction('a4', 'buyer1', 'p1'),
      closedAuction('a5', 'buyer1', 'p1'),
      closedAuction('a6', 'buyer1', 'p2'),
    ];
    const db = fakeDb(auctions);
    const result = await checkForCollusion(db, { buyerId: 'buyer1', producerId: 'p1', excludeAuctionId: 'a6' });
    assert.equal(result.sampleSize, 5);
    assert.equal(result.flagged, true);
  });
});

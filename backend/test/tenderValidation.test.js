import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateTender } from '../services/tenderValidation.js';
import { WILAYA_NAME_TO_ID } from '../services/auctionMatching.js';

// Bloc B — a lot with a valid calibre + delivery window, the two fields the
// buyer must pick himself when submitting a tender. Spread into a fixture's
// `lots[0]` wherever a test needs checkStructure() to pass.
const validLot = (extra = {}) => ({ calibre: 'moyen', deliveryWindowHours: 72, ...extra });

describe('validateTender', () => {
  test('accepts a well-formed tender', async () => {
    const auction = {
      buyerId: 'buyer1',
      targetPrice: 100,
      quantity: 5,
      startAt: '2026-01-01T00:00:00.000Z',
      endAt: '2026-01-02T00:00:00.000Z',
      lots: [validLot()],
    };
    const result = await validateTender(auction, null);
    assert.equal(result.fair, true);
    assert.equal(result.reason, null);
    assert.ok(result.checkedAt);
  });

  test('accepts a tender with no price ceiling (open auction, no progressive rounds)', async () => {
    const auction = { buyerId: 'buyer1', targetPrice: null, quantity: 5, lots: [validLot()] };
    const result = await validateTender(auction, null);
    assert.equal(result.fair, true);
  });

  test('rejects a non-positive price ceiling', async () => {
    const auction = { buyerId: 'buyer1', targetPrice: 0, quantity: 5 };
    const result = await validateTender(auction, null);
    assert.equal(result.fair, false);
    assert.equal(result.reason, 'invalid_price');
  });

  test('rejects a negative price ceiling', async () => {
    const auction = { buyerId: 'buyer1', targetPrice: -10, quantity: 5 };
    const result = await validateTender(auction, null);
    assert.equal(result.fair, false);
    assert.equal(result.reason, 'invalid_price');
  });

  test('rejects a non-positive quantity', async () => {
    const auction = { buyerId: 'buyer1', targetPrice: 100, quantity: 0 };
    const result = await validateTender(auction, null);
    assert.equal(result.fair, false);
    assert.equal(result.reason, 'invalid_quantity');
  });

  test('rejects endAt at or before startAt', async () => {
    const sameInstant = {
      buyerId: 'buyer1',
      targetPrice: 100,
      quantity: 5,
      startAt: '2026-01-02T00:00:00.000Z',
      endAt: '2026-01-02T00:00:00.000Z',
    };
    const result = await validateTender(sameInstant, null);
    assert.equal(result.fair, false);
    assert.equal(result.reason, 'invalid_dates');

    const reversed = { ...sameInstant, endAt: '2026-01-01T00:00:00.000Z' };
    const result2 = await validateTender(reversed, null);
    assert.equal(result2.fair, false);
    assert.equal(result2.reason, 'invalid_dates');
  });

  test('referenceUsed is null with no db (e.g. no reference data yet)', async () => {
    const auction = { buyerId: 'buyer1', targetPrice: 100, quantity: 5, lots: [validLot()] };
    const result = await validateTender(auction, null);
    assert.equal(result.fair, true);
    assert.equal(result.referenceUsed, null);
  });
});

describe('validateTender — Bloc B calibre / delivery window', () => {
  const base = { buyerId: 'buyer1', targetPrice: 100, quantity: 5 };

  test('rejects a tender with no calibre selected', async () => {
    const auction = { ...base, lots: [{ deliveryWindowHours: 72 }] };
    const result = await validateTender(auction, null);
    assert.equal(result.fair, false);
    assert.equal(result.reason, 'invalid_calibre');
  });

  test('rejects a tender with an unrecognized calibre value', async () => {
    const auction = { ...base, lots: [{ calibre: 'jumbo', deliveryWindowHours: 72 }] };
    const result = await validateTender(auction, null);
    assert.equal(result.fair, false);
    assert.equal(result.reason, 'invalid_calibre');
  });

  test('rejects a tender with no delivery window selected', async () => {
    const auction = { ...base, lots: [{ calibre: 'moyen' }] };
    const result = await validateTender(auction, null);
    assert.equal(result.fair, false);
    assert.equal(result.reason, 'invalid_delivery_window');
  });

  test('rejects a delivery window outside the fixed 24/48/72h options', async () => {
    const auction = { ...base, lots: [{ calibre: 'moyen', deliveryWindowHours: 36 }] };
    const result = await validateTender(auction, null);
    assert.equal(result.fair, false);
    assert.equal(result.reason, 'invalid_delivery_window');
  });

  test('accepts every combination of the fixed calibre and delivery-window lists', async () => {
    for (const calibre of ['petit', 'moyen', 'gros', 'extra']) {
      for (const deliveryWindowHours of [24, 48, 72]) {
        const auction = { ...base, lots: [{ calibre, deliveryWindowHours }] };
        const result = await validateTender(auction, null);
        assert.equal(result.fair, true, `expected ${calibre}/${deliveryWindowHours}h to pass`);
      }
    }
  });
});

/**
 * Fake db exposing just enough of referencePrices.findOne() for
 * checkPriceFairness. buyerAccounts/weeklyStatements always report "no
 * history" so checkBuyerStanding (which runs first in validateTender) never
 * interferes with these Bloc A-focused tests.
 */
function fakeDbWithReference(referenceDoc) {
  return {
    collection(name) {
      if (name === 'buyerAccounts' || name === 'weeklyStatements') {
        return { async findOne() { return null; } };
      }
      if (name !== 'referencePrices') throw new Error(`Unexpected collection: ${name}`);
      return {
        async findOne(query) {
          if (!referenceDoc) return null;
          if (query.wilaya === referenceDoc.wilaya && query.unit === referenceDoc.unit && query.productId === referenceDoc.productId) {
            return referenceDoc;
          }
          return null;
        },
      };
    },
  };
}

describe('validateTender — Bloc A price-fairness check', () => {
  const reference = {
    productId: '15', wilaya: 'alger', unit: 'tonnes',
    price: 100, sampleSize: 5, computedAt: '2026-01-20T00:00:00.000Z',
  };

  test('passes without a reference lookup when the tender has no lot/productId', async () => {
    const auction = { buyerId: 'b1', targetPrice: 10, quantity: 5, lots: [validLot()] };
    const result = await validateTender(auction, fakeDbWithReference(reference));
    assert.equal(result.fair, true);
    assert.equal(result.referenceUsed, null);
  });

  test('passes when there is no reference for this product/wilaya yet (cold start)', async () => {
    const auction = { buyerId: 'b1', targetPrice: 10, quantity: 5, lots: [validLot({ productId: '99', wilayaId: WILAYA_NAME_TO_ID.alger })], unit: 'tonnes' };
    const result = await validateTender(auction, fakeDbWithReference(reference));
    assert.equal(result.fair, true);
    assert.equal(result.referenceUsed, null);
  });

  test('passes when the price ceiling is at or above 70% of the reference', async () => {
    const auction = { buyerId: 'b1', targetPrice: 70, quantity: 5, lots: [validLot({ productId: '15', wilayaId: WILAYA_NAME_TO_ID.alger })], unit: 'tonnes' };
    const result = await validateTender(auction, fakeDbWithReference(reference));
    assert.equal(result.fair, true);
    assert.equal(result.referenceUsed.price, 100);
  });

  test('rejects a price ceiling below 70% of the reference', async () => {
    const auction = { buyerId: 'b1', targetPrice: 69, quantity: 5, lots: [validLot({ productId: '15', wilayaId: WILAYA_NAME_TO_ID.alger })], unit: 'tonnes' };
    const result = await validateTender(auction, fakeDbWithReference(reference));
    assert.equal(result.fair, false);
    assert.equal(result.reason, 'price_below_floor');
    assert.equal(result.referenceUsed.price, 100);
  });
});

/** Fake db exposing just enough of buyerAccounts/weeklyStatements for checkBuyerStanding. */
function fakeDbWithBuyerAccount({ account = null, overdueStatement = null } = {}) {
  return {
    collection(name) {
      if (name === 'buyerAccounts') {
        return { async findOne() { return account; } };
      }
      if (name === 'weeklyStatements') {
        return { async findOne() { return overdueStatement; } };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

describe('validateTender — Bloc D buyer-standing check', () => {
  const auction = { buyerId: 'b1', targetPrice: 100, quantity: 5, lots: [validLot()] };

  test('passes when the buyer has no account history yet', async () => {
    const result = await validateTender(auction, fakeDbWithBuyerAccount());
    assert.equal(result.fair, true);
  });

  test('rejects a buyer over their outstanding balance cap', async () => {
    const db = fakeDbWithBuyerAccount({ account: { buyerId: 'b1', outstandingBalance: 60000 } });
    const result = await validateTender(auction, db);
    assert.equal(result.fair, false);
    assert.equal(result.reason, 'buyer_balance_exceeded');
  });

  test('rejects a buyer with an overdue unpaid statement', async () => {
    const db = fakeDbWithBuyerAccount({
      account: { buyerId: 'b1', outstandingBalance: 100 },
      overdueStatement: { id: 'stmt1', buyerId: 'b1', status: 'pending' },
    });
    const result = await validateTender(auction, db);
    assert.equal(result.fair, false);
    assert.equal(result.reason, 'buyer_payment_overdue');
  });

  test('never reaches the price-fairness check for a buyer already rejected on standing', async () => {
    const db = fakeDbWithBuyerAccount({ account: { buyerId: 'b1', outstandingBalance: 60000 } });
    const result = await validateTender(auction, db);
    assert.equal(result.reason, 'buyer_balance_exceeded');
    assert.equal(result.referenceUsed, null);
  });
});

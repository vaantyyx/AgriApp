// Bloc B — "Tender fair?" gate (التحقق من الطلب). Runs once, server-side,
// before a buyer's tender (auction) is allowed to reach producers. A tender
// that fails is persisted with status 'rejected' (see server.js) instead of
// silently bouncing, so the buyer and admins keep an audit trail of why.
//
// Both checks below are now wired to their respective engines: price
// fairness to the Bloc A reference engine, buyer standing to the Bloc D
// commission ledger.

import { getReferencePrice } from './referenceEngine.js';
import { checkBuyerAccountStanding } from './commissionEngine.js';
import { getWilayaNameById } from './auctionMatching.js';

// A tender ceiling below this fraction of the reference is rejected outright.
// Set below Bloc C's compounding round floor (72.2%) since this is only the
// coarse first gate, before any rounds run.
const MIN_FAIR_RATIO = 0.70;

// Bloc B — the buyer picks these two himself when submitting the tender
// (crop, calibre, volume, delivery window, ceiling price); the system never
// derives them automatically from the product. Fixed lists so producers can
// rely on them, rather than free text.
export const CALIBRE_OPTIONS = ['petit', 'moyen', 'gros', 'extra'];
export const DELIVERY_WINDOW_OPTIONS = [24, 48, 72];

/**
 * Structural sanity checks that don't need any external market data — the
 * only checks that can be "real" before Blocs A and D exist.
 */
function checkStructure(auction) {
  if (auction.targetPrice != null && !(auction.targetPrice > 0)) {
    return { pass: false, reason: 'invalid_price' };
  }
  if (!(auction.quantity > 0)) {
    return { pass: false, reason: 'invalid_quantity' };
  }
  if (auction.startAt && auction.endAt && new Date(auction.endAt) <= new Date(auction.startAt)) {
    return { pass: false, reason: 'invalid_dates' };
  }
  if (!CALIBRE_OPTIONS.includes(auction.lots?.[0]?.calibre)) {
    return { pass: false, reason: 'invalid_calibre' };
  }
  if (!DELIVERY_WINDOW_OPTIONS.includes(auction.lots?.[0]?.deliveryWindowHours)) {
    return { pass: false, reason: 'invalid_delivery_window' };
  }
  return { pass: true, reason: null };
}

/**
 * Compares the tender's price ceiling against the Bloc A reference (settled
 * deals + seasonal modifier). Passes automatically — with `referenceUsed:
 * null` — whenever there's no price ceiling, no product/wilaya to key off
 * of, or not enough settlement history yet (cold start).
 */
async function checkPriceFairness(auction, db) {
  if (!db || auction.targetPrice == null) {
    return { pass: true, reason: null, referenceUsed: null };
  }

  const productId = auction.lots?.[0]?.productId;
  // Reference is keyed by the lot's *origin* wilaya (where the produce comes
  // from), not the buyer's own account wilaya — see referenceEngine.js.
  const wilayaName = getWilayaNameById(auction.lots?.[0]?.wilayaId);
  if (!productId || !wilayaName) {
    return { pass: true, reason: null, referenceUsed: null };
  }

  const reference = await getReferencePrice(productId, wilayaName, auction.unit, db);
  if (!reference) {
    return { pass: true, reason: null, referenceUsed: null };
  }

  const referenceUsed = {
    price: reference.price,
    sampleSize: reference.sampleSize,
    computedAt: reference.computedAt,
  };

  const floor = reference.price * MIN_FAIR_RATIO;
  if (auction.targetPrice < floor) {
    return { pass: false, reason: 'price_below_floor', referenceUsed };
  }
  return { pass: true, reason: null, referenceUsed };
}

/**
 * Rejects a new tender from a buyer who is over their outstanding commission
 * balance or has a payment overdue past the grace period (Bloc D ledger).
 * Passes automatically when there's no db, or no account history yet.
 */
async function checkBuyerStanding(auction, db) {
  if (!db || !auction.buyerId) return { pass: true, reason: null };
  return checkBuyerAccountStanding(auction.buyerId, db);
}

/**
 * Runs every Bloc B check for a tender and returns the record to persist on
 * `auction.validation`. The first failing check wins; checks are ordered
 * cheapest/most-certain first so a bad tender never reaches the stubs.
 */
export async function validateTender(auction, db) {
  const checkedAt = new Date().toISOString();

  const structure = checkStructure(auction);
  if (!structure.pass) {
    return { fair: false, reason: structure.reason, checkedAt, referenceUsed: null };
  }

  const standing = await checkBuyerStanding(auction, db);
  if (!standing.pass) {
    return { fair: false, reason: standing.reason, checkedAt, referenceUsed: null };
  }

  const price = await checkPriceFairness(auction, db);
  if (!price.pass) {
    return { fair: false, reason: price.reason, checkedAt, referenceUsed: price.referenceUsed };
  }

  return { fair: true, reason: null, checkedAt, referenceUsed: price.referenceUsed };
}

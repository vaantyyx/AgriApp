// Bloc D — commission via account (العمولة عبر الحساب).
//
// Per the validated design: this is an internal ledger only (registre
// interne), not a real escrow or bank integration — an admin reconciles the
// actual bank transfer by hand once a weekly statement is issued. This
// module only ever touches the 6% Sougra commission; the underlying produce
// price is settled directly between buyer and producer, outside the app
// (see TermsPage.jsx's existing "séquestre" clause).

import { randomBytes } from 'crypto';

export const COMMISSION_RATE = 0.06;
export const MAX_OUTSTANDING_BALANCE = 50000;
export const OVERDUE_GRACE_DAYS = 14;

function newId(prefix) {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

/**
 * Books the Sougra commission for a conforming delivery: one audit-trail
 * entry, plus the buyer's running balance. Called once per inspection with
 * `conforms: true` (see submit_inspection in server.js) — never for a
 * non-conforming delivery, which owes no commission at all.
 */
export async function recordCommission(db, { auctionId, buyerId, producerId, acceptedPrice, now = new Date() }) {
  const amount = Math.round(acceptedPrice * COMMISSION_RATE * 100) / 100;

  const entry = {
    id: newId('comm'),
    auctionId,
    buyerId,
    producerId,
    acceptedPrice,
    rate: COMMISSION_RATE,
    amount,
    status: 'pending',
    statementId: null,
    createdAt: now.toISOString(),
  };
  await db.collection('commissionEntries').insertOne(entry);

  await db.collection('buyerAccounts').updateOne(
    { buyerId },
    {
      $inc: { outstandingBalance: amount },
      $setOnInsert: { buyerId, totalSettled: 0, createdAt: now.toISOString() },
      $set: { updatedAt: now.toISOString() },
    },
    { upsert: true }
  );

  return entry;
}

/**
 * Groups every still-'pending' commission entry into one weekly statement
 * per buyer, and flips those entries to 'invoiced' so the next run only
 * picks up entries created since. Meant to run once a week (see server.js);
 * safe to re-run any time — a late run just bundles more entries together.
 */
export async function generateWeeklyStatements(db, { now = new Date() } = {}) {
  const pending = await db.collection('commissionEntries').find({ status: 'pending' }).toArray();

  const byBuyer = new Map();
  for (const entry of pending) {
    if (!byBuyer.has(entry.buyerId)) byBuyer.set(entry.buyerId, []);
    byBuyer.get(entry.buyerId).push(entry);
  }

  let statementsCreated = 0;
  for (const [buyerId, entries] of byBuyer.entries()) {
    const totalAmount = Math.round(entries.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
    const periodStart = entries.reduce((min, e) => (e.createdAt < min ? e.createdAt : min), entries[0].createdAt);

    const statement = {
      id: newId('stmt'),
      buyerId,
      periodStart,
      periodEnd: now.toISOString(),
      entryCount: entries.length,
      totalAmount,
      status: 'pending',
      createdAt: now.toISOString(),
      paidAt: null,
      paidByAdminId: null,
    };
    await db.collection('weeklyStatements').insertOne(statement);

    await db.collection('commissionEntries').updateMany(
      { id: { $in: entries.map(e => e.id) } },
      { $set: { status: 'invoiced', statementId: statement.id } }
    );

    statementsCreated++;
  }

  return { buyersProcessed: byBuyer.size, statementsCreated };
}

/**
 * Manual reconciliation (decision: no real bank integration) — an admin
 * confirms the transfer was received outside the app, which settles the
 * statement and its entries, and brings the buyer's balance back down.
 */
export async function markStatementPaid(db, statementId, adminId, now = new Date()) {
  const statement = await db.collection('weeklyStatements').findOne({ id: statementId });
  if (!statement) return null;
  if (statement.status === 'paid') return statement;

  await db.collection('weeklyStatements').updateOne(
    { id: statementId },
    { $set: { status: 'paid', paidAt: now.toISOString(), paidByAdminId: adminId } }
  );
  await db.collection('commissionEntries').updateMany(
    { statementId },
    { $set: { status: 'settled' } }
  );
  await db.collection('buyerAccounts').updateOne(
    { buyerId: statement.buyerId },
    {
      $inc: { outstandingBalance: -statement.totalAmount, totalSettled: statement.totalAmount },
      $set: { updatedAt: now.toISOString() },
    }
  );

  return { ...statement, status: 'paid', paidAt: now.toISOString(), paidByAdminId: adminId };
}

/**
 * Bloc B's buyer-standing check (decision: start with one simple threshold
 * rather than a computed score). No buyerAccounts doc yet = no history = OK
 * — matches the same cold-start philosophy as the Bloc A reference engine.
 */
export async function checkBuyerAccountStanding(buyerId, db, { now = new Date() } = {}) {
  const account = await db.collection('buyerAccounts').findOne({ buyerId });
  if (!account) return { pass: true, reason: null };

  if (account.outstandingBalance > MAX_OUTSTANDING_BALANCE) {
    return { pass: false, reason: 'buyer_balance_exceeded' };
  }

  const overdueCutoff = new Date(now.getTime() - OVERDUE_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const overdueStatement = await db.collection('weeklyStatements').findOne({
    buyerId, status: 'pending', periodEnd: { $lt: overdueCutoff },
  });
  if (overdueStatement) {
    return { pass: false, reason: 'buyer_payment_overdue' };
  }

  return { pass: true, reason: null };
}

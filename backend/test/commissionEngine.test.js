import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  recordCommission,
  generateWeeklyStatements,
  markStatementPaid,
  checkBuyerAccountStanding,
  COMMISSION_RATE,
  MAX_OUTSTANDING_BALANCE,
  OVERDUE_GRACE_DAYS,
} from '../services/commissionEngine.js';

/** Minimal in-memory fake of the MongoDB driver surface this module uses. */
function fakeDb() {
  const collections = {
    commissionEntries: [],
    weeklyStatements: [],
    buyerAccounts: [],
  };

  function matches(doc, query) {
    return Object.entries(query).every(([key, value]) => {
      if (value && typeof value === 'object' && '$in' in value) return value.$in.includes(doc[key]);
      if (value && typeof value === 'object' && '$lt' in value) return doc[key] < value.$lt;
      return doc[key] === value;
    });
  }

  return {
    collection(name) {
      const store = collections[name];
      if (!store) throw new Error(`Unexpected collection: ${name}`);
      return {
        async insertOne(doc) { store.push(doc); return { insertedId: doc.id }; },
        find(query = {}) {
          return { async toArray() { return store.filter(d => matches(d, query)); } };
        },
        async findOne(query = {}) {
          return store.find(d => matches(d, query)) || null;
        },
        async updateOne(query, update, opts = {}) {
          let doc = store.find(d => matches(d, query));
          if (!doc && opts.upsert) {
            doc = { ...Object.fromEntries(Object.entries(query).filter(([, v]) => typeof v !== 'object')) };
            if (update.$setOnInsert) Object.assign(doc, update.$setOnInsert);
            store.push(doc);
          }
          if (!doc) return { matchedCount: 0 };
          if (update.$set) Object.assign(doc, update.$set);
          if (update.$inc) {
            for (const [key, delta] of Object.entries(update.$inc)) {
              doc[key] = (doc[key] || 0) + delta;
            }
          }
          return { matchedCount: 1 };
        },
        async updateMany(query, update) {
          const matched = store.filter(d => matches(d, query));
          for (const doc of matched) {
            if (update.$set) Object.assign(doc, update.$set);
          }
          return { matchedCount: matched.length };
        },
      };
    },
    _collections: collections,
  };
}

describe('recordCommission', () => {
  test('books 6% of the accepted price as a pending entry', async () => {
    const db = fakeDb();
    const entry = await recordCommission(db, { auctionId: 'a1', buyerId: 'b1', producerId: 'p1', acceptedPrice: 1000 });
    assert.equal(COMMISSION_RATE, 0.06);
    assert.equal(entry.amount, 60);
    assert.equal(entry.status, 'pending');
  });

  test('creates the buyer account on first commission and increments it on the next', async () => {
    const db = fakeDb();
    await recordCommission(db, { auctionId: 'a1', buyerId: 'b1', producerId: 'p1', acceptedPrice: 1000 });
    let account = await db.collection('buyerAccounts').findOne({ buyerId: 'b1' });
    assert.equal(account.outstandingBalance, 60);

    await recordCommission(db, { auctionId: 'a2', buyerId: 'b1', producerId: 'p2', acceptedPrice: 500 });
    account = await db.collection('buyerAccounts').findOne({ buyerId: 'b1' });
    assert.equal(account.outstandingBalance, 90);
  });
});

describe('generateWeeklyStatements', () => {
  test('groups pending entries per buyer into one statement and flips them to invoiced', async () => {
    const db = fakeDb();
    await recordCommission(db, { auctionId: 'a1', buyerId: 'b1', producerId: 'p1', acceptedPrice: 1000 });
    await recordCommission(db, { auctionId: 'a2', buyerId: 'b1', producerId: 'p2', acceptedPrice: 500 });
    await recordCommission(db, { auctionId: 'a3', buyerId: 'b2', producerId: 'p1', acceptedPrice: 2000 });

    const result = await generateWeeklyStatements(db, { now: new Date('2026-02-01T00:00:00.000Z') });
    assert.equal(result.buyersProcessed, 2);
    assert.equal(result.statementsCreated, 2);

    const statements = await db.collection('weeklyStatements').find({}).toArray();
    const b1Statement = statements.find(s => s.buyerId === 'b1');
    assert.equal(b1Statement.totalAmount, 90);
    assert.equal(b1Statement.entryCount, 2);
    assert.equal(b1Statement.status, 'pending');

    const entries = await db.collection('commissionEntries').find({}).toArray();
    assert.ok(entries.every(e => e.status === 'invoiced'));
    assert.ok(entries.every(e => e.statementId != null));
  });

  test('a second run only picks up entries created since (already-invoiced ones are excluded)', async () => {
    const db = fakeDb();
    await recordCommission(db, { auctionId: 'a1', buyerId: 'b1', producerId: 'p1', acceptedPrice: 1000 });
    await generateWeeklyStatements(db, { now: new Date('2026-02-01T00:00:00.000Z') });

    await recordCommission(db, { auctionId: 'a2', buyerId: 'b1', producerId: 'p1', acceptedPrice: 200 });
    const result = await generateWeeklyStatements(db, { now: new Date('2026-02-08T00:00:00.000Z') });
    assert.equal(result.statementsCreated, 1);

    const statements = await db.collection('weeklyStatements').find({ buyerId: 'b1' }).toArray();
    assert.equal(statements.length, 2);
    assert.equal(statements[1].totalAmount, 12); // 200 * 0.06
  });
});

describe('markStatementPaid', () => {
  test('settles the statement, its entries, and reduces the buyer balance', async () => {
    const db = fakeDb();
    await recordCommission(db, { auctionId: 'a1', buyerId: 'b1', producerId: 'p1', acceptedPrice: 1000 });
    await generateWeeklyStatements(db, { now: new Date('2026-02-01T00:00:00.000Z') });
    const [statement] = await db.collection('weeklyStatements').find({}).toArray();

    const result = await markStatementPaid(db, statement.id, 'admin1', new Date('2026-02-03T00:00:00.000Z'));
    assert.equal(result.status, 'paid');
    assert.equal(result.paidByAdminId, 'admin1');

    const account = await db.collection('buyerAccounts').findOne({ buyerId: 'b1' });
    assert.equal(account.outstandingBalance, 0);
    assert.equal(account.totalSettled, 60);

    const entries = await db.collection('commissionEntries').find({ buyerId: 'b1' }).toArray();
    assert.ok(entries.every(e => e.status === 'settled'));
  });

  test('returns null for an unknown statement id', async () => {
    const db = fakeDb();
    assert.equal(await markStatementPaid(db, 'nope', 'admin1'), null);
  });
});

describe('checkBuyerAccountStanding', () => {
  test('passes when the buyer has no account history yet (cold start)', async () => {
    const db = fakeDb();
    const result = await checkBuyerAccountStanding('newbuyer', db);
    assert.equal(result.pass, true);
  });

  test('rejects a buyer whose outstanding balance exceeds the cap', async () => {
    const db = fakeDb();
    assert.equal(MAX_OUTSTANDING_BALANCE, 50000);
    const acceptedPrice = (MAX_OUTSTANDING_BALANCE + 1000) / COMMISSION_RATE;
    await recordCommission(db, { auctionId: 'a1', buyerId: 'b1', producerId: 'p1', acceptedPrice });

    const result = await checkBuyerAccountStanding('b1', db);
    assert.equal(result.pass, false);
    assert.equal(result.reason, 'buyer_balance_exceeded');
  });

  test('rejects a buyer with a statement overdue past the grace period', async () => {
    const db = fakeDb();
    assert.equal(OVERDUE_GRACE_DAYS, 14);
    await recordCommission(db, { auctionId: 'a1', buyerId: 'b1', producerId: 'p1', acceptedPrice: 100 });
    await generateWeeklyStatements(db, { now: new Date('2026-01-01T00:00:00.000Z') });

    const result = await checkBuyerAccountStanding('b1', db, { now: new Date('2026-01-20T00:00:00.000Z') });
    assert.equal(result.pass, false);
    assert.equal(result.reason, 'buyer_payment_overdue');
  });

  test('passes when the only statement is still within the grace period', async () => {
    const db = fakeDb();
    await recordCommission(db, { auctionId: 'a1', buyerId: 'b1', producerId: 'p1', acceptedPrice: 100 });
    await generateWeeklyStatements(db, { now: new Date('2026-01-01T00:00:00.000Z') });

    const result = await checkBuyerAccountStanding('b1', db, { now: new Date('2026-01-05T00:00:00.000Z') });
    assert.equal(result.pass, true);
  });

  test('passes when an overdue statement has already been paid', async () => {
    const db = fakeDb();
    await recordCommission(db, { auctionId: 'a1', buyerId: 'b1', producerId: 'p1', acceptedPrice: 100 });
    await generateWeeklyStatements(db, { now: new Date('2026-01-01T00:00:00.000Z') });
    const [statement] = await db.collection('weeklyStatements').find({}).toArray();
    await markStatementPaid(db, statement.id, 'admin1', new Date('2026-01-02T00:00:00.000Z'));

    const result = await checkBuyerAccountStanding('b1', db, { now: new Date('2026-01-20T00:00:00.000Z') });
    assert.equal(result.pass, true);
  });
});

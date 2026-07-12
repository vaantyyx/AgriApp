// Integration test — needs a reachable MongoDB. Uses a dedicated test
// database (never the app's real one) so it's safe to run locally or in CI.
import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/agriapp_test';

const { connectToDatabase, getDb, closeConnection } = await import('../db.js');
const { createOtp, verifyOtp } = await import('../services/otpService.js');

describe('otpService', () => {
  before(async () => {
    await connectToDatabase();
  });

  beforeEach(async () => {
    await getDb().collection('user_otps').deleteMany({});
  });

  after(async () => {
    await getDb().collection('user_otps').deleteMany({});
    await closeConnection();
  });

  test('createOtp generates a 6-digit numeric code', async () => {
    const otp = await createOtp('user1', 'login');
    assert.match(otp, /^\d{6}$/);
  });

  test('createOtp never stores the plaintext code', async () => {
    const otp = await createOtp('user1', 'login');
    const record = await getDb().collection('user_otps').findOne({ userId: 'user1' });
    assert.ok(record);
    assert.notEqual(record.codeHash, otp);
  });

  test('verifyOtp accepts the correct code exactly once', async () => {
    const otp = await createOtp('user1', 'login');
    const first = await verifyOtp('user1', 'login', otp);
    assert.equal(first.valid, true);

    // The record is deleted on success, so a second attempt with the same code fails.
    const second = await verifyOtp('user1', 'login', otp);
    assert.equal(second.valid, false);
  });

  test('verifyOtp rejects a wrong code and reports remaining attempts', async () => {
    await createOtp('user1', 'login');
    const result = await verifyOtp('user1', 'login', '000000');
    assert.equal(result.valid, false);
    assert.match(result.message, /tentative/i);
  });

  test('verifyOtp locks out after too many wrong attempts', async () => {
    await createOtp('user1', 'login');
    await verifyOtp('user1', 'login', '000000');
    await verifyOtp('user1', 'login', '000000');
    await verifyOtp('user1', 'login', '000000'); // 3rd wrong attempt exhausts maxAttempts
    const result = await verifyOtp('user1', 'login', '000000');
    assert.equal(result.valid, false);
    assert.match(result.message, /maximal/i);
  });

  test('login and password_change codes for the same user are independent', async () => {
    const loginOtp = await createOtp('user1', 'login');
    const pwOtp = await createOtp('user1', 'password_change');
    assert.notEqual(loginOtp, pwOtp);

    const wrongType = await verifyOtp('user1', 'password_change', loginOtp);
    assert.equal(wrongType.valid, false);

    const rightType = await verifyOtp('user1', 'login', loginOtp);
    assert.equal(rightType.valid, true);
  });
});

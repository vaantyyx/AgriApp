// Integration test — needs a reachable MongoDB. Uses a dedicated test
// database (never the app's real one) so it's safe to run locally or in CI.
import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/agriapp_test';

const { connectToDatabase, getDb, closeConnection } = await import('../db.js');
const { generateChallenge, getTile, verifySelection, consumeVerifiedChallenge } = await import('../services/captchaService.js');

describe('captchaService', () => {
  before(async () => {
    await connectToDatabase();
  });

  beforeEach(async () => {
    await getDb().collection('captcha_challenges').deleteMany({});
  });

  after(async () => {
    await getDb().collection('captcha_challenges').deleteMany({});
    await closeConnection();
  });

  test('generateChallenge returns a 16-tile grid and never reveals the answer', async () => {
    const challenge = await generateChallenge('fr');
    assert.equal(challenge.tileCount, 16);
    assert.ok(challenge.challengeId);
    assert.ok(challenge.category.key);
    assert.ok(challenge.category.label);
    assert.ok(challenge.category.emoji);
    assert.equal(challenge.correctIndices, undefined); // must not leak to the client
  });

  test('getTile resolves a valid tile and hides nothing category-identifying beyond emoji/color', async () => {
    const challenge = await generateChallenge('fr');
    const tile = await getTile(challenge.challengeId, 0);
    assert.ok(tile);
    assert.ok(tile.emoji);
    assert.ok(tile.color);
  });

  test('getTile returns null for an out-of-range index or unknown challenge', async () => {
    const challenge = await generateChallenge('fr');
    assert.equal(await getTile(challenge.challengeId, 99), null);
    assert.equal(await getTile('does-not-exist', 0), null);
  });

  test('verifySelection rejects a wrong guess and burns the challenge (single-use even on failure)', async () => {
    const challenge = await generateChallenge('fr');
    const wrongResult = await verifySelection(challenge.challengeId, [0, 1, 2, 3, 4, 5, 6, 7]);
    // Given 16 tiles with 3-6 correct, guessing all of 0-7 is virtually certain to be wrong;
    // if it ever coincidentally matches exactly, this assertion would need adjusting, but a
    // fixed 8-index guess against a randomized 3-6 correct set is not a real answer for either case.
    assert.equal(wrongResult.success, false);

    const secondAttempt = await verifySelection(challenge.challengeId, [0]);
    assert.equal(secondAttempt.success, false);
    assert.equal(secondAttempt.reason, 'expired'); // already deleted after the first (wrong) attempt
  });

  test('verifySelection accepts the exact correct set, then consumeVerifiedChallenge is single-use', async () => {
    const challenge = await generateChallenge('fr');
    const stored = await getDb().collection('captcha_challenges').findOne({ _id: challenge.challengeId });

    const correctResult = await verifySelection(challenge.challengeId, stored.correctIndices);
    assert.equal(correctResult.success, true);

    const firstConsume = await consumeVerifiedChallenge(challenge.challengeId);
    assert.equal(firstConsume, true);

    const secondConsume = await consumeVerifiedChallenge(challenge.challengeId);
    assert.equal(secondConsume, false);
  });

  test('consumeVerifiedChallenge refuses a challenge that was never verified', async () => {
    const challenge = await generateChallenge('fr');
    assert.equal(await consumeVerifiedChallenge(challenge.challengeId), false);
  });
});

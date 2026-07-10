import { v4 as uuidv4 } from 'uuid';
import { getRedis } from '../redisClient.js';
import { CAPTCHA_CATEGORIES, getCategoryLabel } from './captchaCategories.js';

const TILE_COUNT = 16;
const CHALLENGE_TTL_SEC = 3 * 60; // time allowed to solve the grid
const VERIFIED_TTL_SEC = 2 * 60;  // time allowed to submit the login form after solving

const challengeKey = (id) => `captcha:challenge:${id}`;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Spreads distractors across multiple other categories rather than a single
// one, so the 6-7 "wrong" tiles aren't all visually identical.
function pickDistractors(otherKeys, count) {
  const shuffledKeys = shuffle(otherKeys);
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(shuffledKeys[i % shuffledKeys.length]);
  }
  return result;
}

/**
 * Generates a new 4x4 CAPTCHA challenge, stores it in Redis with a TTL, and
 * returns only what the client needs to render the grid — never the correct
 * answer. Redis (rather than a DB collection) fits this data naturally: it's
 * short-lived, single-use, and needs no durability across a restart.
 */
export async function generateChallenge(locale = 'fr') {
  const redis = getRedis();
  const keys = Object.keys(CAPTCHA_CATEGORIES);

  const targetKey = keys[Math.floor(Math.random() * keys.length)];
  const otherKeys = keys.filter(k => k !== targetKey);

  const correctCount = 3 + Math.floor(Math.random() * 4); // 3-6
  const distractorCount = TILE_COUNT - correctCount;

  const tileCategories = shuffle([
    ...Array.from({ length: correctCount }, () => targetKey),
    ...pickDistractors(otherKeys, distractorCount),
  ]);

  const tiles = tileCategories.map((category, index) => ({ index, category }));
  const correctIndices = tiles.filter(t => t.category === targetKey).map(t => t.index);

  const challengeId = uuidv4();

  const record = { category: targetKey, tiles, correctIndices, verified: false };
  await redis.set(challengeKey(challengeId), JSON.stringify(record), 'EX', CHALLENGE_TTL_SEC);

  return {
    challengeId,
    category: {
      key: targetKey,
      label: getCategoryLabel(targetKey, locale),
      emoji: CAPTCHA_CATEGORIES[targetKey].emoji,
    },
    tileCount: TILE_COUNT,
  };
}

/**
 * Resolves what a single tile should render (emoji + color), for the image
 * route. Returns null if the challenge/index doesn't exist or has expired —
 * never reveals which tiles are correct.
 */
export async function getTile(challengeId, index) {
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= TILE_COUNT) return null;
  if (typeof challengeId !== 'string' || !challengeId) return null;

  const redis = getRedis();
  const raw = await redis.get(challengeKey(challengeId));
  if (!raw) return null;
  const challenge = JSON.parse(raw);

  const tile = challenge.tiles.find(t => t.index === idx);
  const cat = tile && CAPTCHA_CATEGORIES[tile.category];
  if (!cat) return null;

  return { emoji: cat.emoji, color: cat.color };
}

function escapeXml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function lighten(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amount = Math.round((255 * percent) / 100);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Renders a single tile as a small, self-contained SVG (no file I/O). */
export function renderTileSvg(emoji, color) {
  const gradientTop = lighten(color, 16);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${escapeXml(gradientTop)}"/>
      <stop offset="100%" stop-color="${escapeXml(color)}"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="20" fill="url(#g)"/>
  <text x="100" y="114" font-size="104" text-anchor="middle" dominant-baseline="middle">${escapeXml(emoji)}</text>
</svg>`;
}

/**
 * Verifies a submitted selection against the stored answer.
 * Wrong or missing/expired -> the challenge is burned (single-use even on
 * failure) so the frontend must fetch a brand-new one either way.
 * Correct -> marked verified with a short re-armed expiry, acting as the
 * single-use "pass" the login endpoint will consume.
 */
export async function verifySelection(challengeId, selected) {
  if (typeof challengeId !== 'string' || !challengeId || !Array.isArray(selected)) {
    return { success: false, reason: 'invalid' };
  }

  const redis = getRedis();
  const key = challengeKey(challengeId);
  const raw = await redis.get(key);
  if (!raw) {
    return { success: false, reason: 'expired' };
  }

  const challenge = JSON.parse(raw);
  if (challenge.verified) {
    return { success: false, reason: 'expired' };
  }

  const selectedSet = new Set(selected.map(Number));
  const correctSet = new Set(challenge.correctIndices);
  const isExactMatch = selectedSet.size === correctSet.size && [...selectedSet].every(i => correctSet.has(i));

  if (!isExactMatch) {
    await redis.del(key);
    return { success: false, reason: 'wrong' };
  }

  challenge.verified = true;
  await redis.set(key, JSON.stringify(challenge), 'EX', VERIFIED_TTL_SEC);

  return { success: true };
}

// Atomic "get if verified, then delete" as a Lua script — same guarantee the
// Mongo version got from findOneAndDelete({verified:true}), so two
// concurrent login attempts can't both consume the same solved challenge.
const CONSUME_SCRIPT = `
local val = redis.call('GET', KEYS[1])
if not val then return nil end
local ok, decoded = pcall(cjson.decode, val)
if not ok or decoded.verified ~= true then return nil end
redis.call('DEL', KEYS[1])
return val
`;

/**
 * Atomically consumes a verified challenge — used only by the login
 * endpoint. Returns true exactly once per solved challenge; any concurrent
 * or repeat call gets false.
 */
export async function consumeVerifiedChallenge(challengeId) {
  if (typeof challengeId !== 'string' || !challengeId) return false;
  const redis = getRedis();
  const result = await redis.eval(CONSUME_SCRIPT, 1, challengeKey(challengeId));
  return !!result;
}

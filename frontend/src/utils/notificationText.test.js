import { describe, test, expect, vi } from 'vitest';
import { getNotificationTitle, getNotificationBody } from './notificationText.js';

/** A fake translator that just echoes the key (and stringifies replacements), so
 * assertions can check which key/args the helpers picked without depending on
 * the real translations.js content. */
function fakeT(key, replacements) {
  return replacements ? `${key}:${JSON.stringify(replacements)}` : key;
}

describe('getNotificationTitle', () => {
  test('maps each known type to its title key', () => {
    expect(getNotificationTitle({ type: 'new_bid' }, fakeT)).toBe('newBidNotificationTitle');
    expect(getNotificationTitle({ type: 'bid_accepted' }, fakeT)).toBe('bidAcceptedNotificationTitle');
    expect(getNotificationTitle({ type: 'auction_scheduled' }, fakeT)).toBe('auctionScheduledNotificationTitle');
    expect(getNotificationTitle({ type: 'auction_starting_soon' }, fakeT)).toBe('auctionStartingSoonNotificationTitle');
    expect(getNotificationTitle({ type: 'auction_canceled' }, fakeT)).toBe('auctionCanceledNotificationTitle');
  });

  test('falls back to the "new demand nearby" title with the distance', () => {
    const result = getNotificationTitle({ type: 'new_auction', distanceKm: 12 }, fakeT);
    expect(result).toBe('newDemandAtDistance:{"distance":12}');
  });

  test('defaults distance to 0 when missing', () => {
    const result = getNotificationTitle({ type: 'new_auction' }, fakeT);
    expect(result).toBe('newDemandAtDistance:{"distance":0}');
  });
});

describe('getNotificationBody', () => {
  test('bid_accepted with a price uses the priced-body key', () => {
    const result = getNotificationBody({ type: 'bid_accepted', product: 'Tomate', price: 100, unit: 'tonnes' }, fakeT);
    expect(result).toContain('bidAcceptedNotificationBody:');
    expect(result).toContain('"product":"Tomate"');
    expect(result).toContain('"price":100');
  });

  test('bid_accepted without a price (package acceptance) uses the package-body key', () => {
    const result = getNotificationBody({ type: 'bid_accepted', product: 'Tomate', optionCount: 3 }, fakeT);
    expect(result).toContain('bidAcceptedNotificationBodyPackage:');
    expect(result).toContain('"count":3');
  });

  test('auction_scheduled formats the date using the locale-aware tag, in 24h for Arabic', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleString');
    getNotificationBody({ type: 'auction_scheduled', product: 'Blé', startAt: '2026-01-01T10:00:00.000Z' }, fakeT, 'ar');
    expect(spy).toHaveBeenCalledWith('ar-DZ', { dateStyle: 'medium', timeStyle: 'short', hour12: false });
    spy.mockRestore();
  });

  test('defaults to fr-DZ (24h) when no locale is given', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleString');
    getNotificationBody({ type: 'auction_scheduled', product: 'Blé', startAt: '2026-01-01T10:00:00.000Z' }, fakeT);
    expect(spy).toHaveBeenCalledWith('fr-DZ', { dateStyle: 'medium', timeStyle: 'short', hour12: false });
    spy.mockRestore();
  });

  test('uses a 12-hour AM/PM clock for English', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleString');
    getNotificationBody({ type: 'auction_scheduled', product: 'Wheat', startAt: '2026-01-01T10:00:00.000Z' }, fakeT, 'en');
    expect(spy).toHaveBeenCalledWith('en-US', { dateStyle: 'medium', timeStyle: 'short', hour12: true });
    spy.mockRestore();
  });

  test('unknown type falls back to a plain "product — quantity unit" line', () => {
    const result = getNotificationBody({ type: 'something_else', product: 'Orge', quantity: 5, unit: 'tonnes' }, fakeT);
    expect(result).toBe('Orge — 5 unit_tonnes');
  });
});

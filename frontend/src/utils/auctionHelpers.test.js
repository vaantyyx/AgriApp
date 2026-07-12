import { describe, test, expect } from 'vitest';
import { resolveAcceptedLine, isBidLineAccepted, getWinnerCongratsMessage, getBidClosedWinnerMessage } from './auctionHelpers.js';

function fakeT(key, replacements) {
  return replacements ? `${key}:${JSON.stringify(replacements)}` : key;
}

describe('resolveAcceptedLine', () => {
  test('returns null when the bid has no lines', () => {
    expect(resolveAcceptedLine(null, null)).toBeNull();
    expect(resolveAcceptedLine({ lines: [] }, null)).toBeNull();
  });

  test('returns the single line when there is exactly one and no explicit id', () => {
    const bid = { lines: [{ id: 'l1', price: 100 }] };
    expect(resolveAcceptedLine(bid, null)).toEqual({ id: 'l1', price: 100 });
  });

  test('returns null for multiple lines with no explicit accepted id (package, not a single line)', () => {
    const bid = { lines: [{ id: 'l1' }, { id: 'l2' }] };
    expect(resolveAcceptedLine(bid, null)).toBeNull();
  });

  test('returns the matching line when an accepted line id is given', () => {
    const bid = { lines: [{ id: 'l1' }, { id: 'l2', price: 200 }] };
    expect(resolveAcceptedLine(bid, 'l2')).toEqual({ id: 'l2', price: 200 });
  });
});

describe('isBidLineAccepted', () => {
  test('false when the bid is not the accepted one', () => {
    const auction = { acceptedBidId: 'bid_a' };
    expect(isBidLineAccepted(auction, { id: 'bid_b' }, { id: 'l1' })).toBe(false);
  });

  test('true for any line when the whole bid was accepted without a specific line', () => {
    const auction = { acceptedBidId: 'bid_a', acceptedLineId: null };
    expect(isBidLineAccepted(auction, { id: 'bid_a' }, { id: 'l1' })).toBe(true);
  });

  test('only the matching line is accepted when acceptedLineId is set', () => {
    const auction = { acceptedBidId: 'bid_a', acceptedLineId: 'l2' };
    expect(isBidLineAccepted(auction, { id: 'bid_a' }, { id: 'l1' })).toBe(false);
    expect(isBidLineAccepted(auction, { id: 'bid_a' }, { id: 'l2' })).toBe(true);
  });
});

describe('getWinnerCongratsMessage', () => {
  const auction = { unit: 'tonnes' };

  test('single named option uses the "option" congrats message', () => {
    const bid = { lines: [{ id: 'l1', optionName: 'Premium', price: 100 }] };
    const result = getWinnerCongratsMessage({ bid, acceptedLineId: null, auction, t: fakeT });
    expect(result).toContain('bidWinnerCongratsOption:');
    expect(result).toContain('"option":"Premium"');
  });

  test('single unnamed option uses the plain congrats message', () => {
    const bid = { lines: [{ id: 'l1', price: 100 }] };
    const result = getWinnerCongratsMessage({ bid, acceptedLineId: null, auction, t: fakeT });
    expect(result).toContain('bidWinnerCongrats:');
  });

  test('multi-option package with no single accepted line uses the package message', () => {
    const bid = { lines: [{ id: 'l1' }, { id: 'l2' }] };
    const result = getWinnerCongratsMessage({ bid, acceptedLineId: null, auction, t: fakeT });
    expect(result).toBe('bidWinnerCongratsPackage:{"count":2}');
  });

  test('no lines at all falls back to the generic congrats message', () => {
    const result = getWinnerCongratsMessage({ bid: null, acceptedLineId: null, auction, t: fakeT });
    expect(result).toBe('bidWinnerCongratsGeneric');
  });
});

describe('getBidClosedWinnerMessage', () => {
  const auction = { unit: 'tonnes' };

  test('single named option includes the producer alias and option name', () => {
    const winningBid = { producerAlias: 'Producteur #1', lines: [{ optionName: 'Premium', price: 150 }] };
    const result = getBidClosedWinnerMessage({ winningBid, acceptedLineId: null, auction, t: fakeT, locale: 'fr' });
    expect(result).toContain('bidClosedWinnerOption:');
    expect(result).toContain('"name":"Producteur #1"');
  });

  test('package win (fr) mentions the producer and falls back to a French sentence', () => {
    const winningBid = { producerAlias: 'Producteur #2', lines: [{}, {}] };
    const result = getBidClosedWinnerMessage({ winningBid, acceptedLineId: null, auction, t: fakeT, locale: 'fr' });
    expect(result).toBe('bidClosedWinnerPackage:{"name":"Producteur #2","count":2}');
  });
});

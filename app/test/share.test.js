import test from 'node:test';
import assert from 'node:assert/strict';
import { shareCacheControl, shareETag } from '../src/lib/share.js';

/*
 * The cache header used to be a one-liner nobody had to think about, because
 * an approved result never changed. Adding a club logo to the card broke that
 * quietly rather than loudly: the result is still fixed, but the picture on it
 * is not, and a year of `immutable` would have pinned a replaced logo onto
 * every card a chapter had ever shared.
 */

test('a pending card is short-lived either way', () => {
  assert.equal(shareCacheControl('pending', false), 'public, max-age=300');
  assert.equal(shareCacheControl('pending', true), 'public, max-age=300');
});

test('a returned card is never stored', () => {
  assert.equal(shareCacheControl('returned', false), 'no-store');
  assert.equal(shareCacheControl('returned', true), 'no-store');
});

test('an approved card with nothing left to change keeps the year', () => {
  assert.equal(shareCacheControl('approved', false), 'public, max-age=31536000, immutable');
});

test('an approved card carrying a logo is not immutable', () => {
  const header = shareCacheControl('approved', true);
  assert.ok(!header.includes('immutable'), header);
  assert.ok(header.includes('stale-while-revalidate'), header);
});

test('the default is the cautious one', () => {
  /* A caller who forgets the second argument gets the year, so the argument is
     required in spirit. This test exists to make that choice visible rather
     than to bless it: every call site in the app passes it. */
  assert.equal(shareCacheControl('approved'), 'public, max-age=31536000, immutable');
});

const base = {
  status: 'approved', placing: '2nd', won_overall: false,
  club_logo: 'https://x.test/clubs/a/logo-1.png',
  logo_updated_at: '2026-08-21T00:00:00Z',
};

test('the same card is the same tag', () => {
  assert.equal(shareETag(base), shareETag({ ...base }));
});

test('a swapped logo is a different tag', () => {
  assert.notEqual(shareETag(base), shareETag({ ...base, club_logo: 'https://x.test/clubs/a/logo-2.png' }));
  assert.notEqual(shareETag(base), shareETag({ ...base, logo_updated_at: '2026-08-22T00:00:00Z' }));
});

test('approval is a different tag', () => {
  assert.notEqual(shareETag(base), shareETag({ ...base, status: 'pending' }));
});

test('a corrected placing is a different tag', () => {
  assert.notEqual(shareETag(base), shareETag({ ...base, placing: '1st' }));
  assert.notEqual(shareETag(base), shareETag({ ...base, won_overall: true }));
});

test('it is a weak validator, and survives a card with nothing in it', () => {
  assert.match(shareETag(base), /^W\/"[a-z0-9]+"$/);
  assert.match(shareETag({}), /^W\/"[a-z0-9]+"$/);
  assert.match(shareETag(null), /^W\/"[a-z0-9]+"$/);
});

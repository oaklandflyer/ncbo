import test from 'node:test';
import assert from 'node:assert/strict';
import { monogram, initials } from '../src/lib/monogram.js';

/*
 * The monogram is the branch every chapter without a logo takes, which today
 * is all of them. It has one hard requirement: it never returns nothing. An
 * empty box in a leaderboard reads as a broken image, not as a chapter that
 * has not uploaded anything yet.
 */

test('takes the initials of a chapter name', () => {
  assert.equal(monogram({ chapter: 'Penn State' }), 'PS');
  assert.equal(monogram({ chapter: 'Pitt' }), 'P');
});

test('stops at two letters', () => {
  assert.equal(monogram({ chapter: 'Florida State University' }), 'FS');
});

test('splits on hyphens as well as spaces', () => {
  assert.equal(monogram({ chapter: 'Slippery-Rock' }), 'SR');
});

test('reads whichever club field the caller happens to hold', () => {
  assert.equal(monogram({ club_name: 'Iowa Bodybuilding' }), 'IB');
  assert.equal(monogram({ shortName: 'Purdue' }), 'P');
  assert.equal(monogram({ name: 'Pitt Club' }), 'PC');
});

test('prefers the chapter name over the full club name', () => {
  /* "Pitt", not "University of Pittsburgh Bodybuilding Club". */
  assert.equal(monogram({ chapter: 'Pitt', club_name: 'Fitness and Bodybuilding Club' }), 'P');
});

test('never returns an empty string', () => {
  for (const club of [null, undefined, {}, { chapter: '' }, { chapter: '   ' }, { chapter: '-' }]) {
    assert.equal(monogram(club), 'NC', `empty monogram for ${JSON.stringify(club)}`);
  }
});

/* `initials` was the same eight lines copy-pasted into four components. It has
   the same hard requirement as `monogram`: never an empty string. */

test('initials takes up to two letters', () => {
  assert.equal(initials('Drew Coutinho'), 'DC');
  assert.equal(initials('Drew'), 'D');
  assert.equal(initials('Mary Jane Watson'), 'MJ');
});

test('initials never returns an empty string', () => {
  for (const name of [null, undefined, '', '   ', 0, false]) {
    assert.equal(initials(name), 'M', `empty initials for ${JSON.stringify(name)}`);
  }
});

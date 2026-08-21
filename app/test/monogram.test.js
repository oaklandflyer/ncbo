import test from 'node:test';
import assert from 'node:assert/strict';
import { monogram } from '../src/lib/monogram.js';

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

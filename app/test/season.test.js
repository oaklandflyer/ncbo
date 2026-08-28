import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentSeason } from '../src/lib/season.js';

/*
 * The season, and the promise the labels make.
 *
 * The last sweep removed the year from the Chapter Cup headings because the
 * RPCs behind them had no season filter — a "2026" over an all-time number is
 * the UI asserting a scope the number does not have. The labels are back now,
 * which means every screen that prints a year must also have asked for that
 * year. That is the invariant worth a test: not the arithmetic, the pairing.
 */

test('the season is the current calendar year, in UTC', () => {
  assert.equal(currentSeason(), new Date().getUTCFullYear());
  assert.equal(typeof currentSeason(), 'number');
});

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('every ranking RPC call passes a season', () => {
  /* An omitted argument would fall back to the database's own
     `current_season()`, which is usually the same answer — and would silently
     stop being the same answer the moment anything wanted a past season. */
  const callers = [
    '../src/app/hub/home/data.js',
    '../src/app/(shell)/rankings/clubs/page.js',
    '../src/app/(shell)/rankings/athletes/page.js',
    '../src/app/hub/network/page.js',
  ];

  for (const path of callers) {
    const source = read(path);
    const calls = source.match(/\.rpc\('get_(athlete_rankings|chapter_cup_standings)'[^)]*\)/gs) || [];
    assert.ok(calls.length > 0, `${path} was expected to call a ranking RPC`);
    for (const call of calls) {
      assert.match(call, /season_year:/, `${path} calls a ranking RPC without a season`);
    }
  }
});

test('a screen that prints a year got it from the same place', () => {
  for (const path of [
    '../src/app/(shell)/rankings/clubs/page.js',
    '../src/app/(shell)/rankings/athletes/page.js',
  ]) {
    const source = read(path);
    assert.match(source, /currentSeason/, `${path} must derive the year it prints`);
    assert.doesNotMatch(source, /\b20\d\d season\b/, `${path} must not hard-code a year`);
  }
});

/*
 * The Hub shell. `page.js` used to await eleven queries before rendering
 * anything, which is what made Home feel slow on a phone: not a slow render,
 * an empty one.
 */
test('the Hub renders its shell without awaiting page data', () => {
  const source = read('../src/app/hub/page.js');

  assert.match(source, /<Suspense/, 'the Hub must stream its data');

  /* The one await the shell is allowed: who is looking at it. Everything else
     belongs inside a boundary. */
  const shell = source.slice(
    source.indexOf('export default async function Hub()'),
    source.indexOf('async function ReviewQueueLink'),
  );
  assert.doesNotMatch(shell, /Promise\.all/, 'the shell must not batch-await page data');
  assert.doesNotMatch(shell, /load[A-Z]\w+\(/, 'the shell must not call a loader directly');
});

test('the skeletons reserve height, so the stream does not shift the page', () => {
  const source = read('../src/app/hub/home/skeletons.js');
  assert.match(source, /animate-pulse/);

  /* Every placeholder needs an explicit height. A zero-height fallback is a
     page that jumps when the data lands, which is worse than one that waits —
     so every element carrying the shared block class also carries an `h-`. */
  const blocks = source.match(/\$\{BLOCK\}[^`]*`/g) || [];
  assert.ok(blocks.length >= 3, 'expected several skeleton blocks');
  for (const block of blocks) {
    assert.match(block, /\bh-(\d+|full)\b/, `a skeleton block reserves no height: ${block}`);
  }
});

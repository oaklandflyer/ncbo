import test from 'node:test';
import assert from 'node:assert/strict';
import { SIZES, SIZE_NAMES, resolveSize } from '../src/app/brand/sizes.js';

/*
 * The point of this module is that a size can never become an inline style
 * again. These tests guard the two ways that could come back: a numeric prop
 * being quietly accepted, and a variant losing its class pair.
 */

test('every variant carries a box, a radius and a text class', () => {
  for (const name of SIZE_NAMES) {
    const v = SIZES[name];
    assert.match(v.box, /\bh-\d+\b/, `${name}.box has no height`);
    assert.match(v.box, /\bw-\d+\b/, `${name}.box has no width`);
    assert.match(v.radius, /^rounded-/, `${name}.radius`);
    assert.match(v.text, /^text-/, `${name}.text`);
  }
});

test('no variant smuggles a bracketed pixel value into box', () => {
  /* `h-[24px]` would be a literal size again, just spelled as a class. The
     scale is meant to be a scale. */
  for (const name of SIZE_NAMES) {
    assert.doesNotMatch(SIZES[name].box, /\[\d+px\]/, `${name}.box`);
  }
});

test('md is the responsive step, and the only one', () => {
  assert.match(SIZES.md.box, /md:h-\d+/);
  for (const name of ['xs', 'sm', 'lg']) {
    assert.doesNotMatch(SIZES[name].box, /md:/, `${name} should not be responsive`);
  }
});

test('a numeric size throws rather than silently falling back', () => {
  /* The old API. If this ever resolves instead of throwing, every call site
     that was not migrated keeps working and the bug hides. */
  assert.throws(() => resolveSize(24, 'ClubLogo'), /size must be one of/);
  assert.throws(() => resolveSize(72, 'ClubLogo'), /Numeric sizes are gone/);
});

test('an unknown or missing variant throws too', () => {
  assert.throws(() => resolveSize('huge', 'Avatar'), /size must be one of/);
  assert.throws(() => resolveSize(undefined, 'Avatar'), /size must be one of/);
  assert.throws(() => resolveSize(null, 'Avatar'), /size must be one of/);
});

test('the error names the component, so the stack is not the only clue', () => {
  assert.throws(() => resolveSize(20, 'ClubLogo'), /^Error: ClubLogo:/);
});

test('every valid variant resolves to its own entry', () => {
  for (const name of SIZE_NAMES) {
    assert.equal(resolveSize(name, 'ClubLogo'), SIZES[name]);
  }
});

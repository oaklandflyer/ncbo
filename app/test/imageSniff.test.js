import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sniffImage } from '../src/lib/imageSniff.js';

/*
 * This is the check that stands between an upload form and a bucket, so the
 * cases that matter are the ones where a caller is lying: the browser's MIME
 * type never reaches it, and neither does the filename.
 */

test('recognises a real PNG, the one we generate ourselves', () => {
  const seal = readFileSync(new URL('../public/brand/ncbo-seal.png', import.meta.url));
  assert.equal(sniffImage(seal), 'png');
});

test('recognises the other three headers', () => {
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])), 'jpeg');
  assert.equal(sniffImage(Buffer.from('GIF89a')), 'gif');
  assert.equal(sniffImage(Buffer.concat([
    Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 '),
  ])), 'webp');
});

test('an SVG is not an image as far as this is concerned', () => {
  /* Deliberate. SVG is a script host, and a bucket served on a public origin
     is not the place to find that out. */
  assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
});

test('a script named .png is still a script', () => {
  assert.equal(sniffImage(Buffer.from('#!/bin/sh\nrm -rf /\n')), null);
  assert.equal(sniffImage(Buffer.from('<?php echo 1; ?>')), null);
  assert.equal(sniffImage(Buffer.from('%PDF-1.7')), null);
});

test('RIFF alone is not WebP', () => {
  /* A .wav starts RIFF too, and reading past the end of a four-byte buffer
     must not throw either. */
  assert.equal(sniffImage(Buffer.concat([
    Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WAVE'),
  ])), null);
  assert.equal(sniffImage(Buffer.from('RIFF')), null);
});

test('empty and undersized input is null, not a throw', () => {
  assert.equal(sniffImage(Buffer.alloc(0)), null);
  assert.equal(sniffImage(Buffer.from([0x89])), null);
  assert.equal(sniffImage(null), null);
  assert.equal(sniffImage(undefined), null);
});

test('a PNG header with one byte wrong is refused', () => {
  const almost = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x00]);
  assert.equal(sniffImage(almost), null);
});

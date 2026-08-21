/**
 * What a file actually is, from its own first bytes.
 *
 * `file.type` is whatever the browser was told, and the browser was told by
 * the client. A `.png` extension and an `image/png` MIME header cost nothing
 * to forge; the first eight bytes of a real PNG do not.
 *
 * Its own module so it can be tested without pulling in `sharp` and
 * `next/cache` alongside it.
 *
 * Four formats in, one format out. WebP and AVIF-era phone output is accepted
 * because phones produce it, and refusing a photo somebody's camera just took
 * is a support ticket rather than a security control.
 */
const SIGNATURES = [
  ['png',  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0],
  ['jpeg', [0xff, 0xd8, 0xff], 0],
  ['gif',  [0x47, 0x49, 0x46, 0x38], 0],
  /* "RIFF" then four bytes of length then "WEBP", so the tag that identifies
     the format sits at byte 8 rather than at the start. */
  ['webp', [0x57, 0x45, 0x42, 0x50], 8],
];

/** The format name, or null for anything not on the list. */
export function sniffImage(bytes) {
  if (!bytes || bytes.length < 4) return null;
  for (const [name, sig, offset] of SIGNATURES) {
    if (bytes.length < offset + sig.length) continue;
    if (sig.every((b, i) => bytes[offset + i] === b)) return name;
  }
  return null;
}

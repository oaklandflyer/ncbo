/**
 * WCAG 2.1 AA contrast check over the design tokens.
 *
 * Dark and low-chroma palettes fail contrast in ways that look fine to whoever
 * picked them, so this is checked arithmetically rather than by eye. The pairs
 * below are the combinations actually used in components; adding a new
 * foreground/background pair to the CSS means adding it here too.
 *
 * Thresholds (WCAG 2.1 §1.4.3): 4.5:1 for normal text, 3:1 for large text
 * (>=24px, or >=18.66px bold) and for UI component boundaries (§1.4.11).
 *
 *   npm run check:contrast
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS = resolve(here, '../src/styles/tokens.css');

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const value = hex.replace('#', '').trim();
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  const int = Number.parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** WCAG relative luminance. */
function luminance([r, g, b]: Rgb): number {
  const channel = (value: number): number => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a: string, b: string): number {
  const la = luminance(parseHex(a));
  const lb = luminance(parseHex(b));
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** Pull `--name: #hex;` declarations out of the token file. */
function readTokens(): Record<string, string> {
  const css = readFileSync(TOKENS, 'utf8');
  const tokens: Record<string, string> = {};
  for (const match of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    const [, name, value] = match;
    if (name && value) tokens[name] = value;
  }
  return tokens;
}

interface Pair {
  fg: string;
  bg: string;
  /** 'normal' = 4.5:1, 'large' = 3:1 (display type), 'ui' = 3:1 (borders, controls). */
  level: 'normal' | 'large' | 'ui';
  where: string;
}

const PAIRS: Pair[] = [
  { fg: 'text', bg: 'bg', level: 'normal', where: 'body copy on the page ground' },
  { fg: 'text', bg: 'surface', level: 'normal', where: 'body copy on a card' },
  { fg: 'text', bg: 'bg-band', level: 'normal', where: 'body copy on a band' },
  { fg: 'text', bg: 'surface-raised', level: 'normal', where: 'unranked table row' },
  { fg: 'text-soft', bg: 'bg', level: 'normal', where: 'lead paragraphs' },
  { fg: 'text-soft', bg: 'surface', level: 'normal', where: 'card body copy' },
  { fg: 'text-soft', bg: 'bg-band', level: 'normal', where: 'footer copy' },
  { fg: 'text-muted', bg: 'bg', level: 'normal', where: 'meta text' },
  { fg: 'text-muted', bg: 'surface', level: 'normal', where: 'table headers, captions' },
  { fg: 'text-muted', bg: 'bg-band', level: 'normal', where: 'footer meta' },
  { fg: 'text-fine', bg: 'surface', level: 'normal', where: 'fine print' },
  { fg: 'steel-deep', bg: 'bg', level: 'normal', where: 'links on the page ground' },
  { fg: 'steel-deep', bg: 'surface', level: 'normal', where: 'links on a card' },
  { fg: 'steel-deep', bg: 'surface-raised', level: 'normal', where: 'stat tile value' },
  { fg: 'steel', bg: 'surface', level: 'large', where: 'display accent type' },
  { fg: 'on-dark', bg: 'scrim', level: 'normal', where: 'hero type on the navy scrim' },
  { fg: 'on-dark-soft', bg: 'scrim', level: 'normal', where: 'hero subtitle' },
  { fg: 'on-dark', bg: 'steel-deep', level: 'normal', where: 'SANCTIONED badge, active chip' },
  { fg: 'warn-text', bg: 'warn-bg', level: 'normal', where: 'sample-data banner, disclaimer' },
  { fg: 'good', bg: 'surface', level: 'normal', where: 'VERIFIED badge, upward movement' },
  { fg: 'danger', bg: 'surface', level: 'normal', where: 'downward movement' },
  { fg: 'line-strong', bg: 'surface', level: 'ui', where: 'control boundaries: chips, badges, table rules' },
  { fg: 'line-strong', bg: 'bg', level: 'ui', where: 'control boundaries on the page ground' },
  { fg: 'line-strong', bg: 'surface-raised', level: 'ui', where: 'progress track boundary' },
  { fg: 'steel', bg: 'bg', level: 'ui', where: 'accent rules and focus-adjacent borders' },
  { fg: 'warn-line', bg: 'warn-bg', level: 'ui', where: 'banner border' },
  { fg: 'steel-deep', bg: 'bg', level: 'ui', where: 'focus ring on the page ground' },
  { fg: 'steel-deep', bg: 'surface', level: 'ui', where: 'focus ring on a card' },
];

const THRESHOLD = { normal: 4.5, large: 3, ui: 3 } as const;

function main(): void {
  const tokens = readTokens();
  const failures: string[] = [];
  const results: string[] = [];

  for (const pair of PAIRS) {
    const fg = tokens[pair.fg];
    const bg = tokens[pair.bg];
    if (!fg || !bg) {
      failures.push(`Unknown token in pair --${pair.fg} on --${pair.bg} (${pair.where})`);
      continue;
    }
    const value = ratio(fg, bg);
    const required = THRESHOLD[pair.level];
    const line = `${value.toFixed(2)}:1  (needs ${required}:1)  --${pair.fg} on --${pair.bg}  — ${pair.where}`;
    if (value < required) failures.push(line);
    else results.push(line);
  }

  for (const line of results) console.log(`  PASS  ${line}`);

  if (failures.length > 0) {
    console.error(`\nContrast failures (${failures.length}):\n`);
    for (const failure of failures) console.error(`  FAIL  ${failure}`);
    console.error('\nWCAG 2.1 AA: 4.5:1 normal text, 3:1 large text and UI boundaries.\n');
    process.exit(1);
  }

  console.log(`\nContrast: ${results.length} token pair(s) checked, all pass WCAG 2.1 AA.`);
}

main();

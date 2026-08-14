/**
 * Content policy guard.
 *
 * The hard exclusions in docs/CONTENT-POLICY.md are the kind of rule that holds
 * right up until someone edits a Markdown file in a hurry a year from now. This
 * turns them into a check that fails rather than a convention that erodes.
 *
 * It is intentionally blunt: a keyword tripwire, not a semantic reviewer. False
 * positives are the expected failure mode, and the fix for one is to rephrase or
 * to add a narrowly-scoped allowance below with a reason — not to delete the rule.
 *
 *   npm run check:content
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const SCAN_DIRS = [
  resolve(ROOT, 'web/src/content'),
  resolve(ROOT, 'data/templates'),
  resolve(ROOT, 'data/events'),
];

interface Rule {
  id: string;
  /** Matched case-insensitively against the page text. */
  pattern: RegExp;
  why: string;
}

const RULES: Rule[] = [
  {
    id: 'dehydration',
    pattern: /\b(water[- ]?(cut|cutting|load|loading|manipulation)|dehydrat\w*\s+(protocol|strategy|plan)|sodium\s+(load|loading|manipulation)|electrolyte\s+manipulation)\b/i,
    why: 'No dehydration, water-cutting/loading or electrolyte-manipulation protocols — not as instructions, not as description, not as a table. The Helms review states the practice can be dangerous and may not improve appearance.',
  },
  {
    id: 'diuretics',
    pattern: /\b(diuretic|dandelion\s+root\s+extract|water\s+pill)\w*\b/i,
    why: 'No diuretic content of any kind, including over-the-counter and "natural" diuretics.',
  },
  {
    id: 'ped-dosing',
    pattern: /\b(\d+\s?mg\s*(\/|per\s)?\s*(week|wk|day|kg)|cycle\s+length|post[- ]cycle\s+therapy|\bPCT\b|stack\s+with|sourcing\s+(gear|SARMs))\b/i,
    why: 'No actionable PED, SARM or pro-hormone dosing, cycling or sourcing information. Describing what is banned and why is fine; anything actionable is not.',
  },
  {
    id: 'individual-targets',
    pattern: /\b(goal\s?weight\s+calculator|your\s+target\s+body\s?fat|eat\s+\d{3,5}\s+(kcal|calories)\s+(a|per)\s+day)\b/i,
    why: 'No specific calorie targets, cut timelines or body-fat targets for individuals, and no goal-weight calculators.',
  },
];

/**
 * Narrow, reasoned allowances. Each one must name the file and the rule, so an
 * allowance is a visible decision rather than a quiet weakening of a rule.
 */
const ALLOWANCES: { file: string; rule: string; reason: string }[] = [
  {
    file: 'web/src/content/resources/prep.md',
    rule: 'dehydration',
    reason:
      'The prep page names the excluded practices in order to state that they are excluded and that the evidence says they can be dangerous. Stating the prohibition requires naming it.',
  },
  {
    file: 'web/src/content/resources/prep.md',
    rule: 'diuretics',
    reason: 'Same — the exclusion list names diuretics in order to exclude them.',
  },
  {
    file: 'web/src/content/resources/prep.md',
    rule: 'individual-targets',
    reason: 'Same — the exclusion list names goal-weight calculators in order to exclude them.',
  },
];

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (['.md', '.mdx', '.json', '.astro'].includes(extname(full))) out.push(full);
  }
  return out;
}

function main(): void {
  const failures: string[] = [];
  let scanned = 0;

  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      scanned += 1;
      const relativePath = relative(ROOT, file);
      const text = readFileSync(file, 'utf8');

      for (const rule of RULES) {
        const match = rule.pattern.exec(text);
        if (!match) continue;

        const allowed = ALLOWANCES.some(
          (allowance) => allowance.file === relativePath && allowance.rule === rule.id,
        );
        if (allowed) continue;

        const line = text.slice(0, match.index).split('\n').length;
        failures.push(
          `${relativePath}:${line}\n    rule: ${rule.id}\n    matched: "${match[0]}"\n    ${rule.why}`,
        );
      }
    }
  }

  if (failures.length > 0) {
    console.error(`\nContent policy violations (${failures.length}):\n`);
    for (const failure of failures) console.error(`  ${failure}\n`);
    console.error('See docs/CONTENT-POLICY.md. If a match is a false positive, rephrase it or');
    console.error('add a narrow allowance in scripts/check-content.ts with a stated reason.\n');
    process.exit(1);
  }

  console.log(`Content policy: ${scanned} file(s) scanned, no violations.`);
}

main();

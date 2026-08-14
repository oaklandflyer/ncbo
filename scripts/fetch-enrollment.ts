/**
 * Fetch undergraduate enrollment denominators from IPEDS.
 *
 * IPEDS is the US Department of Education's Integrated Postsecondary Education
 * Data System, published by the National Center for Education Statistics. The
 * complete data files are public domain and need no API key, no account and no
 * registration — which is exactly why the standings use them.
 *
 *   HD<year>.zip  institutional directory: UnitID, institution name, state
 *   EF<year>A.zip fall enrollment by level and student type
 *
 * Run:  npm run fetch:enrollment            (from web/)
 *       tsx scripts/fetch-enrollment.ts     (from the repo root)
 *
 * ── Two rules this script exists to enforce ──────────────────────────────────
 *
 * 1. **It verifies the URL pattern at runtime rather than trusting a hardcoded
 *    one.** NCES reorganises its data centre periodically. A hardcoded URL that
 *    404s silently is how a build ends up with stale or missing denominators.
 *    This probes candidate years and reports what it actually found.
 *
 * 2. **It fails loudly.** If the fetch does not work, the script exits non-zero
 *    with an explanation and writes nothing. It never falls back to estimates,
 *    cached guesses or "close enough" numbers. A missing denominator produces a
 *    club listed as "Unranked — no verified enrollment figure", which is true;
 *    an invented one produces a national ranking that is a lie.
 *
 * The derived JSON is committed so the site build never depends on the network.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(here, '../data/enrollment.json');

const DATA_CENTER = 'https://nces.ed.gov/ipeds/datacenter/data';
/** The human-facing index, quoted in errors and recorded as the citation source. */
const DATA_FILES_PAGE = 'https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx';
/** Newest first — the first year with both components available wins. */
const CANDIDATE_YEARS = [2024, 2023, 2022, 2021];

class FetchFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchFailure';
  }
}

async function exists(url: string): Promise<boolean> {
  try {
    // HEAD first; some NCES endpoints reject it, so fall back to a ranged GET.
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (head.ok) return true;
    const ranged = await fetch(url, { headers: { Range: 'bytes=0-0' }, redirect: 'follow' });
    return ranged.ok;
  } catch {
    return false;
  }
}

/** Probe the data centre for a year with both components present. */
async function resolveYear(): Promise<{ year: number; hd: string; ef: string }> {
  const attempts: string[] = [];
  for (const year of CANDIDATE_YEARS) {
    const hd = `${DATA_CENTER}/HD${year}.zip`;
    const ef = `${DATA_CENTER}/EF${year}A.zip`;
    const [hdOk, efOk] = await Promise.all([exists(hd), exists(ef)]);
    attempts.push(`  ${year}: HD ${hdOk ? 'found' : 'missing'}, EF ${efOk ? 'found' : 'missing'}`);
    if (hdOk && efOk) return { year, hd, ef };
  }
  throw new FetchFailure(
    `No IPEDS year had both the HD and EF components available.\n${attempts.join('\n')}\n\n` +
      'Two things look identical from here, so check both:\n' +
      '  1. No network access to nces.ed.gov. Corporate proxies, CI sandboxes and egress\n' +
      '     allowlists commonly block it. Try: curl -I ' + `${DATA_CENTER}/HD2023.zip\n` +
      '  2. The URL pattern changed. NCES reorganises the data centre periodically.\n' +
      `     Check ${DATA_FILES_PAGE} and update DATA_CENTER / CANDIDATE_YEARS.`,
  );
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new FetchFailure(`GET ${url} returned ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Minimal ZIP reader for the single CSV inside an IPEDS archive.
 *
 * Written against node:zlib rather than pulling in a ZIP library, so this script
 * has no dependencies at all and can be run with plain `node --experimental-strip-types`
 * or tsx from anywhere in the repo. IPEDS archives contain one entry, stored
 * (method 0) or deflated (method 8).
 *
 * It reads the central directory rather than scanning local headers, because a
 * streamed ZIP can set sizes to zero in the local header and only fill them in
 * afterwards — reading the local header alone would silently truncate the CSV.
 */
function unzipSingleCsv(archive: Uint8Array): string {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const decoder = new TextDecoder('latin1');

  // Find the end-of-central-directory record, scanning back from the end.
  let eocd = -1;
  for (let i = archive.length - 22; i >= 0 && i > archive.length - 66_000; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new FetchFailure('Not a ZIP archive: no end-of-central-directory record');

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const names: string[] = [];

  for (let entry = 0; entry < entryCount; entry += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new FetchFailure('Corrupt ZIP central directory');
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(archive.subarray(offset + 46, offset + 46 + nameLength));
    names.push(name);

    if (name.toLowerCase().endsWith('.csv')) {
      // Re-read the local header to find where the data actually starts.
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const data = archive.subarray(dataStart, dataStart + compressedSize);
      const bytes = method === 0 ? Buffer.from(data) : inflateRawSync(Buffer.from(data));
      // IPEDS CSVs are Latin-1, not UTF-8 — institution names carry accented
      // characters that decode to replacement characters if this is got wrong.
      return new TextDecoder('latin1').decode(bytes);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new FetchFailure(`No CSV inside archive (contains: ${names.join(', ')})`);
}

/** IPEDS CSVs are comma-separated with quoted fields. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  const header = rows.shift();
  if (!header) throw new FetchFailure('CSV had no header row');
  return rows
    .filter((values) => values.length === header.length)
    .map((values) => Object.fromEntries(header.map((key, index) => [key.trim(), values[index] ?? ''])));
}

async function main(): Promise<void> {
  console.log('Resolving the current IPEDS URL pattern…');
  const { year, hd, ef } = await resolveYear();
  console.log(`Using IPEDS ${year}\n  ${hd}\n  ${ef}`);

  const [hdCsv, efCsv] = await Promise.all([
    download(hd).then(unzipSingleCsv),
    download(ef).then(unzipSingleCsv),
  ]);

  const directory = parseCsv(hdCsv);
  const enrollment = parseCsv(efCsv);

  const names = new Map<string, string>();
  for (const row of directory) {
    const unitId = row['UNITID'];
    const name = row['INSTNM'];
    if (unitId && name) names.set(unitId, name);
  }

  /**
   * EFTOTLT is the total for a given (level, student type) row; the
   * undergraduate total is EFALEVEL 2 in the EF A file. This is the line to
   * re-check if NCES changes its coding — and the reason the denominator choice
   * is documented rather than assumed.
   */
  const institutions: Record<string, { name: string; undergraduateEnrollment: number }> = {};
  for (const row of enrollment) {
    if (row['EFALEVEL'] !== '2') continue;
    const unitId = row['UNITID'];
    const total = Number.parseInt(row['EFTOTLT'] ?? '', 10);
    if (!unitId || !Number.isFinite(total)) continue;
    const name = names.get(unitId);
    if (!name) continue;
    institutions[unitId] = { name, undergraduateEnrollment: total };
  }

  const count = Object.keys(institutions).length;
  if (count === 0) {
    throw new FetchFailure(
      'Parsed both files but extracted zero institutions. The column names or the ' +
        'EFALEVEL coding have probably changed — inspect the CSV headers before trusting any output.',
    );
  }

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(
    OUTPUT,
    `${JSON.stringify(
      {
        _comment:
          'Undergraduate enrollment denominators, keyed by IPEDS UnitID. GENERATED FILE - do not hand-edit. Produced by scripts/fetch-enrollment.ts.',
        source: {
          title: `IPEDS ${year} complete data files (HD${year}, EF${year}A)`,
          url: DATA_FILES_PAGE,
          accessed: new Date().toISOString().slice(0, 10),
        },
        generatedAt: new Date().toISOString(),
        ipedsYear: year,
        denominator: 'undergraduate_enrollment',
        institutions,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Wrote ${count.toLocaleString('en-US')} institutions to ${OUTPUT}`);
  console.log('Commit this file — the site build must never depend on the network.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('\nIPEDS enrollment fetch FAILED.\n');
  console.error(message);
  console.error(
    '\nNothing was written. data/enrollment.json is unchanged, and the standings will keep ' +
      'reporting clubs as "Unranked — no verified enrollment figure".\n' +
      'That is the intended behaviour: no enrollment number is ever estimated, cached from ' +
      'memory, or filled in by hand. Fix the fetch, or leave the denominators absent.\n',
  );
  process.exit(1);
});

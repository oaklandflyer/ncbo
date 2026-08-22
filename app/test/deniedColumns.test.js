import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Two columns in this schema may be WRITTEN by a member and not READ back by
 * one. `restrict_columns` (migration 0015) revokes table-level SELECT and
 * grants an explicit column list, so asking for a denied column through a
 * user's own session fails the WHOLE statement with
 * `42501 permission denied for table <table>` — not a null field, a dead query.
 *
 * This has now shipped twice:
 *
 *   · onboarding upserted `club_memberships`, and ON CONFLICT DO UPDATE reads
 *     `excluded.legal_name`. Every resubmission failed.
 *   · hard delete selected `profiles.email` for the calling admin. Every
 *     attempt failed, and the feature looked simply broken.
 *
 * Both were invisible to unit tests, because the fault is in a query string.
 * So this reads the source and refuses the pattern. The service-role client
 * is exempt: it bypasses RLS and column grants, which is the entire reason it
 * exists and the reason the TARGET read in the same file is fine.
 */

const DENIED = {
  profiles: ['email'],
  club_memberships: [
    'legal_name', 'group_chat_handle', 'group_chat_platform',
    'found_via', 'student_id_photo_path', 'decision_note',
  ],
};

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

const SRC = new URL('../src', import.meta.url).pathname;

test('no query selects a column the caller is not granted', () => {
  const offenders = [];

  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8');

    for (const [table, denied] of Object.entries(DENIED)) {
      /* `.from('table')` followed by a `.select(...)` before the next
         `.from(`. Deliberately crude: a false positive here costs a comment
         explaining why a line is safe, and a false negative costs a feature
         that fails for everybody. */
      const pattern = new RegExp(`\\.from\\(['"\`]${table}['"\`]\\)([\\s\\S]{0,400}?)\\.select\\(([^)]*)\\)`, 'g');
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const projection = match[2];
        const context = source.slice(Math.max(0, match.index - 400), match.index);
        /* The service-role client bypasses column grants entirely. */
        const viaAdmin = /\badmin\s*$/.test(source.slice(0, match.index).trimEnd())
          || /admin\s*\n?\s*\.from/.test(source.slice(Math.max(0, match.index - 20), match.index + 10))
          || /createAdminClient/.test(context);
        if (viaAdmin) continue;

        for (const column of denied) {
          if (new RegExp(`\\b${column}\\b`).test(projection)) {
            offenders.push(`${file.replace(SRC, 'src')}: selects ${table}.${column}`);
          }
        }
      }
    }
  }

  assert.deepEqual(offenders, [], `denied columns selected through a user session:\n${offenders.join('\n')}`);
});

test('no query upserts a table with denied columns', () => {
  /* `ON CONFLICT DO UPDATE` reads `excluded.<column>`, so an upsert touching a
     denied column fails on the conflict path only — the first insert works,
     which is what let this reach production. */
  const offenders = [];

  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const table of Object.keys(DENIED)) {
      const pattern = new RegExp(`\\.from\\(['"\`]${table}['"\`]\\)[\\s\\S]{0,200}?\\.upsert\\(`, 'g');
      if (pattern.test(source)) {
        offenders.push(`${file.replace(SRC, 'src')}: upserts ${table}`);
      }
    }
  }

  assert.deepEqual(offenders, [], `upserts on a table with denied columns:\n${offenders.join('\n')}`);
});

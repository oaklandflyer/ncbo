import test from 'node:test';
import assert from 'node:assert/strict';
import { isOnboarded, missingFields, ONBOARDING_FIELDS } from '../src/lib/onboarding.js';

/*
 * The rule is written twice: here and in `public.is_onboarded(public.profiles)`.
 * These are the same cases the SQL suite asserts, so the two copies cannot
 * drift without one going red.
 *
 * The bug this file exists to prevent has already happened once in spirit:
 * `class_year` was required here after migration 0026 stopped writing it,
 * which would have trapped every new account in onboarding permanently, with
 * the form no longer offering the field that would release them.
 */

const student = {
  is_adult: true,
  full_name: 'Drew Coutinho',
  display_name: 'Drew',
  lifting_experience: '1–2 years',
  major: 'Kinesiology',
  affiliation: 'student',
  grad_year: 2027,
};

const affiliate = { ...student, affiliation: 'affiliate', grad_year: null };

test('a complete student is onboarded', () => {
  assert.equal(isOnboarded(student), true);
  assert.deepEqual(missingFields(student), []);
});

test('an affiliate needs no graduation year', () => {
  assert.equal(isOnboarded(affiliate), true);
  assert.deepEqual(missingFields(affiliate), []);
});

test('a student without a graduation year is NOT finished', () => {
  assert.equal(isOnboarded({ ...student, grad_year: null }), false);
  assert.deepEqual(missingFields({ ...student, grad_year: null }), ['grad_year']);
});

test('class_year is not required, and its absence does not trap anybody', () => {
  /* The regression: 0026 deprecated class_year, so requiring it would send
     every new account to a form that cannot satisfy it. */
  const noClassYear = { ...student, class_year: null };
  assert.equal(isOnboarded(noClassYear), true);
});

test('an unanswered affiliation is not finished', () => {
  assert.equal(isOnboarded({ ...student, affiliation: null }), false);
  assert.equal(isOnboarded({ ...student, affiliation: '' }), false);
});

test('an affiliation nobody defined is not finished either', () => {
  /* Fails closed. A value the database CHECK would refuse must not read as
     complete here, or the app and the database disagree about who gets in. */
  assert.equal(isOnboarded({ ...student, affiliation: 'admin' }), false);
  assert.equal(isOnboarded({ ...student, affiliation: 'club_lead' }), false);
});

test('the 18+ attestation is required and cannot be faked with a truthy value', () => {
  assert.equal(isOnboarded({ ...student, is_adult: false }), false);
  assert.equal(isOnboarded({ ...student, is_adult: 'yes' }), false);
  assert.equal(isOnboarded({ ...student, is_adult: 1 }), false);
});

test('every text field is required, and whitespace is not an answer', () => {
  for (const key of ['full_name', 'display_name', 'lifting_experience', 'major']) {
    assert.equal(isOnboarded({ ...student, [key]: '' }), false, key);
    assert.equal(isOnboarded({ ...student, [key]: '   ' }), false, `${key} whitespace`);
    assert.deepEqual(missingFields({ ...student, [key]: '  ' }), [key]);
  }
});

test('grad_year 0 is a year, not an absence', () => {
  /* `== null` rather than falsy, so a legitimate-but-odd value is not read as
     missing. The CHECK constraint refuses it separately. */
  assert.equal(isOnboarded({ ...student, grad_year: 0 }), true);
});

test('a null profile is not onboarded, and does not throw', () => {
  assert.equal(isOnboarded(null), false);
  assert.equal(isOnboarded(undefined), false);
  assert.equal(isOnboarded({}), false);
  assert.deepEqual(missingFields(null), ['everything']);
});

/*
 * The lockout this file's last test guards against actually shipped, and none
 * of the tests above caught it, because every one of them hands `isOnboarded`
 * an object built in the test. The bug was one layer out: `affiliation` became
 * required without being added to the query that reads a profile, so it
 * arrived `undefined` from the database, the check failed for everybody, and
 * signed-in members bounced between /hub and /onboarding forever. The form
 * looked like it was losing their answers; it was re-rendering empty.
 *
 * So this reads the real source file. A unit test over a hand-built object
 * cannot see a missing column, and that is exactly the gap that let it out.
 */
test('every field isOnboarded reads is selected by the profile query', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/lib/supabase/server.js', import.meta.url), 'utf8');

  const start = source.indexOf('const PROFILE_COLUMNS');
  assert.notEqual(start, -1, 'PROFILE_COLUMNS is gone; the select is hand-listed again');
  const block = source.slice(start, source.indexOf('.join(', start));

  for (const field of ONBOARDING_FIELDS) {
    const named = new RegExp(`['"\`]${field}['"\`]`).test(block);
    const spread = block.includes('...ONBOARDING_FIELDS');
    assert.ok(named || spread, `${field} is required by isOnboarded but not selected`);
  }
});

test('the profile query still carries the columns the surfaces render', async () => {
  /* Not exhaustive, and not trying to be: these are the ones whose absence
     produces a silently wrong screen rather than a crash. */
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/lib/supabase/server.js', import.meta.url), 'utf8');
  for (const field of ['status', 'role', 'club_id', 'is_alumni', 'academic_level', 'experience_phase']) {
    assert.ok(source.includes(`'${field}'`), `${field} dropped from the profile select`);
  }
});

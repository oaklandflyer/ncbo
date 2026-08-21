import test from 'node:test';
import assert from 'node:assert/strict';
import { isOnboarded, missingFields } from '../src/lib/onboarding.js';

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

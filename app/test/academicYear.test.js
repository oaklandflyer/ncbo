import test from 'node:test';
import assert from 'node:assert/strict';
import {
  academicYearOf, gradYearOptions, academicLine, academicLevelLabel,
  GRAD_YEAR_MIN, GRAD_YEAR_MAX,
} from '../src/lib/academicYear.js';

/*
 * This file exists because the rule is written twice: here and in
 * `public.academic_year_of()`. The cases below are the same ones
 * `supabase/tests/05_academic_model.sql` asserts against the SQL, so the two
 * copies cannot drift without one suite going red.
 */

test('August is the boundary, not January', () => {
  /* The SQL suite asserts exactly these four. */
  assert.equal(academicYearOf(new Date('2026-07-31T12:00:00Z')), 2026);
  assert.equal(academicYearOf(new Date('2026-08-01T12:00:00Z')), 2027);
  assert.equal(academicYearOf(new Date('2026-12-31T12:00:00Z')), 2027);
  assert.equal(academicYearOf(new Date('2027-01-01T12:00:00Z')), 2027);
});

test('the boundary is the first of August, not the end of it', () => {
  assert.equal(academicYearOf(new Date('2026-07-31T23:59:59Z')), 2026);
  assert.equal(academicYearOf(new Date('2026-08-01T00:00:01Z')), 2027);
});

test('it accepts a string or a Date', () => {
  assert.equal(academicYearOf('2026-09-01T12:00:00Z'), 2027);
  assert.equal(academicYearOf(new Date('2026-09-01T12:00:00Z')), 2027);
});

test('the dropdown offers one year back and six forward', () => {
  const years = gradYearOptions(new Date('2026-09-01T12:00:00Z'));
  assert.equal(years.length, 8);
  assert.equal(years[0], 2026);
  assert.equal(years[years.length - 1], 2033);
});

test('the dropdown range moves in August, with the academic year', () => {
  /* The bug this guards: a calendar-year range would still start at 2025 in
     September, putting the current cohort at the bottom of the list. */
  const july = gradYearOptions(new Date('2026-07-15T12:00:00Z'));
  const september = gradYearOptions(new Date('2026-09-15T12:00:00Z'));
  assert.equal(july[0], 2025);
  assert.equal(september[0], 2026);
});

test('every offered year is inside the CHECK constraint', () => {
  /* A dropdown that offers a year the database refuses is a form that fails on
     submit. This caught the un-clamped version reaching 2106 in 2099, which is
     why the SQL ceiling moved out to 2200 and the option list is clamped. */
  for (const at of ['2026-01-01', '2026-09-01', '2099-09-01', '2199-09-01']) {
    for (const y of gradYearOptions(new Date(at))) {
      assert.ok(y >= GRAD_YEAR_MIN && y <= GRAD_YEAR_MAX, `${y} outside the constraint`);
    }
  }
});

test('the clamp never empties the list within any plausible lifetime', () => {
  for (const at of ['2026-09-01', '2100-09-01']) {
    assert.ok(gradYearOptions(new Date(at)).length > 0, at);
  }
});

test('the academic line prints what is known and nothing more', () => {
  assert.equal(academicLine({ grad_year: 2027, academic_level: 'undergrad' }), 'Class of 2027 · Undergraduate');
  assert.equal(academicLine({ grad_year: 2027 }), 'Class of 2027');
  assert.equal(academicLine({ academic_level: 'phd' }), 'PhD');
  assert.equal(academicLine({}), null);
  assert.equal(academicLine(null), null);
});

test('an unknown level label is null rather than the raw enum', () => {
  assert.equal(academicLevelLabel('undergrad'), 'Undergraduate');
  assert.equal(academicLevelLabel('wizard'), null);
  assert.equal(academicLevelLabel(null), null);
});

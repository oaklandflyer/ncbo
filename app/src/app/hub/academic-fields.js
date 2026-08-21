import { gradYearOptions, ACADEMIC_LEVELS } from '@/lib/academicYear';
import { field, fieldLabel } from '@/app/ui';

/**
 * Graduation year and academic level, as two native selects.
 *
 * One component for all three surfaces that write these: a member editing
 * their own profile, a lead managing a roster row, an admin editing anybody.
 * Three copies of a year dropdown is three chances for one of them to offer a
 * range the database refuses.
 *
 * Native `<select>` rather than a combobox. There are eight years and five
 * levels, both of which fit on a phone screen without searching, and a native
 * select gets the platform's own picker for free.
 *
 * No `'use client'`: two selects with a `defaultValue` have no state and no
 * handlers. Adding the directive here would drag every form that renders it
 * across the boundary for nothing.
 */
export default function AcademicFields({ person, idPrefix = '', required = false }) {
  const years = gradYearOptions();
  const yearId = `${idPrefix}grad_year`;
  const levelId = `${idPrefix}academic_level`;

  /* A stored year outside the offered window is still that person's year: an
     alumnus from 2019 must not have it silently rewritten to 2025 the moment
     somebody opens the form to change something else. */
  const stored = person?.grad_year ? Number(person.grad_year) : null;
  const options = stored && !years.includes(stored)
    ? [stored, ...years].sort((a, b) => a - b)
    : years;

  return (
    <>
      <div>
        <label className={fieldLabel} htmlFor={yearId}>Graduation year</label>
        <select
          id={yearId}
          name="grad_year"
          className={field}
          required={required}
          defaultValue={stored ? String(stored) : ''}
        >
          <option value="">{required ? 'Pick a year' : 'Not stated'}</option>
          {options.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div>
        <label className={fieldLabel} htmlFor={levelId}>Academic level</label>
        <select
          id={levelId}
          name="academic_level"
          className={field}
          defaultValue={person?.academic_level || ''}
        >
          <option value="">Not stated</option>
          {ACADEMIC_LEVELS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
    </>
  );
}

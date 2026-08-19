'use client';

import { useActionState } from 'react';
import { saveOnboarding } from './actions';
import { CLASS_YEARS, EXPERIENCE } from './options';
import { field, fieldLabel, checkline, btnPrimary, fineprint } from '@/app/ui';

/**
 * The onboarding form.
 *
 * `required` on the inputs is a courtesy — it catches mistakes without a round
 * trip. Every field is checked again in the server action, and the 18+
 * attestation a third time by a database trigger, because a checkbox in a
 * browser is a suggestion, not a record.
 */
export default function OnboardingForm({ email, defaultName }) {
  const [state, action, pending] = useActionState(saveOnboarding, {});

  return (
    <form action={action}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={fieldLabel} htmlFor="full_name">Your name</label>
          <input
            id="full_name" name="full_name" type="text" required maxLength={120}
            autoComplete="name" defaultValue={defaultName || ''}
            autoFocus={!defaultName}
            className={field}
          />
          <p className={`mt-2 ${fineprint}`}>
            Your real name. Club leads use it to check you off their roster.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className={fieldLabel} htmlFor="display_name">
            What the board should call you
          </label>
          <input
            id="display_name" name="display_name" type="text" maxLength={60}
            autoComplete="nickname" placeholder="Leave blank to use your first name"
            className={field}
          />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="class_year">Year</label>
          <select id="class_year" name="class_year" required defaultValue="" className={field}>
            <option value="" disabled>Pick one</option>
            {CLASS_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div>
          <label className={fieldLabel} htmlFor="lifting_experience">Training for</label>
          <select
            id="lifting_experience" name="lifting_experience" required defaultValue=""
            className={field}
          >
            <option value="" disabled>Pick one</option>
            {EXPERIENCE.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={fieldLabel} htmlFor="major">Major</label>
          <input
            id="major" name="major" type="text" required maxLength={120}
            placeholder="Mechanical engineering, undecided, …"
            className={field}
          />
        </div>
      </div>

      {/* The attestation gets its own panel rather than sitting in the run of
          fields: it is a statement someone is making, not a preference. */}
      <div className="mt-8 rounded-[8px] border border-edge bg-band px-5 py-5">
        <label className={`${checkline} items-start`} htmlFor="is_adult">
          <input
            id="is_adult" name="is_adult" type="checkbox" required
            className="mt-1 h-4 w-4 shrink-0 accent-[#2F5FA8]"
          />
          <span className="font-display text-[1rem] font-bold uppercase tracking-[0.04em] text-ink">
            I confirm I am 18 years of age or older.
          </span>
        </label>
        <p className={`mt-3 ${fineprint}`}>
          NCBO membership is open to adults only. This is your own statement — nobody,
          including an admin, can make it for you.
        </p>
      </div>

      <button className={`${btnPrimary} mt-8 w-full`} type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Finish and continue'}
      </button>

      {state?.error && (
        <p role="alert" className="mt-4 text-center text-[0.9rem] text-danger">
          {state.error}
        </p>
      )}

      <p className={`mt-7 border-t border-edge pt-6 text-center ${fineprint}`}>
        Signed in as {email}. Wrong account?{' '}
        <a className="font-semibold text-brand underline underline-offset-2 hover:text-brand-light" href="/login">
          Start over
        </a>.
      </p>
    </form>
  );
}

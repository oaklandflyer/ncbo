'use client';

import { useActionState } from 'react';
import { saveOnboarding, CLASS_YEARS, EXPERIENCE } from './actions';

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
    <form className="stack" action={action}>
      <div className="field">
        <label htmlFor="full_name">Your name</label>
        <input
          id="full_name" name="full_name" type="text" required maxLength={120}
          autoComplete="name" defaultValue={defaultName || ''}
          autoFocus={!defaultName}
        />
        <p className="fineprint">Your real name. Club leads use it to check you off their roster.</p>
      </div>

      <div className="field">
        <label htmlFor="display_name">What the board should call you</label>
        <input
          id="display_name" name="display_name" type="text" maxLength={60}
          autoComplete="nickname" placeholder="Leave blank to use your first name"
        />
      </div>

      <div className="field">
        <label htmlFor="class_year">Year</label>
        <select id="class_year" name="class_year" required defaultValue="">
          <option value="" disabled>Pick one</option>
          {CLASS_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="major">Major</label>
        <input
          id="major" name="major" type="text" required maxLength={120}
          placeholder="Mechanical engineering, undecided, …"
        />
      </div>

      <div className="field">
        <label htmlFor="lifting_experience">How long have you been training?</label>
        <select id="lifting_experience" name="lifting_experience" required defaultValue="">
          <option value="" disabled>Pick one</option>
          {EXPERIENCE.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="notice" style={{ textAlign: 'left' }}>
        <label className="checkline" style={{ margin: 0, textTransform: 'none', letterSpacing: 0 }}>
          <input id="is_adult" name="is_adult" type="checkbox" required />
          <span><b>I confirm I am 18 years of age or older.</b></span>
        </label>
        <p className="fineprint" style={{ marginTop: '0.6rem' }}>
          NCBO membership is open to adults only. This is your own statement — nobody,
          including an admin, can make it for you.
        </p>
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Finish and continue'}
      </button>

      {state?.error && <p className="msg err" role="alert">{state.error}</p>}

      <p className="fineprint">
        Signed in as {email}. Wrong account? <a href="/login">Start over</a>.
      </p>
    </form>
  );
}

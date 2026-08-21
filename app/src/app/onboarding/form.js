'use client';

import { useActionState, useState } from 'react';
import { saveOnboarding, searchChapterMembers } from './actions';
import { CLASS_YEARS, EXPERIENCE, GRAD_YEARS, CHAT_PLATFORMS, FOUND_VIA } from './options';
import UniversityPicker from './university-picker';
import { field, fieldLabel, checkline, btnPrimary, fineprint, buttonReset } from '@/app/ui';

/**
 * The onboarding form.
 *
 * `required` on the inputs is a courtesy — it catches mistakes without a round
 * trip. Every field is checked again in the server action, and the 18+
 * attestation a third time by a database trigger, because a checkbox in a
 * browser is a suggestion, not a record.
 *
 * The fields below the university are here because a club lead needs them to
 * recognise somebody. That is worth saying on the form itself: people answer
 * "what is your group chat handle" honestly when they know a human is about to
 * match it against a list, and carelessly when it looks like data collection.
 */
export default function OnboardingForm({ email, defaultName, universities }) {
  const [state, action, pending] = useActionState(saveOnboarding, {});
  const [chapter, setChapter] = useState(null);

  return (
    <form action={action}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={fieldLabel} htmlFor="full_name">Your full name</label>
          <input
            id="full_name" name="full_name" type="text" required maxLength={120}
            autoComplete="name" defaultValue={defaultName || ''}
            autoFocus={!defaultName}
            className={field}
          />
          <p className={`mt-2 ${fineprint}`}>
            The name your club would know you by. Your lead checks it against their roster.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className={fieldLabel} htmlFor="preferred_name">
            Preferred name, if different
          </label>
          <input
            id="preferred_name" name="preferred_name" type="text" maxLength={60}
            autoComplete="nickname" placeholder="What the board should call you"
            className={field}
          />
        </div>

        <div className="sm:col-span-2">
          <UniversityPicker universities={universities} onResolve={setChapter} />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="grad_year">Expected graduation</label>
          <select id="grad_year" name="grad_year" required defaultValue="" className={field}>
            <option value="" disabled>Pick one</option>
            {GRAD_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
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

        <div>
          <label className={fieldLabel} htmlFor="major">Major</label>
          <input
            id="major" name="major" type="text" required maxLength={120}
            placeholder="Mechanical engineering, undecided, …"
            className={field}
          />
        </div>
      </div>

      {/* The verification block. Set apart from the run of fields, and
          labelled for what it is, because these answers are read by one
          person for one purpose. */}
      <div className="mt-8 rounded-[8px] border border-edge bg-band px-5 py-5">
        <p className="font-display text-[0.95rem] font-bold uppercase tracking-[0.04em] text-ink">
          How your club lead will recognise you
        </p>
        <p className={`mt-2 ${fineprint}`}>
          Your lead sees these when they review your application, and nobody else does.
          They are not shown on your profile or to other members.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label className={fieldLabel} htmlFor="group_chat_platform">Group chat</label>
            <select id="group_chat_platform" name="group_chat_platform" defaultValue="" className={field}>
              <option value="">Pick one</option>
              {CHAT_PLATFORMS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className={fieldLabel} htmlFor="group_chat_handle">Your handle there</label>
            <input
              id="group_chat_handle" name="group_chat_handle" type="text" maxLength={120}
              autoComplete="off" placeholder="@yourhandle"
              className={field}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={fieldLabel} htmlFor="found_via">How you found the club</label>
            <select id="found_via" name="found_via" defaultValue="" className={field}>
              <option value="">Pick one</option>
              {FOUND_VIA.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2">
            <ReferredBy clubId={chapter?.club_id} chapterName={chapter?.short_name} />
          </div>
        </div>
      </div>

      {/* The attestation gets its own panel rather than sitting in the run of
          fields: it is a statement someone is making, not a preference. */}
      <div className="mt-6 rounded-[8px] border border-edge bg-band px-5 py-5">
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
          NCBO membership is open to adults only. This is your own statement, and nobody,
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

/**
 * "Referred by", searching verified members of the chapter being applied to.
 *
 * Only offered once a chapter is resolved: before that there is no set of
 * people to search, and a box that searches nothing is worse than no box.
 */
function ReferredBy({ clubId, chapterName }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);

  if (!clubId) return null;

  async function onChange(value) {
    setQuery(value);
    setPicked(null);
    if (value.trim().length < 2) { setResults([]); return; }
    const { members } = await searchChapterMembers(clubId, value);
    setResults(members);
  }

  return (
    <div>
      <label className={fieldLabel} htmlFor="referred_by">
        Referred by, if anyone <span className="normal-case text-fine">(optional)</span>
      </label>
      <input type="hidden" name="referred_by_user_id" value={picked?.id || ''} />
      <input
        id="referred_by" type="text" autoComplete="off"
        className={field}
        placeholder={`Search members at ${chapterName || 'your chapter'}`}
        value={picked ? picked.display_name : query}
        onChange={(e) => onChange(e.target.value)}
      />
      {!picked && results.length > 0 && (
        <ul className="mt-1 list-none rounded-[8px] border border-edge bg-surface">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => { setPicked(m); setResults([]); }}
                className={`${buttonReset} w-full px-4 py-2 text-left text-[0.9rem] text-body hover:bg-band`}
              >
                {m.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

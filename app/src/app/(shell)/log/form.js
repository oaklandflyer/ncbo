'use client';

import { useActionState, useState } from 'react';
import { logEntry, searchClubMembers } from '../entries/actions';
import {
  field, fieldLabel, checkline, btnPrimary, btnSmall, buttonReset, fineprint, FormMessage,
} from '@/app/ui';

const FEDERATIONS = ['OCB', 'WNBF', 'INBF', 'NANBF', 'NPC', 'IFBB', 'OTHER'];
const PLACINGS = ['1st', '2nd', '3rd', '4th', '5th', 'DNP'];

export default function LogForm({ clubId, chapter }) {
  const [state, action, pending] = useActionState(logEntry, {});
  const [crew, setCrew] = useState([]);

  return (
    <form action={action} className="max-w-[620px]">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={fieldLabel} htmlFor="show_name">Show</label>
          <input id="show_name" name="show_name" required maxLength={160} className={field}
                 placeholder="Spring Natural Open" />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="federation">Federation</label>
          <select id="federation" name="federation" required defaultValue="" className={field}>
            <option value="" disabled>Pick one</option>
            {FEDERATIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div>
          <label className={fieldLabel} htmlFor="date">Date</label>
          <input id="date" name="date" type="date" required className={field} />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="division">Division</label>
          <input id="division" name="division" required maxLength={60} className={field}
                 placeholder="Men's Physique" />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="class">Class <span className="normal-case text-fine">(optional)</span></label>
          <input id="class" name="class" maxLength={60} className={field} placeholder="Class B, Novice…" />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="placing">Placing</label>
          <select id="placing" name="placing" required defaultValue="" className={field}>
            <option value="" disabled>Pick one</option>
            {PLACINGS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <p className={`mt-2 ${fineprint}`}>
            DNP counts. Stepping on stage is worth 5 points to your chapter whatever the result.
          </p>
        </div>

        <div className="flex items-end pb-3">
          <label className={checkline} htmlFor="won_overall">
            <input id="won_overall" name="won_overall" type="checkbox" className="h-4 w-4 accent-[#2F5FA8]" />
            <span className="text-[0.95rem] text-body">I won the overall</span>
          </label>
        </div>
      </div>

      <CrewPicker clubId={clubId} chapter={chapter} crew={crew} setCrew={setCrew} />

      <button type="submit" disabled={pending} className={`${btnPrimary} mt-8 w-full`}>
        {pending ? 'Saving…' : 'Log this result'}
      </button>

      <p className={`mt-4 text-center ${fineprint}`}>
        Your club lead verifies it before it reaches the rankings. You can share it straight away.
      </p>

      <FormMessage error={state.error} />
    </form>
  );
}

/**
 * Handlers and pit crew.
 *
 * Searchable rather than a long checkbox list: a chapter with sixty members
 * makes a list unusable on a phone, which is exactly where somebody logs a
 * result on the drive home.
 */
function CrewPicker({ clubId, chapter, crew, setCrew }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  if (!clubId) return null;

  async function onChange(value) {
    setQuery(value);
    if (value.trim().length < 2) { setResults([]); return; }
    const { members } = await searchClubMembers(clubId, value);
    setResults(members.filter((m) => !crew.some((c) => c.id === m.id)));
  }

  return (
    <div className="mt-8 rounded-[8px] border border-edge bg-band px-5 py-5">
      <p className="font-display text-[0.95rem] font-bold uppercase tracking-[0.04em] text-ink">
        Who handled for you?
      </p>
      <p className={`mt-2 ${fineprint}`}>
        Nobody preps alone. Everyone you tag earns 2 points for {chapter || 'their chapter'} once
        this result is verified.
      </p>

      {crew.map((m) => <input key={m.id} type="hidden" name="handlers" value={m.id} />)}

      {crew.length > 0 && (
        <ul className="mt-4 flex list-none flex-wrap gap-2">
          {crew.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-full border border-edge bg-surface px-3 py-1.5">
              <span className="text-[0.9rem] text-ink">{m.display_name}</span>
              <button
                type="button"
                aria-label={`Remove ${m.display_name}`}
                onClick={() => setCrew(crew.filter((c) => c.id !== m.id))}
                className={`${buttonReset} text-[0.9rem] text-meta hover:text-danger`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="text" value={query} onChange={(e) => onChange(e.target.value)}
        className={`${field} mt-4`} placeholder="Search your chapter" autoComplete="off"
      />

      {results.length > 0 && (
        <ul className="mt-1 list-none rounded-[8px] border border-edge bg-surface">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => { setCrew([...crew, m]); setQuery(''); setResults([]); }}
                className={`${buttonReset} ${btnSmall} w-full px-4 py-2 text-left text-[0.92rem] text-body hover:bg-band`}
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

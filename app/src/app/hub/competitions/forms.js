'use client';

import { useActionState, useState } from 'react';
import { addCompetition, addResult, confirmResult } from './actions';
import {
  Card, Badge, Meta, field, fieldLabel, checkline, btnPrimary, btnGhost, btnSmall,
  buttonReset, fineprint, FormMessage,
} from '@/app/ui';

/** Put a show on the calendar. Leads and the exec board see this. */
export function AddCompetition({ federations }) {
  const [state, action, pending] = useActionState(addCompetition, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btnGhost} ${btnSmall}`}>
        Add a show
      </button>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <form action={action}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={fieldLabel} htmlFor="name">Show name</label>
            <input id="name" name="name" type="text" required maxLength={160} className={field} />
          </div>

          <div>
            <label className={fieldLabel} htmlFor="starts_on">Date</label>
            <input id="starts_on" name="starts_on" type="date" required className={field} />
          </div>

          <div>
            <label className={fieldLabel} htmlFor="level">Level</label>
            <select id="level" name="level" defaultValue="local" className={field}>
              <option value="local">Local</option>
              <option value="regional">Regional</option>
              <option value="national">National</option>
            </select>
            <p className={`mt-2 ${fineprint}`}>
              This scales the points a placement is worth, so it is worth getting right.
            </p>
          </div>

          <div>
            <label className={fieldLabel} htmlFor="federation_id">Federation</label>
            <select id="federation_id" name="federation_id" defaultValue="" className={field}>
              <option value="">Not sure</option>
              {federations.map((f) => (
                <option key={f.id} value={f.id}>{f.code} · {f.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <div>
              <label className={fieldLabel} htmlFor="city">City</label>
              <input id="city" name="city" type="text" maxLength={80} className={field} />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="state">State</label>
              <input id="state" name="state" type="text" maxLength={2} className={field} />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className={fieldLabel} htmlFor="info_url">Link</label>
            <input
              id="info_url" name="info_url" type="url" className={field}
              placeholder="https://"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSmall}`}>
            {pending ? 'Adding…' : 'Add to calendar'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={`${buttonReset} px-2 text-[0.85rem] text-meta hover:text-ink`}
          >
            Cancel
          </button>
        </div>

        <FormMessage error={state.error} ok={state.ok} />
      </form>
    </Card>
  );
}

/**
 * Enter your own result.
 *
 * No chapter field, on purpose: it is stamped from your membership by the
 * database. Offering it would imply a choice that does not exist.
 */
export function AddResult({ competitionId, competitionName }) {
  const [state, action, pending] = useActionState(addResult, {});
  const [open, setOpen] = useState(false);

  if (state.ok) {
    return <p className={`${fineprint} text-body`}>{state.ok}</p>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btnGhost} ${btnSmall}`}>
        I competed here
      </button>
    );
  }

  return (
    <form action={action} className="mt-4 w-full border-t border-edge pt-4">
      <input type="hidden" name="competition_id" value={competitionId} />

      <p className="mb-3 font-display text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-meta">
        Your result at {competitionName}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className={fieldLabel} htmlFor={`div-${competitionId}`}>Division</label>
          <input
            id={`div-${competitionId}`} name="division" type="text" maxLength={60}
            className={field} placeholder="Men's Physique, Bikini, Classic Physique…"
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor={`pl-${competitionId}`}>Placed</label>
          <input id={`pl-${competitionId}`} name="placement" type="number" min={1} max={99} className={field} />
        </div>
        <div>
          <label className={fieldLabel} htmlFor={`cs-${competitionId}`}>In a class of</label>
          <input id={`cs-${competitionId}`} name="class_size" type="number" min={1} max={200} className={field} />
        </div>
        <div className="flex items-end pb-2">
          <label className={checkline} htmlFor={`ov-${competitionId}`}>
            <input
              id={`ov-${competitionId}`} name="is_overall" type="checkbox"
              className="h-4 w-4 accent-[#2F5FA8]"
            />
            <span className="text-[0.9rem] text-body">Won the overall</span>
          </label>
        </div>
      </div>

      <p className={`mt-3 ${fineprint}`}>
        Leave the numbers blank if you would rather not say. Competing still counts for
        something. Your club lead confirms this before it reaches the rankings.
      </p>

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSmall}`}>
          {pending ? 'Saving…' : 'Add my result'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`${buttonReset} px-2 text-[0.85rem] text-meta hover:text-ink`}
        >
          Cancel
        </button>
      </div>

      <FormMessage error={state.error} />
    </form>
  );
}

/** Confirm somebody else's result. A lead's one job on this screen. */
export function ConfirmResult({ entry }) {
  const [state, action, pending] = useActionState(confirmResult, {});

  if (state.ok) return <Meta>{state.ok}</Meta>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={action}>
        <input type="hidden" name="id" value={entry.id} />
        <input type="hidden" name="status" value="confirmed" />
        <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSmall}`}>
          Confirm
        </button>
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={entry.id} />
        <input type="hidden" name="status" value="disputed" />
        <button type="submit" disabled={pending} className={`${btnGhost} ${btnSmall}`}>
          Query it
        </button>
      </form>
      {state.error && <span className="text-[0.85rem] text-danger">{state.error}</span>}
    </div>
  );
}

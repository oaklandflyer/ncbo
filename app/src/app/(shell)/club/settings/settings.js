'use client';

import { useActionState, useState } from 'react';
import { testGcalConnection, saveGcalSettings } from './actions';
import { GCAL_STEPS, gcalStepsAsText } from '@/lib/gcal';
import {
  Card, Badge, Meta, field, fieldLabel, checkline, btnPrimary, btnGhost, btnSmall,
  buttonReset, fineprint, FormMessage,
} from '@/app/ui';

const ZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
];

export default function CalendarSettings({ club }) {
  const configured = !!club.gcal_id;
  const [test, runTest, testing] = useActionState(testGcalConnection, null);
  const [save, runSave, saving] = useActionState(saveGcalSettings, {});

  const [gcalId, setGcalId] = useState(club.gcal_id || '');
  const [timezone, setTimezone] = useState(club.gcal_timezone || 'America/New_York');
  /* Once a lead edits the zone by hand, a later re-test must not overwrite it.
     Google reports the calendar's own zone, which is often the account's zone
     and not the one the chapter meets in. */
  const [timezoneTouched, setTimezoneTouched] = useState(false);

  const passed = test?.ok === true;
  const effectiveZone = (!timezoneTouched && passed && test.timeZone) ? test.timeZone : timezone;

  return (
    <div className="grid gap-6">
      {/* Unconfigured leads with the instructions; configured collapses them,
          because a lead returning to change a zone does not need the tour. */}
      <Instructions defaultOpen={!configured} />

      <Card className="p-5 sm:p-6">
        <form action={runTest} className="grid gap-4">
          <input type="hidden" name="club_id" value={club.id} />
          <div>
            <label className={fieldLabel} htmlFor="gcal_id">Calendar ID</label>
            <input
              id="gcal_id" name="gcal_id" className={field} value={gcalId}
              onChange={(e) => setGcalId(e.target.value)}
              placeholder="abc123@group.calendar.google.com" autoComplete="off"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={testing || !gcalId.trim()} className={`${btnGhost} ${btnSmall}`}>
              {testing ? 'Testing…' : configured ? 'Re-test connection' : 'Test connection'}
            </button>
            {test && !test.ok && <span className="text-[0.9rem] text-danger">{test.error}</span>}
            {passed && <Badge tone="active">Connected</Badge>}
          </div>

          {passed && (
            <div className="rounded-[6px] border border-edge bg-band px-4 py-3">
              <p className="text-[0.95rem] text-body">
                {test.eventCount === 0
                  ? 'Connected, but there are no upcoming events on it yet.'
                  : `Connected. The next ${test.eventCount === 1 ? 'event is' : `${test.eventCount} events are`}:`}
              </p>
              {test.sampleTitles.length > 0 && (
                <ul className="mt-2 list-none">
                  {test.sampleTitles.map((t) => (
                    <li key={t} className="text-[0.95rem] font-medium text-ink">· {t}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>

        <form action={runSave} className="mt-6 grid gap-4 border-t border-edge pt-6">
          <input type="hidden" name="club_id" value={club.id} />
          <input type="hidden" name="gcal_id" value={gcalId} />

          <div>
            <label className={fieldLabel} htmlFor="gcal_timezone">Timezone</label>
            <select
              id="gcal_timezone" name="gcal_timezone" className={field} value={effectiveZone}
              onChange={(e) => { setTimezone(e.target.value); setTimezoneTouched(true); }}
            >
              {[...new Set([effectiveZone, ...ZONES])].map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <p className={`mt-2 ${fineprint}`}>
              {timezoneTouched
                ? 'Your choice. Re-testing will not change it.'
                : 'Prefilled from the calendar when a test succeeds. Change it if your chapter meets in another zone.'}
            </p>
          </div>

          {configured && (
            <label className={checkline} htmlFor="gcal_published">
              <input
                id="gcal_published" name="gcal_published" type="checkbox"
                defaultChecked={club.gcal_published} className="h-4 w-4 accent-[#2F5FA8]"
              />
              <span className="text-[0.95rem] text-body">Show this calendar to members</span>
            </label>
          )}

          {/* Disabled until a test passes, on a first setup. Saving an id
              nobody has checked is how a chapter ends up with an empty
              calendar page and no idea why. */}
          <button
            type="submit"
            disabled={saving || (!configured && !passed)}
            className={`${btnPrimary} justify-self-start`}
          >
            {saving ? 'Saving…' : configured ? 'Save changes' : 'Save calendar'}
          </button>
          {!configured && !passed && (
            <Meta>Test the connection before saving.</Meta>
          )}

          <FormMessage error={save.error} ok={save.ok} />
        </form>
      </Card>
    </div>
  );
}

/**
 * The setup steps, rendered from `GCAL_STEPS` and copied from the same array.
 *
 * One source, two shapes. The copied version is the one a lead pastes into a
 * group chat and follows on a phone, and it is the one nobody proof-reads, so
 * it cannot be a second hand-maintained copy of this list.
 */
function Instructions({ defaultOpen }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = gcalStepsAsText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* Older iOS and any non-secure context: the clipboard API is absent or
         throws. A hidden textarea and execCommand still work there. */
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); } catch { /* nothing else to try */ }
      document.body.removeChild(area);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <details open={defaultOpen} className="rounded-[8px] border border-edge bg-surface px-5 py-4">
      <summary className="cursor-pointer font-display text-[0.9rem] font-bold uppercase tracking-[0.05em] text-ink">
        How to get your Calendar ID
      </summary>

      <ol className="mt-4 list-none">
        {GCAL_STEPS.map((step, i) => (
          <li key={step.title} className="mb-4 last:mb-0">
            <p className="font-display text-[0.95rem] font-semibold text-ink">
              {i + 1}. {step.title}
            </p>
            <p className="mt-1 text-[0.95rem] text-body">{step.body}</p>
            {step.warning && (
              <p className="mt-2 rounded-[6px] border-l-[3px] border-l-danger bg-band px-3 py-2 text-[0.92rem] text-body">
                {step.warning}
              </p>
            )}
          </li>
        ))}
      </ol>

      <button type="button" onClick={copy} className={`${btnGhost} ${btnSmall} mt-2 sm:hidden`}>
        {copied ? 'Copied' : 'Copy instructions'}
      </button>
      <button type="button" onClick={copy} className={`${buttonReset} mt-2 hidden text-[0.85rem] font-semibold text-brand underline underline-offset-2 sm:inline`}>
        {copied ? 'Copied' : 'Copy instructions'}
      </button>
    </details>
  );
}

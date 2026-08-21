'use client';

import { useActionState, useEffect, useRef } from 'react';
import { addResource } from './actions';
import { Eyebrow, field, fieldLabel, btnPrimary, FormMessage, fineprint } from '@/app/ui';

const TYPES = [
  ['article', 'Article / guide'],
  ['youtube', 'YouTube video'],
  ['webinar', 'Webinar recording'],
  ['pdf', 'PDF'],
  ['spreadsheet', 'Spreadsheet'],
];

/** Moderator-only. The database refuses this from anybody else regardless. */
export default function AddResource({ categories }) {
  const [state, action, pending] = useActionState(addResource, {});
  const formRef = useRef(null);

  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);

  return (
    <form ref={formRef} action={action} className="rounded-[8px] border border-edge bg-surface p-6 sm:p-8">
      <Eyebrow>Curate</Eyebrow>
      <h2 className="mt-3 font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold uppercase leading-none text-ink">
        Add a resource.
      </h2>
      <p className="mt-3 max-w-[560px] text-[0.98rem] text-body">
        A link to something already hosted elsewhere, like an unlisted YouTube video, a Drive
        PDF, a guide on the site. Nothing is uploaded here.
      </p>

      <div className="mt-6 grid gap-5">
        <div>
          <label className={fieldLabel} htmlFor="r-title">Title</label>
          <input id="r-title" name="title" required maxLength={160} className={field}
                 placeholder="Posing Fundamentals: Mandatories" />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="r-url">Link</label>
          <input id="r-url" name="external_url" type="url" required className={field}
                 placeholder="https://www.youtube.com/watch?v=…"
                 autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          <p className={`mt-2 ${fineprint}`}>
            Must start with https://. Unlisted links work — members see the link, not the
            file.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={fieldLabel} htmlFor="r-type">Type</label>
            <select id="r-type" name="type" defaultValue="article" className={`${field} py-3`}>
              {TYPES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={fieldLabel} htmlFor="r-category">Category</label>
            <input id="r-category" name="category" className={field} list="resource-categories"
                   placeholder="Posing" defaultValue="" />
            <datalist id="resource-categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        <div>
          <label className={fieldLabel} htmlFor="r-description">Description</label>
          <textarea id="r-description" name="description" rows={2} maxLength={500}
                    className={`${field} resize-y`}
                    placeholder="One line on what it covers." />
        </div>
      </div>

      <FormMessage error={state?.error} ok={state?.ok && 'Added to the vault.'} />

      <button className={`${btnPrimary} mt-6`} type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add resource'}
      </button>
    </form>
  );
}

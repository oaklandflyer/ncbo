'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { saveProfile } from '../actions';
import { field, fieldLabel, btnPrimary, btnGhost, fineprint, FormMessage } from '@/app/ui';

/**
 * The parts of a profile a member owns. Everything else on the profile page
 * is read-only for a reason, so this form only carries what the database will
 * actually accept from them.
 */
export default function EditProfileForm({ profile, divisions }) {
  const [state, action, pending] = useActionState(saveProfile, {});

  return (
    <form action={action} className="max-w-[560px]">
      <div>
        <label className={fieldLabel} htmlFor="home_region">Hometown region</label>
        <input
          id="home_region" name="home_region" className={field}
          defaultValue={profile.home_region || ''}
          placeholder="Greater Pittsburgh, PA"
          maxLength={80}
        />
        <p className={`mt-2 ${fineprint}`}>
          An area, not an address — close enough to find someone to train with, and no
          closer.
        </p>
      </div>

      <div className="mt-6">
        <label className={fieldLabel} htmlFor="division">Division</label>
        <input
          id="division" name="division" className={field} list="division-options"
          defaultValue={profile.division || ''}
          placeholder="Men’s Physique"
          maxLength={60}
        />
        <datalist id="division-options">
          {divisions.map((d) => <option key={d} value={d} />)}
        </datalist>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <label className={fieldLabel} htmlFor="instagram_handle">Instagram</label>
          <input
            id="instagram_handle" name="instagram_handle" className={field}
            defaultValue={profile.instagram_handle || ''}
            placeholder="yourhandle"
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="tiktok_handle">TikTok</label>
          <input
            id="tiktok_handle" name="tiktok_handle" className={field}
            defaultValue={profile.tiktok_handle || ''}
            placeholder="yourhandle"
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
          />
        </div>
      </div>

      <p className={`mt-3 ${fineprint}`}>
        Handle only — paste a full link or an @ and we’ll take the name out of it.
      </p>

      <FormMessage error={state?.error} ok={state?.ok && 'Saved.'} />

      <div className="mt-7 flex flex-wrap gap-3">
        <button className={btnPrimary} type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <Link className={btnGhost} href="/hub/profile">Done</Link>
      </div>
    </form>
  );
}

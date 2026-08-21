'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import ClubLogo from '@/app/brand/club-logo';
import { uploadClubLogo, removeClubLogo } from './logo-actions';
import {
  Card, Meta, fieldLabel, btnPrimary, btnGhost, btnSmall, fineprint, FormMessage,
} from '@/app/ui';

/**
 * The thin client half of the logo form.
 *
 * Thin on purpose: it holds a preview and two `useActionState` pairs, and
 * every decision about who may do this lives in the action. It exists at all
 * because a file input needs a preview to be usable, and a preview needs
 * state.
 *
 * Errors come back in the action's return value, not in the URL. A failed
 * upload is not a page anybody should be able to bookmark, link to, or land
 * back on by pressing back.
 */
export default function ClubLogoForm({ club }) {
  const [upload, runUpload, uploading] = useActionState(uploadClubLogo, {});
  const [removal, runRemove, removing] = useActionState(removeClubLogo, {});
  const [preview, setPreview] = useState(null);
  const [chosen, setChosen] = useState('');
  const formRef = useRef(null);

  /* Object URLs are revoked as soon as they are replaced. A lead trying four
     files in a row would otherwise leak four blobs for the life of the tab. */
  function onPick(e) {
    const file = e.target.files?.[0];
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return file ? URL.createObjectURL(file) : null;
    });
    setChosen(file?.name || '');
  }

  /* Once the upload has landed, the page's own `club.logo_url` is the truth
     and the local preview is a stale copy of it. Clearing both is also what
     disables the button, so a lead cannot send the same file twice by
     pressing Save again. */
  useEffect(() => {
    if (!upload?.ok) return;
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return null; });
    setChosen('');
    formRef.current?.reset();
  }, [upload]);

  /* The preview wins while one is showing, so a lead sees what they picked
     rather than what is still saved. */
  const shown = preview ? { logo_url: preview, chapter: club.name } : club;

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-[1.1rem] font-bold uppercase tracking-[0.04em] text-ink">
        Chapter logo
      </h2>
      <Meta className="mt-2">
        Shown on the rankings and on the cards members share after a show. Chapters
        without one show their initials, which is a perfectly good look.
      </Meta>

      <form ref={formRef} action={runUpload}>
        <input type="hidden" name="club_id" value={club.id} />

        <div className="mt-5 flex items-center gap-5">
          <ClubLogo club={shown} size="lg" />
          <div className="min-w-0 flex-1">
            <label className={fieldLabel} htmlFor="logo">
              {club.logo_url ? 'Replace it' : 'Upload one'}
            </label>
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={onPick}
              className="block w-full text-[0.88rem] text-body file:mr-3 file:cursor-pointer file:rounded-[6px] file:border-0 file:bg-brand-wash file:px-3 file:py-2 file:font-display file:text-[0.78rem] file:font-bold file:uppercase file:tracking-[0.1em] file:text-brand"
            />
            <p className={`mt-2 ${fineprint}`}>
              PNG, JPEG, GIF or WebP, up to 2 MB. Square works best. Whatever you send is
              fitted to 512px and saved as a transparent PNG.
            </p>
          </div>
        </div>

        <button type="submit" disabled={uploading || !chosen} className={`${btnPrimary} mt-5`}>
          {uploading ? 'Uploading…' : 'Save logo'}
        </button>
      </form>

      {club.logo_url && (
        <form action={runRemove} className="mt-3">
          <input type="hidden" name="club_id" value={club.id} />
          <button type="submit" disabled={removing} className={`${btnGhost} ${btnSmall}`}>
            {removing ? 'Removing…' : 'Remove logo'}
          </button>
        </form>
      )}

      <FormMessage error={upload?.error || removal?.error} ok={upload?.ok || removal?.ok} />
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Eyebrow, btnPrimary, btnSmall, fieldLabel, fineprint, FormMessage } from '@/app/ui';

/**
 * The brand-asset CMS: upload a logo or hero image without a deploy.
 *
 * The upload goes straight from the browser to Supabase Storage rather than
 * through a server action — a route handler would mean the image crossing the
 * network twice and sitting in a Vercel function's memory on the way. Storage
 * RLS is what authorises it: `brand_assets_write` requires `is_moderator()`,
 * so a member who called this directly would be refused by the bucket.
 *
 * Only the *path* is written to `site_settings`. The bucket is public, so the
 * app builds a public URL from the path at render time.
 */
const ASSETS = [
  ['logo_path', 'Logo', 'Shown in the header and on the sign-in screen. A square PNG or WebP reads best.'],
  ['hero_path', 'Hero image', 'The photo behind page headers.'],
];

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export default function Branding({ settings, publicBase }) {
  const [state, setState] = useState({});
  const [busy, setBusy] = useState('');

  async function upload(column, file) {
    if (!file) return;

    /* Checked here for the message, and again by the bucket's own limits.
       An 8MB logo is somebody's phone photo, not a logo. */
    if (!TYPES.includes(file.type)) {
      setState({ error: 'Use a PNG, JPEG, WebP or SVG.' });
      return;
    }
    if (file.size > MAX_BYTES) {
      setState({ error: 'That file is over 2MB. Export it smaller, since this loads on every page.' });
      return;
    }

    setBusy(column);
    setState({});

    const supabase = createClient();
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    /* Timestamped rather than overwritten, so a cached CDN copy of the old
       logo can never be served in place of the new one. */
    const path = `${column === 'logo_path' ? 'logo' : 'hero'}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase
      .storage.from('brand_assets')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      setBusy('');
      setState({ error: uploadError.message.includes('row-level security')
        || uploadError.message.toLowerCase().includes('unauthorized')
        ? 'Only advisors and the exec team can change brand assets.'
        : `Upload failed: ${uploadError.message}` });
      return;
    }

    const { error: saveError } = await supabase
      .from('site_settings')
      .update({ [column]: path, updated_at: new Date().toISOString() })
      .eq('id', true);

    setBusy('');
    if (saveError) {
      setState({ error: 'The image uploaded but the setting didn’t save. Try again.' });
      return;
    }
    setState({ ok: 'Saved. Reload to see it everywhere.' });
  }

  return (
    <div className="rounded-[8px] border border-edge bg-surface p-6 sm:p-8">
      <Eyebrow>Site settings</Eyebrow>
      <h2 className="mt-3 font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold uppercase leading-none text-ink">
        Brand assets.
      </h2>
      <p className="mt-3 max-w-[560px] text-[0.98rem] text-body">
        Replace the logo or hero image without touching the code. Changes apply everywhere
        the image is used, for everyone, straight away.
      </p>

      <div className="mt-7 grid gap-6 sm:grid-cols-2">
        {ASSETS.map(([column, label, help]) => {
          const current = settings?.[column];
          return (
            <div key={column}>
              <span className={fieldLabel}>{label}</span>

              <div className="mb-3 flex h-24 items-center justify-center overflow-hidden rounded-[8px] border border-edge bg-band">
                {current ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${publicBase}/${current}`}
                    alt={`Current ${label.toLowerCase()}`}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className={fineprint}>Using the built-in {label.toLowerCase()}</span>
                )}
              </div>

              <label className={`${btnPrimary} ${btnSmall} cursor-pointer`}>
                {busy === column ? 'Uploading…' : `Upload ${label.toLowerCase()}`}
                <input
                  type="file"
                  accept={TYPES.join(',')}
                  className="sr-only"
                  disabled={!!busy}
                  onChange={(e) => upload(column, e.target.files?.[0])}
                />
              </label>

              <p className={`mt-2 ${fineprint}`}>{help}</p>
            </div>
          );
        })}
      </div>

      <FormMessage error={state.error} ok={state.ok} />
    </div>
  );
}

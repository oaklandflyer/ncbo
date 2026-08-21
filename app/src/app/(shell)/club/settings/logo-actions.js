'use server';

import sharp from 'sharp';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { sniffImage } from '@/lib/imageSniff';

const BUCKET = 'club-logos';

/** 2 MB. Checked before a single byte is read into memory. */
const MAX_BYTES = 2 * 1024 * 1024;

/** The square every logo is normalised to, and the one Satori is handed. */
const EDGE = 512;

/**
 * Replace a chapter's logo.
 *
 * Every check here is a refusal, in an order chosen so that the cheap ones
 * come first and nothing expensive runs for a request that was never going to
 * be allowed:
 *
 *   1. is there a session at all
 *   2. does this person lead this chapter, re-read from the database. The
 *      hidden `club_id` field says which chapter; it never says whether the
 *      poster may touch it. Anyone can post a form.
 *   3. is there a file
 *   4. is it under the limit, checked against `file.size` before `arrayBuffer`
 *      so a 900 MB upload is refused rather than buffered and then refused
 *   5. is it actually an image, by its own first bytes
 *   6. can sharp make sense of it
 *
 * The storage policies in migration 0025 enforce (2) again independently. This
 * is the part that can say why; that is the part that cannot be talked out of
 * it.
 */
export async function uploadClubLogo(prev, formData) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.signedIn || !viewer.profile) return { error: 'You are signed out.' };

  const clubId = String(formData.get('club_id') || '');
  if (!clubId) return { error: 'No chapter was named.' };
  if (!viewer.canManageClub(clubId)) return { error: 'You do not lead that chapter.' };

  const file = formData.get('logo');
  if (!file || typeof file.arrayBuffer !== 'function' || file.size === 0) {
    return { error: 'Choose an image first.' };
  }
  if (file.size > MAX_BYTES) {
    return { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 2 MB.` };
  }

  const input = Buffer.from(await file.arrayBuffer());
  if (!sniffImage(input)) {
    return { error: 'That does not look like an image. PNG, JPEG, GIF or WebP.' };
  }

  /* Normalised to a transparent 512px PNG regardless of what came in.
     `fit: 'contain'` rather than 'cover': a wordmark cropped to a square is a
     ruined wordmark, and every surface that draws this reserves a square box
     anyway. `withoutEnlargement` so a 64px favicon somebody uploaded stays
     crisp instead of being blown up into mush.

     PNG rather than WebP, which would be smaller: Satori renders the share
     card, and its WebP support is not something to find out about from a
     broken card in somebody's Instagram story. */
  let output;
  try {
    output = await sharp(input)
      .resize(EDGE, EDGE, {
        fit: 'contain',
        withoutEnlargement: true,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    return { error: 'That image could not be read. Try exporting it again as a PNG.' };
  }

  /* A new path every time. The storage CDN caches by path, so re-uploading to
     a fixed `logo.png` would keep serving the old mark to everybody who had
     already seen it, for as long as the edge held it. */
  const path = `clubs/${clubId}/logo-${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, output, { contentType: 'image/png', upsert: false });

  if (uploadError) {
    console.error('[ncbo] club logo upload failed', { clubId, message: uploadError.message });
    return { error: 'The upload was refused. Try again in a moment.' };
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) return { error: 'The upload saved but produced no URL. Try again.' };

  /* Read the old path before overwriting the row, so the object can be tidied
     up afterwards. */
  const { data: before } = await supabase
    .from('clubs').select('logo_url').eq('id', clubId).maybeSingle();

  const { error: writeError } = await supabase
    .from('clubs')
    .update({ logo_url: publicUrl, logo_updated_at: new Date().toISOString() })
    .eq('id', clubId);

  if (writeError) {
    /* The object is up and the row does not point at it. Remove the orphan
       rather than leaving a file nothing will ever reference. */
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    return { error: writeError.message };
  }

  await removeOldObject(supabase, before?.logo_url, path);
  revalidateLogoSurfaces();
  return { ok: 'Logo updated.' };
}

/** Clear the mark and go back to the monogram. */
export async function removeClubLogo(prev, formData) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.signedIn || !viewer.profile) return { error: 'You are signed out.' };

  const clubId = String(formData.get('club_id') || '');
  if (!clubId) return { error: 'No chapter was named.' };
  if (!viewer.canManageClub(clubId)) return { error: 'You do not lead that chapter.' };

  const { data: before } = await supabase
    .from('clubs').select('logo_url').eq('id', clubId).maybeSingle();

  const { error } = await supabase
    .from('clubs').update({ logo_url: null, logo_updated_at: null }).eq('id', clubId);
  if (error) return { error: error.message };

  await removeOldObject(supabase, before?.logo_url, null);
  revalidateLogoSurfaces();
  return { ok: 'Logo removed. Your chapter shows its initials again.' };
}

/**
 * Delete the object a previous `logo_url` pointed at, best effort.
 *
 * Best effort is the whole design: the row is already correct by the time this
 * runs, so a failure here leaves an unreferenced file in a bucket and nothing
 * else. Turning that into an error the lead sees would report a successful
 * upload as a failure.
 */
async function removeOldObject(supabase, previousUrl, keepPath) {
  if (!previousUrl) return;
  const marker = `/${BUCKET}/`;
  const at = previousUrl.indexOf(marker);
  if (at === -1) return;
  const oldPath = previousUrl.slice(at + marker.length);
  if (!oldPath || oldPath === keepPath) return;
  try {
    await supabase.storage.from(BUCKET).remove([oldPath]);
  } catch (err) {
    console.error('[ncbo] old club logo not removed', { oldPath, message: err?.message });
  }
}

/* The settings page shows the form; the two leaderboards draw the mark. The
   share card is not listed: it is rendered at the edge and keyed on
   `logo_updated_at`, which this write has just changed. */
function revalidateLogoSurfaces() {
  revalidatePath('/club/settings');
  revalidatePath('/rankings/clubs');
  revalidatePath('/rankings/athletes');
}

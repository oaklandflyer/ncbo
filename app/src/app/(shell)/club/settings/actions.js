'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { probeCalendar } from '@/lib/gcal';

/**
 * Test before save.
 *
 * The failure modes here are all silent: a private calendar and a mistyped id
 * both produce an empty feed, and neither says so until a member opens the
 * page weeks later and finds nothing. So the lead gets to see the next three
 * events before they commit anything.
 */
export async function testGcalConnection(prev, formData) {
  const viewer = await getViewerContext();
  if (!viewer.profile) return { ok: false, error: 'You are signed out.', eventCount: 0, sampleTitles: [], timeZone: null };

  const clubId = String(formData.get('club_id') || '');
  if (!viewer.canManageClub(clubId)) {
    return { ok: false, error: 'You do not lead that chapter.', eventCount: 0, sampleTitles: [], timeZone: null };
  }

  return probeCalendar(String(formData.get('gcal_id') || ''));
}

export async function saveGcalSettings(prev, formData) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.profile) return { error: 'You are signed out.' };

  const clubId = String(formData.get('club_id') || '');
  if (!viewer.canManageClub(clubId)) return { error: 'You do not lead that chapter.' };

  const gcalId = String(formData.get('gcal_id') || '').trim();
  const timezone = String(formData.get('gcal_timezone') || '').trim() || 'America/New_York';
  const published = formData.get('gcal_published') === 'on';

  if (!gcalId) return { error: 'Paste the Calendar ID first.' };

  const { error } = await supabase
    .from('clubs')
    .update({ gcal_id: gcalId, gcal_timezone: timezone, gcal_published: published })
    .eq('id', clubId);

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { ok: published ? 'Saved and published to your chapter.' : 'Saved. Not published yet.' };
}

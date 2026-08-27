'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';

/**
 * The chapter's named leads — the list behind "Led by X, Y, Z" in the Network
 * directory.
 *
 * Authority is decided in Postgres, inside the SECURITY DEFINER functions from
 * migration 0041: `remove_club_lead_entry` checks the club the *entry* belongs
 * to, and `clean_orphaned_club_leads` is admin-only. The checks in this file
 * exist so a refusal is a sentence in the UI rather than a Postgres error, and
 * so an obviously wrong call never reaches the database.
 */

/** Everything the Network directory reads about leads, after a write. */
function revalidateLeadSurfaces() {
  revalidatePath('/club/settings');
  revalidatePath('/hub/network');
  revalidatePath('/admin/clubs');
}

/**
 * Postgres writes these messages for a club lead to read — "You cannot remove
 * your own entry. Transfer the chapter first" is more use than anything this
 * layer could reconstruct from an error code. PostgREST prefixes them, so the
 * prefix is what gets stripped.
 */
function readableRpcError(error, fallback) {
  const raw = String(error?.message || '');
  if (!raw) return fallback;
  if (error?.code === 'P0001' || raw.includes('insufficient_privilege')) {
    return raw.replace(/^.*?:\s*/, '') || fallback;
  }
  return fallback;
}

/**
 * Delete one named lead.
 *
 * Removal is the only verb a lead gets here, and that asymmetry is deliberate:
 * adding a lead goes through `set_club_lead()`, which requires a real active
 * member of the chapter. A free-text "add a lead" field is what produced the
 * eleven unlinked names this screen exists to clear up, so it is not offered.
 */
export async function removeClubLeadEntry(entryId) {
  const id = String(entryId || '');
  if (!id) return { error: 'No entry given.' };

  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.userId) return { error: 'You are signed out.' };
  if (!viewer.isClubLead && !viewer.isAdmin) {
    return { error: 'Only a club lead or an admin can change this.' };
  }

  const { error } = await supabase.rpc('remove_club_lead_entry', { entry_id: id });
  if (error) return { error: readableRpcError(error, 'That didn’t save.') };

  revalidateLeadSurfaces();
  return { ok: true };
}

/**
 * Delete every orphaned lead row at one chapter.
 *
 * Admin only, and the database says so independently. What it deletes is the
 * exact complement of what `club_directory` publishes — the same predicate,
 * written once in the migration — so this can never remove a lead who is
 * currently on screen.
 *
 * Returns the count rather than a bare ok, because "Removed 4 entries" and
 * "Nothing to remove" are different answers and a screen that says "Done" for
 * both teaches people to distrust it.
 */
export async function cleanOrphanedLeads(clubId) {
  const id = String(clubId || '');
  if (!id) return { error: 'No chapter given.' };

  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.userId) return { error: 'You are signed out.' };
  if (!viewer.isAdmin) return { error: 'Only an admin can clear orphaned entries.' };

  const { data, error } = await supabase.rpc('clean_orphaned_club_leads', { target_club: id });
  if (error) return { error: readableRpcError(error, 'That didn’t run.') };

  revalidateLeadSurfaces();
  return { ok: true, removed: Number(data) || 0 };
}

'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hardDeleteAvailable } from '@/lib/supabase/admin';
import { describeError, isForeignKeyViolation } from '@/lib/errorDetail';

/**
 * Destroy an account permanently.
 *
 * This is the only irreversible operation in the app and the only thing that
 * touches the service-role key. The order below is not arbitrary: each step
 * exists because of what happens if the step after it fails.
 *
 *   1. authorise the caller, from the database, not from the form
 *   2. require the target's email typed back exactly
 *   3. refuse anybody not already soft-removed
 *   4. count what is about to be destroyed
 *   5. WRITE THE AUDIT ROW
 *   6. purge the storage objects only this person owned
 *   7. delete the auth user, which cascades
 *
 * The audit row is written **before** the deletion, deliberately. If step 7
 * fails, an audit row exists for a deletion that did not complete, and an
 * admin can see that and investigate. If the order were reversed and the
 * write failed, the account would be gone with no record of who removed it,
 * which is the failure this whole table exists to prevent. A slightly
 * over-eager log beats a silently missing one.
 */

const ACTION = 'hard_delete_user';

export async function hardDeleteUser(prev, formData) {
  /* Everything is wrapped, because an uncaught throw in a Server Action does
     not reach `useActionState`: React returns a generic error and the panel
     shows nothing at all. That is how an irreversible operation came to
     "not work" with no explanation anywhere. Any surprise is reported here
     with enough detail to act on. */
  try {
    return await runHardDelete(formData);
  } catch (err) {
    console.error('[ncbo] hard delete threw', {
      message: err?.message, code: err?.code, stack: err?.stack,
    });
    return { error: `Permanent deletion failed: ${describeError(err)}` };
  }
}

async function runHardDelete(formData) {
  const targetId = String(formData.get('target_id') || '');
  const confirmation = String(formData.get('confirm_email') || '').trim();

  if (!hardDeleteAvailable()) {
    return {
      error: 'SUPABASE_SERVICE_ROLE_KEY is not set on this deployment, so permanent '
        + 'deletion cannot run. Add it in the Vercel project settings for both Preview '
        + 'and Production, then redeploy. Nothing was changed.',
    };
  }
  if (!targetId) return { error: 'No account was named.' };

  const supabase = await createClient();

  /* `getUser()`, never `getSession()`. getSession returns whatever is in the
     cookie without verifying it against the auth server, so a forged or stale
     cookie passes. getUser makes the round trip. For an irreversible action
     that difference is the whole authorisation. */
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'You are signed out.' };

  /* Read the caller's role from the database rather than from a viewer object
     assembled earlier in the request, and never from the form. */
  /* No `email` in this projection, and that is not an oversight.
     `profiles.email` is on the SELECT deny list (`restrict_columns` in
     migration 0015), so asking for it through the caller's own session fails
     the WHOLE statement with `42501 permission denied for table profiles` —
     not a null column, a dead query. That is what made permanent deletion
     refuse for every admin who tried it.

     The address is not lost: `getUser()` already returned it from
     `auth.users`, which is where it actually lives and which needs no
     privilege on `profiles` at all. */
  const { data: caller, error: callerError } = await supabase
    .from('profiles').select('id, role, display_name').eq('id', user.id).maybeSingle();

  if (callerError) return { error: `Could not read your own profile: ${describeError(callerError)}` };
  if (!caller) return { error: 'Your profile could not be found.' };
  /* Says which role, because "Forbidden" on a screen only admins can open is
     a message that tells the reader nothing about what went wrong. */
  if (caller.role !== 'admin') {
    return { error: `Only a global admin can delete permanently. Your role is ${caller.role}.` };
  }
  if (caller.id === targetId) {
    return { error: 'You cannot permanently delete your own account from here.' };
  }

  /* The service client is created only after authorisation passes, so a
     refused request never holds it. */
  const admin = createAdminClient();

  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('id, display_name, email, status, role')
    .eq('id', targetId)
    .maybeSingle();

  if (targetError) return { error: `Could not read that account: ${describeError(targetError)}` };
  if (!target) return { error: 'That account no longer exists.' };

  /* Already soft-removed only. Permanent deletion is the second step of a
     two-step process, never the first: somebody has to have decided to remove
     this person, and then decided again. */
  if (target.status !== 'removed') {
    return { error: 'Remove the account first. Permanent deletion is only for accounts already in the REMOVED state.' };
  }

  /* Typed back exactly, case-insensitively but otherwise literally. This is
     the last thing standing between a mis-click and an irreversible act. */
  if (!target.email || confirmation.toLowerCase() !== String(target.email).toLowerCase()) {
    return { error: 'The email did not match. Type the account email exactly to confirm.' };
  }

  /* Counted before, because they cannot be counted after: this is the only
     record of the size of what was destroyed. */
  const detail = await countBelongings(admin, targetId);

  const { error: logError } = await admin.from('admin_audit_log').insert({
    actor_user_id: caller.id,
    actor_email: user.email || null,
    actor_display: caller.display_name,
    target_user_id: targetId,
    target_email: target.email,
    target_display: target.display_name,
    action: ACTION,
    detail,
  });

  /* A deletion with no audit row does not happen. This is the one failure here
     that stops the whole operation. */
  if (logError) {
    console.error('[ncbo] audit write failed, deletion aborted', { targetId, error: logError });
    return {
      error: `The audit log could not be written, so nothing was deleted: ${describeError(logError)}`,
    };
  }

  await purgeStorage(admin, targetId);

  /* No `shouldSoftDelete` argument. Supabase's soft delete leaves the auth row
     in place, which is exactly what this operation is not. */
  const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
  if (deleteError) {
    console.error('[ncbo] hard delete failed after audit write', { targetId, error: deleteError });
    /* 23503 is a foreign key violation, and it is the one failure here that a
       code change fixes rather than a retry. Naming it saves the next person
       the hour it costs to work out that "Database error deleting user" means
       a table somewhere still points at this row. */
    const fk = isForeignKeyViolation(deleteError);
    return {
      error: fk
        ? `A table still references this account, so the database refused the delete: ${describeError(deleteError)}. `
          + 'This needs a migration, not a retry. The attempt is in the audit log.'
        : `The account was not deleted: ${describeError(deleteError)}. The attempt is in the audit log.`,
    };
  }

  revalidatePath('/hub/admin/users');
  revalidatePath('/hub/network');
  revalidatePath('/rankings/clubs');

  return { ok: `${target.display_name || target.email} was permanently deleted.`, detail };
}

/**
 * What is about to go, and what is about to survive.
 *
 * Both halves are recorded. "12 answers kept under their name" is the part an
 * admin needs when somebody later asks why a deleted member's post is still
 * on the board.
 */
async function countBelongings(admin, targetId) {
  const count = async (table, column) => {
    const { count: n } = await admin
      .from(table).select('*', { count: 'exact', head: true }).eq(column, targetId);
    return n ?? 0;
  };

  const [memberships, votes, questionVotes, orgRoles, posts, answers, questions, entries, handlers] =
    await Promise.all([
      count('club_memberships', 'user_id'),
      count('answer_votes', 'user_id'),
      count('question_votes', 'user_id'),
      count('org_roles', 'user_id'),
      count('posts', 'author_id'),
      count('answers', 'author_id'),
      count('questions', 'author_id'),
      count('competition_entries', 'profile_id'),
      count('competition_handlers', 'handler_profile_id'),
    ]);

  return {
    destroyed: { memberships, answer_votes: votes, question_votes: questionVotes, org_roles: orgRoles, posts },
    kept_anonymised: { answers, questions, competition_entries: entries, handler_credits: handlers },
  };
}

/**
 * Remove the storage objects this person alone owned.
 *
 * Exactly one thing qualifies: the student ID photo they uploaded to prove
 * they were enrolled. It is theirs, it is identifying, and its row is about to
 * cascade away and orphan the file.
 *
 * **Club logos are deliberately not touched**, and the brief's mention of them
 * is a trap worth naming: a logo belongs to the chapter, not to whichever lead
 * happened to upload it. Purging it because that lead left their club would
 * blank the mark on every leaderboard and every share card the chapter has.
 * There is no avatar bucket at all, so there is nothing there to purge either.
 *
 * Best effort, after the audit row and before the delete. A file that will not
 * delete must not block the removal of the account: the person asked to be
 * gone, and an orphaned object in a private bucket is a smaller harm than
 * refusing them.
 */
async function purgeStorage(admin, targetId) {
  try {
    const { data: rows } = await admin
      .from('club_memberships')
      .select('student_id_photo_path')
      .eq('user_id', targetId)
      .not('student_id_photo_path', 'is', null);

    const paths = (rows || []).map((r) => r.student_id_photo_path).filter(Boolean);
    if (!paths.length) return;

    const { error } = await admin.storage.from('student-ids').remove(paths);
    if (error) {
      console.error('[ncbo] storage purge incomplete', { targetId, message: error.message });
    }
  } catch (err) {
    console.error('[ncbo] storage purge threw', { targetId, message: err?.message });
  }
}

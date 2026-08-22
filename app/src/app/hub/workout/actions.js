'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sanitiseWorkoutData, isoOrNull } from '@/lib/workout';

/**
 * Store a finished workout.
 *
 * The payload comes from the browser, so none of it is trusted:
 *
 *  · `profile_id` is never read from the payload. It comes from `getUser()`,
 *    which is the only source that cannot be forged. The RLS policy checks it
 *    again, and that check is the actual guarantee.
 *  · `workout_data` is rebuilt field by field rather than validated in place.
 *    The database's only structural check is that it is an array, which
 *    `[{"anything": "at all"}]` satisfies.
 *  · the timestamps are parsed and clamped. A start time from the future or
 *    an end before the start is a clock that disagrees, not a workout.
 *
 * Inserted directly as `completed`, never as `in_progress`. The live session
 * lives in the browser until it is finished, which is the whole point of the
 * phase 1 design: a set typed on gym wifi should not need a round trip.
 */
export async function saveWorkoutSession(payload) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'You are signed out. Sign in again to save this.' };

  const workoutData = sanitiseWorkoutData(payload?.workout_data);
  if (workoutData.length === 0) {
    return { error: 'Nothing to save: tick at least one set first.' };
  }

  const now = Date.now();
  /* A start time in the future means a device clock that is wrong; storing it
     would produce a workout that appears not to have happened yet. */
  const startedRaw = new Date(isoOrNull(payload?.start_time) || now).getTime();
  const startTime = new Date(Math.min(startedRaw, now)).toISOString();
  const endTime = new Date(now).toISOString();

  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({
      profile_id: user.id,
      start_time: startTime,
      end_time: endTime,
      status: 'completed',
      workout_data: workoutData,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ncbo] workout save failed', {
      userId: user.id, code: error.code, message: error.message, details: error.details,
    });
    return { error: `That did not save: ${error.message}` };
  }

  revalidatePath('/hub/workout');
  return { ok: true, id: data.id, sets: workoutData.reduce((n, ex) => n + ex.sets.length, 0) };
}

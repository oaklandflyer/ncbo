'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { CLASS_YEARS, EXPERIENCE, GRAD_YEARS, CHAT_PLATFORMS, FOUND_VIA } from './options';
import { EXPERIENCE_PHASES } from '@/lib/membership';

/**
 * Save the onboarding form, and apply to a chapter if there is one.
 *
 * Two writes, and they are deliberately not one:
 *
 *   `profiles`  — who this person is. Written with their own session, so the
 *                 update policy (`id = auth.uid()`) is what permits it; this
 *                 action cannot reach another row even if the form said so.
 *
 *   `club_memberships` — an application to one chapter, arriving `pending`.
 *                 The insert trigger forces the status, the role and the
 *                 verification columns whatever this action sends, so a
 *                 hand-rolled request cannot arrive pre-approved.
 *
 * A university with no chapter produces no membership at all. That is a valid
 * finished state, not an error: the person gets an account and the open
 * surfaces, and their interest is recorded so the organisation knows where to
 * expand.
 */
export async function saveOnboarding(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out. Sign in again to finish.' };

  const text = (key, max) => String(formData.get(key) || '').trim().slice(0, max);

  const fullName = text('full_name', 120);
  const preferredName = text('preferred_name', 60);
  const displayName = preferredName || fullName.split(/\s+/)[0];
  const classYear = text('class_year', 40);
  const experience = text('lifting_experience', 40);
  const major = text('major', 120);
  const universityId = text('university_id', 64);
  const gradYear = text('grad_year', 8);
  const chatPlatform = text('group_chat_platform', 40);
  const chatHandle = text('group_chat_handle', 120);
  const foundVia = text('found_via', 120);
  const referredBy = text('referred_by_user_id', 64);
  const phase = text('experience_phase', 40);
  const isAdult = formData.get('is_adult') === 'on';

  if (!fullName) return { error: 'We need your name.', focus: 'full_name' };
  if (!universityId) return { error: 'Pick your university from the list.', focus: 'university-search' };
  if (!gradYear || !GRAD_YEARS.includes(gradYear)) {
    return { error: 'Pick the year you expect to graduate.', focus: 'grad_year' };
  }
  if (!classYear) return { error: 'Pick your year.', focus: 'class_year' };
  if (!CLASS_YEARS.includes(classYear)) return { error: 'Pick a year from the list.', focus: 'class_year' };
  if (!experience) return { error: 'Pick how long you have been training.', focus: 'lifting_experience' };
  if (!EXPERIENCE.includes(experience)) return { error: 'Pick an option from the list.', focus: 'lifting_experience' };
  if (!major) return { error: 'Tell us what you study.', focus: 'major' };
  if (phase && !EXPERIENCE_PHASES.some((p) => p.value === phase)) {
    return { error: 'Pick one of the three from the list.', focus: 'experience_phase' };
  }
  if (chatPlatform && !CHAT_PLATFORMS.includes(chatPlatform)) {
    return { error: 'Pick a group chat from the list.', focus: 'group_chat_platform' };
  }
  if (foundVia && !FOUND_VIA.includes(foundVia)) {
    return { error: 'Pick an option from the list.', focus: 'found_via' };
  }

  // Deliberately last and deliberately blocking: no account finishes
  // onboarding without the member ticking this themselves.
  if (!isAdult) {
    return { error: 'You have to confirm you are 18 or over to join.', focus: 'is_adult' };
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      display_name: displayName,
      class_year: classYear,
      lifting_experience: experience,
      major,
      experience_phase: phase || null,
      is_adult: true,
    })
    .eq('id', user.id);

  if (profileError) return { error: profileError.message };

  /* The university resolves to its one club here, on the server, from the id
     the picker submitted. The client is never told a club id and never sends
     one, which is what makes "a user cannot select a club directly" true
     rather than merely unoffered.

     Three outcomes, named rather than inferred from a boolean. `pipeline` used
     to fall in with `none` because a forming club carries `active = false`,
     so somebody at a school with a chapter on the way was told there wasn't
     one. See migration 0028. */
  const { data: chapter } = await supabase
    .from('university_picker')
    .select('club_id, chapter_state')
    .eq('id', universityId)
    .maybeSingle();

  const state = chapter?.chapter_state || 'none';

  if (state === 'active' && chapter.club_id) {
    const { error: applyError } = await supabase
      .from('club_memberships')
      .upsert({
        user_id: user.id,
        club_id: chapter.club_id,
        legal_name: fullName,
        preferred_name: preferredName || null,
        grad_year: Number(gradYear),
        group_chat_platform: chatPlatform || null,
        group_chat_handle: chatHandle || null,
        found_via: foundVia || null,
        referred_by_user_id: referredBy || null,
      }, { onConflict: 'user_id,club_id' });

    /* A failed application is not a failed signup. The profile is saved, the
       account works, and the person can apply again from their profile, which
       is far better than sending them back to a form they have already filled
       in correctly. */
    if (applyError) {
      revalidatePath('/hub', 'layout');
      return { error: 'Your profile is saved, but the application to your chapter did not go through. Try again from your profile.' };
    }
  } else {
    /* Pipeline and none both land here, and both leave `club_id` null: a
       membership row nobody can approve is a row that sits pending forever,
       and a pending row is how a person concludes the app is broken.

       They are recorded in the same table because the question it answers is
       the same one either way, and `university_picker.chapter_state` can tell
       them apart at any time without a second column to keep in sync. */
    await supabase.from('signup_interest').upsert({
      user_id: user.id,
      university_id: universityId,
      grad_year: Number(gradYear),
    }, { onConflict: 'user_id,university_id' });
  }

  revalidatePath('/hub', 'layout');
  redirect('/hub');
}

/**
 * Verified members of one chapter, for the "referred by" search.
 *
 * Scoped to the club being applied to: a referral from somebody at another
 * school tells the lead nothing, and offering the whole network would turn a
 * useful field into a list of two thousand strangers.
 */
export async function searchChapterMembers(clubId, query) {
  if (!clubId || !query || query.trim().length < 2) return { members: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('member_directory')
    .select('id, display_name, club_id, member_verified')
    .eq('club_id', clubId)
    .eq('member_verified', true)
    .ilike('display_name', `%${query.trim()}%`)
    .order('display_name')
    .limit(8);

  if (error) return { members: [] };
  return { members: data || [] };
}

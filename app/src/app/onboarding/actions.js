'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { CLASS_YEARS, EXPERIENCE } from './options';

/**
 * Save the onboarding form.
 *
 * The row is written with the member's own session, so the `profiles` update
 * policy (`id = auth.uid()`) is what permits it — this action cannot write to
 * anyone else's row even if the form said otherwise. `id` is taken from the
 * session and never from the request.
 *
 * The 18+ attestation is checked here and enforced again by the database
 * trigger, which refuses to let one account set it on another's behalf.
 */
export async function saveOnboarding(prev, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You are signed out. Sign in again to finish.' };

  const text = (key, max) => String(formData.get(key) || '').trim().slice(0, max);

  const fullName = text('full_name', 120);
  const displayName = text('display_name', 60) || fullName.split(/\s+/)[0];
  const classYear = text('class_year', 40);
  const experience = text('lifting_experience', 40);
  const major = text('major', 120);
  const isAdult = formData.get('is_adult') === 'on';

  const fields = { full_name: fullName, class_year: classYear, lifting_experience: experience, major };

  if (!fullName) return { error: 'We need your name.', focus: 'full_name' };
  if (!classYear) return { error: 'Pick your year.', focus: 'class_year' };
  if (!CLASS_YEARS.includes(classYear)) return { error: 'Pick a year from the list.', focus: 'class_year' };
  if (!experience) return { error: 'Pick how long you have been training.', focus: 'lifting_experience' };
  if (!EXPERIENCE.includes(experience)) return { error: 'Pick an option from the list.', focus: 'lifting_experience' };
  if (!major) return { error: 'Tell us what you study.', focus: 'major' };

  // Deliberately last and deliberately blocking: no account finishes
  // onboarding without the member ticking this themselves.
  if (!isAdult) {
    return { error: 'You have to confirm you are 18 or over to join.', focus: 'is_adult' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ...fields, display_name: displayName, is_adult: true })
    .eq('id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/hub', 'layout');
  redirect('/hub');
}

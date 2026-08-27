import { redirect } from 'next/navigation';
import { createClient, getProfileResult } from '@/lib/supabase/server';
import { isOnboarded, missingFields } from '@/lib/onboarding';
import { AuthPage, AuthHeading } from '@/app/ui';
import OnboardingForm from './form';
import SchemaError from '@/app/hub/schema-error';
import AuthUnavailable from '@/app/hub/auth-unavailable';
import { getHomeRegions } from '@/lib/homeRegions';

export const metadata = {
  title: 'Finish your profile · NCBO',
  robots: { index: false, follow: false },
};

/**
 * Collected once, before the hub opens — and before an admin is asked to
 * review anyone, so the queue shows a person rather than an email address.
 *
 * Deliberately outside /hub: the hub layout sends unfinished accounts here,
 * and a page inside it would be a redirect loop.
 */
export default async function Onboarding() {
  const supabase = await createClient();
  const { signedIn, profile, error, authUnavailable } = await getProfileResult(supabase);

  /* Outside /hub, so there is no layout to explain this one. Same three-way
     split as the hub: signed out is a redirect, an unreadable profile is a
     message, and only a missing row sends somebody back to sign in. */
  if (authUnavailable) return <AuthUnavailable />;
  if (!signedIn) redirect('/login');
  if (error) return <SchemaError error={error} />;
  if (!profile) redirect('/login');
  // A decided account has nothing to fill in: /hub shows it the decision.
  if (profile.status === 'rejected' || profile.status === 'suspended') redirect('/hub');
  // Nothing left to collect. Don't make anyone fill in a form twice.
  if (isOnboarded(profile)) redirect('/hub');

  /* Somebody who has filled this in before and is back here did not choose to
     be. Something they gave is missing, and until this said which, the loop
     was silent: the shell sent them here, the form re-rendered empty, and it
     looked like the app had thrown their answers away.

     `full_name` is the tell. It is the first required field and nothing else
     writes it, so a profile that has one has been through this form. */
  const returning = Boolean(String(profile.full_name || '').trim());
  const missing = returning ? missingFields(profile) : [];

  /* Every active school, with its one club or nulls. Fetched here rather than
     searched from the client per keystroke: it is a few hundred rows, it
     changes about once a semester, and a round trip per character on a phone
     on campus wifi is the difference between a picker and a wait. */
  /* Alongside it, the hometown regions already on file, for the same reason:
     a list of what exists beats a blank box, and here it is what stops
     "Pittsburgh, PA" and "pitt" becoming two regions in the directory.
     `get_home_regions()` is SECURITY DEFINER because this page runs before
     approval — see migration 0039. */
  const [{ data: universities }, homeRegions] = await Promise.all([
    supabase
      .from('university_picker')
      .select('id, name, short_name, state, club_id, club_name, has_chapter, chapter_state')
      .order('name'),
    getHomeRegions(supabase),
  ]);

  return (
    <AuthPage wide>
      <AuthHeading eyebrow="One last thing">Tell us<br />who you are.</AuthHeading>

      <p className="mx-auto mt-6 max-w-[520px] text-center text-[1.02rem] leading-relaxed text-body">
        Your email got you in the door. This is what your club lead sees when they
        check you against their roster. It takes a minute, and you only do it once.
      </p>

      <div className="mt-9">
        <OnboardingForm
        profile={profile}
        returning={returning}
        missing={missing}
          email={profile.email}
          defaultName={profile.full_name}
          universities={universities || []}
          homeRegions={homeRegions}
        />
      </div>
    </AuthPage>
  );
}

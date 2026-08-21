import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { isOnboarded } from '@/lib/onboarding';
import { AuthPage, AuthHeading } from '@/app/ui';
import OnboardingForm from './form';

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
  const profile = await getProfile(supabase);

  if (!profile) redirect('/login');
  // A decided account has nothing to fill in: /hub shows it the decision.
  if (profile.status === 'rejected' || profile.status === 'suspended') redirect('/hub');
  // Nothing left to collect. Don't make anyone fill in a form twice.
  if (isOnboarded(profile)) redirect('/hub');

  /* Every active school, with its one club or nulls. Fetched here rather than
     searched from the client per keystroke: it is a few hundred rows, it
     changes about once a semester, and a round trip per character on a phone
     on campus wifi is the difference between a picker and a wait. */
  const { data: universities } = await supabase
    .from('university_picker')
    .select('id, name, short_name, state, club_id, club_name, has_chapter')
    .order('name');

  return (
    <AuthPage wide>
      <AuthHeading eyebrow="One last thing">Tell us<br />who you are.</AuthHeading>

      <p className="mx-auto mt-6 max-w-[520px] text-center text-[1.02rem] leading-relaxed text-body">
        Your email got you in the door. This is what your club lead sees when they
        check you against their roster. It takes a minute, and you only do it once.
      </p>

      <div className="mt-9">
        <OnboardingForm
          email={profile.email}
          defaultName={profile.full_name}
          universities={universities || []}
        />
      </div>
    </AuthPage>
  );
}

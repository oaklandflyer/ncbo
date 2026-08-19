import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { isOnboarded } from '@/lib/onboarding';
import { AuthPage, AuthHeading } from '@/app/ui';
import OnboardingForm from './form';

export const metadata = {
  title: 'Finish your profile — NCBO',
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
  // Nothing left to collect — don't make anyone fill in a form twice.
  if (isOnboarded(profile)) redirect('/hub');

  return (
    <AuthPage wide>
      <AuthHeading eyebrow="One last thing">Tell us<br />who you are.</AuthHeading>

      <p className="mx-auto mt-6 max-w-[520px] text-center text-[1.02rem] leading-relaxed text-body">
        Your email got you in the door. This is what your club and the NCBO exec team
        actually see — it takes a minute and you only do it once.
      </p>

      <div className="mt-9">
        <OnboardingForm email={profile.email} defaultName={profile.full_name} />
      </div>
    </AuthPage>
  );
}

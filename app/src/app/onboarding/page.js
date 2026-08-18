import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { isOnboarded } from '@/lib/onboarding';
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
  // Nothing left to collect — don't make anyone fill in a form twice.
  if (isOnboarded(profile)) redirect('/hub');

  return (
    <main className="login-page">
      <div className="login-card">
        <p className="eyebrow" style={{ justifyContent: 'center' }}>One last thing</p>
        <h1>Tell us<br />who you are.</h1>
        <p className="lead" style={{ marginTop: '1rem', fontSize: '0.98rem' }}>
          Your email got you in the door. This is what your club and the NCBO exec
          team actually see — it takes a minute and you only do it once.
        </p>
        <div style={{ marginTop: '1.6rem', textAlign: 'left' }}>
          <OnboardingForm email={profile.email} defaultName={profile.full_name} />
        </div>
      </div>
    </main>
  );
}

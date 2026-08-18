import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { isOnboarded } from '@/lib/onboarding';
import { canReview, canManageRoles } from '@/lib/review';
import SignOut from './sign-out';
import AccountStatus from './status';

export default async function HubLayout({ children }) {
  const supabase = await createClient();
  const profile = await getProfile(supabase);

  // The middleware already redirects anonymous visitors; this covers the case
  // where a user exists but their profile row doesn't (a failed signup).
  if (!profile) redirect('/login');

  // A decision has already been made about these two, so there is nothing
  // left to collect — sending a declined applicant through an onboarding form
  // would be asking for work we have no intention of reading.
  if (profile.status === 'rejected' || profile.status === 'suspended') {
    return <AccountStatus status={profile.status} profile={profile} />;
  }

  // Onboarding comes before the waiting screen: an admin reviewing the queue
  // should see a person with a name and a school year, not an email address.
  // Checked here rather than in the middleware so it costs one query per page
  // render, not one per asset request.
  if (!isOnboarded(profile)) redirect('/onboarding');

  // Anything still not approved is waiting on a person. RLS would hand it
  // empty pages anyway; this explains why.
  if (profile.status !== 'approved') {
    return <AccountStatus status="pending" profile={profile} />;
  }

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <Link className="brand" href="/hub">NCBO</Link>
          <span className={`rolechip ${profile.role}`}>{profile.role.replace('_', ' ')}</span>
          <nav className="appnav">
            <Link href="/hub">Home</Link>
            <Link href="/hub/topics">Topics</Link>
            <Link href="/hub/qa">Q&amp;A</Link>
            {canReview(profile) && (
              <Link href="/hub/admin">{canManageRoles(profile) ? 'Admin' : 'Review'}</Link>
            )}
            <SignOut />
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}

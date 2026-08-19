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
      {/* Sticky so the nav is reachable from the bottom of a long board, and
          horizontally scrollable rather than wrapping into two rows on a
          narrow phone. Nothing above this line was touched: the guards decide
          who gets here, this only draws the chrome. */}
      <header className="sticky top-0 z-30 border-b border-line bg-navy/95 backdrop-blur supports-[backdrop-filter]:bg-navy/80">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-3 sm:px-8">
          <Link
            href="/hub"
            className="font-display text-lg font-extrabold uppercase tracking-[0.2em] text-ink transition hover:text-steel-light"
          >
            NCBO
          </Link>
          <span className="hidden shrink-0 rounded-full border border-steel-deep/50 bg-steel-deep/20 px-2.5 py-0.5 font-display text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-steel-light sm:inline-flex">
            {profile.role.replace('_', ' ')}
          </span>

          {/* The links scroll on a narrow phone; sign-out sits outside the
              scroller so it never ends up off the right edge. */}
          <nav
            aria-label="Member hub"
            className="ml-auto flex min-w-0 items-center gap-0.5 overflow-x-auto font-display text-[0.76rem] font-semibold uppercase tracking-[0.1em] [scrollbar-width:none] sm:gap-1 sm:text-[0.78rem] sm:tracking-[0.14em] [&::-webkit-scrollbar]:hidden"
          >
            {[
              ['/hub', 'Home'],
              ['/hub/topics', 'Topics'],
              ['/hub/qa', 'Q&A'],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="whitespace-nowrap rounded-md px-2 py-1.5 text-silver-dim transition hover:bg-navy-2 hover:text-ink sm:px-2.5"
              >
                {label}
              </Link>
            ))}
            {canReview(profile) && (
              <Link
                href="/hub/admin"
                className="whitespace-nowrap rounded-md px-2 py-1.5 text-steel transition hover:bg-navy-2 hover:text-steel-light sm:px-2.5"
              >
                {canManageRoles(profile) ? 'Admin' : 'Review'}
              </Link>
            )}
          </nav>
          <SignOut />
        </div>
      </header>
      {children}
    </>
  );
}

import Link from 'next/link';
import HubNav from './nav';
import TabBar from './tabbar';
import InstallPrompt from './install';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { isOnboarded } from '@/lib/onboarding';
import { canReview } from '@/lib/review';
import { getViewerContext } from '@/lib/viewer';
import { getBranding } from '@/lib/branding';
import SignOut from './sign-out';
import AccountStatus from './status';

export default async function HubLayout({ children }) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  const profile = viewer.profile;

  // The middleware already redirects anonymous visitors; this covers the case
  // where a user exists but their profile row doesn't (a failed signup).
  if (!profile) redirect('/login');

  // A decision has already been made about these two, so there is nothing
  // left to collect — sending a declined applicant through an onboarding form
  // would be asking for work we have no intention of reading.
  if (['rejected', 'suspended', 'removed'].includes(profile.status)) {
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

  /* The pending count, for the badge on the Profile tab. Issued only for the
     two roles that can act on it — for everyone else the query would be a
     round trip per page render returning an RLS-empty result. A failure here
     is not worth a broken hub: the badge just doesn't appear. */
  let pendingQuestions = 0;
  if (viewer.canModerateContent) {
    const { count, error } = await supabase
      .from('question_feed')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    pendingQuestions = error ? 0 : (count || 0);
  }

  const brand = await getBranding(supabase);

  return (
    /* The light ground, the grain, and the 72px nav offset are all the public
       site's — see assets/styles.css. Scoped to the hub shell rather than the
       body so the sign-in and onboarding routes, which this pass doesn't
       cover, keep rendering from the old stylesheet untouched. */
    <div className="relative min-h-screen bg-page font-body text-[17px] leading-relaxed text-ink antialiased">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.018]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <HubNav
        canReview={canReview(profile)}
        manages={viewer.isAdmin}
        isClubLead={viewer.isClubLead}
        /* Falls back to the school of a club they lead: a lead whose own
           `school_id` is null still has one through the club. */
        school={profile.schools?.name || viewer.ledClubs?.[0]?.name || null}
        role={profile.role}
        name={profile.display_name}
        logo={brand.logo}
      />

      {/* Bottom padding on a phone so the last card clears the tab bar rather
          than hiding under it; the bar adds the safe-area inset on top. */}
      <div className="relative z-[2] pb-24 pt-[60px] md:pb-0 md:pt-nav">{children}</div>

      <TabBar pendingCount={pendingQuestions} isClubLead={viewer.isClubLead} />

      <InstallPrompt />
    </div>
  );
}

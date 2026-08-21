import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { isOnboarded } from '@/lib/onboarding';
import { navModel, sumBadges, mobileTabs } from '@/lib/nav/navModel';
import { resolveClubScope } from '@/lib/scope';
import AccountStatus from '@/app/hub/status';
import SchemaError from '@/app/hub/schema-error';
import Sidebar from './sidebar';
import TabBar from './tab-bar';
import ScopeSwitcher from './scope-switcher';

/**
 * The one shell every signed-in route renders inside.
 *
 * It exists so the gate and the navigation have a single implementation. Two
 * layouts each doing their own version of "is this person allowed in" is how
 * the top bar and the tab bar came to disagree about who could see the review
 * queue, and it is why `navModel` is a pure function called from exactly here.
 */
export default async function AppShell({ children, searchParams }) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  const profile = viewer.profile;

  /* Three situations that must not collapse into one redirect: signed out is a
     redirect, an unreadable profile explains itself, and only a genuinely
     missing row sends somebody back to sign in. */
  if (!viewer.signedIn) redirect('/login');
  if (viewer.profileError) return <SchemaError error={viewer.profileError} />;
  if (!profile) redirect('/login');

  if (['rejected', 'suspended', 'removed'].includes(profile.status)) {
    return <AccountStatus status={profile.status} profile={profile} />;
  }
  if (!isOnboarded(profile)) redirect('/onboarding');
  if (profile.status !== 'approved') {
    return <AccountStatus status="pending" profile={profile} />;
  }

  /* One round trip for every badge in the navigation. A failure here costs the
     badges, never the page: a nav that renders without a count is a nav; a
     layout that throws is the whole app. */
  let counts = {};
  const { data: navCounts, error: countsError } = await supabase.rpc('get_viewer_nav_counts');
  if (countsError) {
    console.error('[ncbo] nav counts failed', { code: countsError.code, message: countsError.message });
  } else if (navCounts?.length) {
    counts = {
      pendingEntries: navCounts[0].pending_entries,
      pendingQuestions: navCounts[0].pending_questions,
      allPendingQuestions: navCounts[0].all_pending_questions,
    };
  }

  const nav = navModel(viewer, counts);
  const aggregate = sumBadges(nav);
  const tabs = mobileTabs(nav);

  /* The switcher is admin-only, and the club list is only fetched for the
     people who can act on it. */
  let switcher = null;
  if (viewer.isAdmin) {
    const params = await searchParams;
    const scope = resolveClubScope(viewer, params?.club);
    const { data: clubs } = await supabase
      .from('club_directory').select('id, club_name, short_name').order('short_name');
    switcher = <ScopeSwitcher clubs={clubs || []} clubId={scope.clubId} />;
  }

  return (
    <div className="relative min-h-screen bg-page font-body text-[17px] leading-relaxed text-ink antialiased">
      <Sidebar nav={nav} scopeSwitcher={switcher} />

      <div className="pb-24 pt-[60px] lg:pb-0 lg:pl-[248px]">{children}</div>

      <TabBar tabs={tabs} nav={nav} aggregate={aggregate} scopeSwitcher={switcher} />
    </div>
  );
}

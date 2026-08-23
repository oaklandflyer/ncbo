import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { isOnboarded } from '@/lib/onboarding';
import { navModel, sumBadges, mobileTabs } from '@/lib/nav/navModel';
import { resolveClubScope } from '@/lib/scope';
import AccountStatus from '@/app/hub/status';
import SchemaError from '@/app/hub/schema-error';
import Sidebar from './sidebar';
import { ProfilePopupProvider } from '@/app/hub/profile-popup/popup';
import TopBar from './top-bar';
import TabBar from './tab-bar';
import InstallPrompt from '@/app/hub/install';
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
      pendingApplications: navCounts[0].pending_applications,
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


  /*
   * The popup provider wraps every signed-in route, and it has to be here
   * rather than on the pages that use it.
   *
   * `UserChip` is rendered by the directory, the roster, both leaderboards,
   * the Q&A board, the admin table and the hub itself. Mounting the provider
   * per page means seven places to remember; mounting it once means none. It
   * was mounted in none of them, so every one of those chips was a button
   * that did nothing when tapped.
   *
   * A Server Component rendering a Client Component around `children` costs
   * nothing: the children stay server-rendered and only the provider crosses
   * the boundary.
   */
  return (
    <ProfilePopupProvider>
    <div className="relative min-h-screen bg-page font-body text-[17px] leading-relaxed text-ink antialiased">
      <TopBar
        institution={viewer.membership?.shortName || null}
        name={profile.display_name || profile.full_name}
      />

      <Sidebar nav={nav} scopeSwitcher={switcher} />

      <div className="pb-24 pt-[60px] lg:pb-0 lg:pl-[248px]">{children}</div>

      <TabBar tabs={tabs} nav={nav} aggregate={aggregate} scopeSwitcher={switcher} />

      {/* Mounted here because this is the one shell, and it was mounted in
          `hub/layout.js` until that file was gutted in the nav rebuild — the
          component survived, the render did not, and nothing has offered the
          app since. Android hid the regression: Chrome promotes installation
          on its own, so only Safari users noticed, and on Safari this banner
          is the only mechanism that exists. */}
      <InstallPrompt />
    </div>
    </ProfilePopupProvider>
  );
}

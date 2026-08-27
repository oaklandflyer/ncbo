import { redirect } from 'next/navigation';
import { createClient, getProfileResult } from '@/lib/supabase/server';
import { Page, PageHero, Section, Empty } from '@/app/ui';
import Directory from './directory';

/**
 * The network tab: who else is in NCBO, grouped by club, by region, or listed
 * as people.
 *
 * Reads `member_directory` rather than `profiles` — a narrow projection that
 * carries no email, no onboarding answers and no coordinates, so the browser
 * cannot ask for more than the directory is meant to show.
 */
export default async function Network() {
  const supabase = await createClient();
  const { signedIn, profile } = await getProfileResult(supabase);
  /* Layout and page render in parallel, so this page runs even when the layout
     is about to show the schema error. Redirecting here would win that race and
     send a signed-in member back to /login, which is the loop this whole change
     exists to remove. Render nothing and let the layout explain. */
  if (!signedIn) redirect('/login');
  if (!profile) return null;

  /* The roster comes from `clubs`, not from whoever has signed up. Before
     this, a club with no members simply did not exist in the app — the "By
     Club" list was built by grouping members, so seven of the nine official
     clubs would have been invisible. Headcount is now a property of a club,
     including zero. */
  const { data: clubs } = await supabase
    .from('club_directory')
    .select('id, club_name, status, school_name, state, member_count, leads')
    .order('club_name');

  /* Season points, the one stat on a person's card. `national_rankings` is
     public — it is the leaderboard everybody already sees.

     There used to be a second read here, of `my_workout_totals`, for a
     "Lifetime lb" figure. It has gone with the rest of raw volume tracking:
     the Chapter Cup is what NCBO ranks members on, and a tonnage number beside
     it invited a comparison between two people that only one of them could
     even see — the totals view returns the viewer's own row and nobody
     else's, so every other card on the page was missing it by construction. */
  const season = new Date().getFullYear();
  const { data: seasonPoints } = await supabase
    .from('national_rankings').select('user_id, points, rank').eq('season', season);

  const cupPoints = Object.fromEntries(
    (seasonPoints || []).map((r) => [r.user_id, Math.round(Number(r.points) || 0)]),
  );

  const { data: members } = await supabase
    .from('member_directory')
    .select('id, display_name, role, division, home_region, verified, credentials, club_name, school_name, school_state, instagram_handle, tiktok_handle, is_alumni, alumni_since, is_alumni_effective, grad_year, academic_level')
    .order('display_name')
    .limit(500);

  return (
    <Page>
      <PageHero
        eyebrow="The network"
        title="Who’s out there."
        lead="Every approved member, by club, by region, or by name. Coaches NCBO has vetted carry a seal."
      />

      <Section>
        {members?.length || clubs?.length ? (
          <Directory
            members={members}
            clubs={clubs || []}
            cupPoints={cupPoints}
          />
        ) : (
          <Empty>
            The directory is empty. If that’s a surprise, the schema migration hasn’t been
            applied to this database yet.
          </Empty>
        )}
      </Section>
    </Page>
  );
}

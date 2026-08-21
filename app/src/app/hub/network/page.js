import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
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
  const profile = await getProfile(supabase);
  if (!profile) redirect('/login');

  /* The roster comes from `clubs`, not from whoever has signed up. Before
     this, a club with no members simply did not exist in the app — the "By
     Club" list was built by grouping members, so seven of the nine official
     clubs would have been invisible. Headcount is now a property of a club,
     including zero. */
  const { data: clubs } = await supabase
    .from('club_directory')
    .select('id, club_name, status, school_name, state, member_count, leads')
    .order('club_name');

  const { data: members } = await supabase
    .from('member_directory')
    .select('id, display_name, role, division, home_region, verified, credentials, club_name, school_name, school_state, instagram_handle, tiktok_handle, is_alumni, alumni_since')
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
          <Directory members={members} clubs={clubs || []} />
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

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

  const { data: members } = await supabase
    .from('member_directory')
    .select('id, display_name, role, division, home_region, verified, credentials, club_name, school_name, school_state, instagram_handle, tiktok_handle')
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
        {members?.length ? (
          <Directory members={members} />
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

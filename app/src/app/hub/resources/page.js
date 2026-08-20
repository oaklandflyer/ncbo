import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { Page, PageHero, Section, SectionTitle } from '@/app/ui';
import Vault from './vault';
import AddResource from './add';

/**
 * The resource vault: guides, videos and webinars NCBO has vetted.
 *
 * Every row is a link to somebody else's host — there is no file storage
 * here, on purpose. That is what lets the shelf grow without the database
 * growing with it.
 */
export default async function Resources() {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  if (!profile) redirect('/login');

  const { data: resources } = await supabase
    .from('resources')
    .select('id, title, description, category, type, external_url, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const canCurate = profile.role === 'advisor' || profile.role === 'admin';
  const categories = [...new Set((resources || []).map((r) => r.category).filter(Boolean))].sort();

  return (
    <Page>
      <PageHero
        eyebrow="The vault"
        title="Guides & webinars."
        lead="What the network has already worked out, kept in one place so nobody has to ask twice."
      />

      <Section>
        <SectionTitle count={resources?.length ? `${resources.length}` : null}>
          Resources
        </SectionTitle>
        <Vault resources={resources || []} />
      </Section>

      {canCurate && (
        <Section band>
          <AddResource categories={categories} />
        </Section>
      )}
    </Page>
  );
}

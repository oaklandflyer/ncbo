import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { Page, PageHero, Section, SectionTitle, BackLink } from '@/app/ui';
import EditProfileForm from './form';

/** The divisions members have already entered, offered as suggestions. */
const FALLBACK_DIVISIONS = [
  'Men’s Open', 'Men’s Physique', 'Classic Physique', 'Bikini', 'Wellness', 'Figure',
];

export default async function EditProfile() {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  if (!profile) redirect('/login');

  const { data: rows } = await supabase
    .from('member_directory').select('division').not('division', 'is', null).limit(200);

  const divisions = [...new Set([...(rows || []).map((r) => r.division), ...FALLBACK_DIVISIONS])];

  return (
    <Page>
      <PageHero eyebrow="Your profile" title="Edit your details.">
        <div className="mt-6">
          <BackLink href="/hub/profile" Component={Link}>Back to your profile</BackLink>
        </div>
      </PageHero>

      <Section>
        <SectionTitle>What other members see</SectionTitle>
        <EditProfileForm profile={profile} divisions={divisions} />
      </Section>
    </Page>
  );
}

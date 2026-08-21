import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfileResult } from '@/lib/supabase/server';
import { Page, PageHero, Section, SectionTitle, BackLink } from '@/app/ui';
import EditProfileForm from './form';

/** The divisions members have already entered, offered as suggestions. */
const FALLBACK_DIVISIONS = [
  'Men’s Open', 'Men’s Physique', 'Classic Physique', 'Bikini', 'Wellness', 'Figure',
];

export default async function EditProfile() {
  const supabase = await createClient();
  /* Layout and page render in parallel, so this page runs even when the layout
     is about to show the schema error. Redirecting here would win that race and
     send a signed-in member back to /login, which is the loop this whole change
     exists to remove. Render nothing and let the layout explain. */
  const { signedIn, profile } = await getProfileResult(supabase);
  if (!signedIn) redirect('/login');
  if (!profile) return null;

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

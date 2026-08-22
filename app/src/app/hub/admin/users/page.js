import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { Page, PageHero, Section, SectionTitle, Empty, BackLink, fineprint } from '@/app/ui';
import UserTable from './user-table';
import { hardDeleteAvailable } from '@/lib/supabase/admin';

/**
 * Every account, with the addresses.
 *
 * Read through `get_admin_members()`, a SECURITY DEFINER function that checks
 * `is_admin()` itself — `profiles.email` has its SELECT privilege revoked from
 * `authenticated`, so this is the only path to an address, and a non-admin
 * calling the function directly gets an exception rather than a filtered list.
 */
export default async function AdminUsers() {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);

  /* Layout and page render in parallel, so this page runs even when the layout
     is about to show the schema error. Redirecting here would win that race and
     send a signed-in member back to /login, which is the loop this whole change
     exists to remove. Render nothing and let the layout explain. */
  if (!viewer?.signedIn) redirect('/login');
  if (!viewer.profile) return null;
  if (!viewer.canManageUsers) redirect('/hub');

  const [{ data: users, error }, { data: clubs }, { data: schools }] = await Promise.all([
    supabase.rpc('get_admin_members'),
    supabase.from('club_directory').select('id, club_name').order('club_name'),
    supabase.from('schools').select('id, name').order('name'),
  ]);

  return (
    <Page>
      <PageHero
        eyebrow="Admin"
        title="Members."
        lead="Every account on the platform, including removed ones. Editing a role or closing an account is an admin action. Advisors moderate content, not membership."
      >
        <div className="mt-6">
          <BackLink href="/hub/admin" Component={Link}>Back to admin</BackLink>
        </div>
      </PageHero>

      <Section>
        <SectionTitle count={users?.length ? `${users.length}` : null}>All members</SectionTitle>

        {error ? (
          <Empty>The member list wouldn’t load: {error.message}</Empty>
        ) : users?.length ? (
          <UserTable
            users={users}
            clubs={clubs || []}
            schools={schools || []}
            viewerId={viewer.userId}
            canHardDelete={viewer.isAdmin}
            hardDeleteConfigured={hardDeleteAvailable()}
          />
        ) : (
          <Empty>No accounts yet.</Empty>
        )}

        <p className={`mt-6 ${fineprint}`}>
          Removing an account does not delete it: the row stays so posts keep their author,
          and you can restore it from this page. Removing never touches the sign-in system.
        </p>
        <p className={`mt-3 ${fineprint}`}>
          Permanent deletion is a separate, irreversible act, available to admins only and
          only on an account already removed. It destroys the sign-in, the membership and
          every vote; it keeps competition results, questions and answers under the name
          they were written with, so chapters keep the points their members earned and
          nobody else&rsquo;s thread loses its context.
        </p>
      </Section>
    </Page>
  );
}

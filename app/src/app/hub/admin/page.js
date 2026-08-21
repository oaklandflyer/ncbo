import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { Page, PageHero, Section, SectionTitle, Empty, Card, Meta, Badge, AlumniBadge, btnGhost, btnSmall } from '@/app/ui';
import { publicBase } from '@/lib/branding';
import MemberRow from './member-row';
import PendingRow from './pending-row';
import EditMember from './edit-member';
import Branding from './branding';

export default async function Admin() {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  const profile = viewer.profile;
  if (!profile) redirect('/login');

  /* Admins run the organisation; club leads work their school's applications.
     Scope comes from the clubs they lead, not from their own `school_id` —
     which is exactly the value that was null and locked leads out. */
  const manages = viewer.isAdmin;
  const scope = viewer.isAdmin
    ? { kind: 'global' }
    : viewer.isClubLead
      ? { kind: 'school', schoolIds: viewer.ledSchoolIds }
      : { kind: 'none' };

  if (scope.kind === 'none') redirect('/hub');

  // A club lead's queue is their own school. The `.eq` is what shapes the
  // page; the policy is what makes it true — a lead who removed the filter by
  // hand would still be refused by Postgres on the decision itself.
  let pendingQuery = supabase.from('profiles')
    .select('id, display_name, schools(name), created_at')
    .eq('status', 'pending')
    .order('created_at');
  if (scope.kind === 'school') pendingQuery = pendingQuery.in('school_id', scope.schoolIds);

  const [{ data: members }, { data: clubs }, { data: waiting }, { data: settings }] = await Promise.all([
    manages
      ? supabase.from('profiles')
          .select('id, display_name, role, club_id, division, home_region, is_alumni, alumni_since, instagram_handle, tiktok_handle, schools(name)')
          .eq('status', 'approved')
          .is('deleted_at', null)
          .order('display_name')
      : Promise.resolve({ data: null }),
    manages
      ? supabase.from('clubs').select('id, name, schools(name)').order('name')
      : Promise.resolve({ data: null }),
    pendingQuery,
    manages
      ? supabase.from('site_settings').select('logo_path, hero_path').eq('id', true).single()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <Page>
      <PageHero
        eyebrow={manages ? 'Admin' : 'Club lead'}
        title={manages ? 'Members & roles.' : 'Your school’s queue.'}
        lead={
          manages
            ? 'Club leads review their own school. Advisors and admins answer questions on the Q&A board. Admins can do everything, including this page.'
            : 'People waiting to join at your school. Approving someone lets them into the board; declining tells them the answer. Roles and clubs are set by an NCBO admin.'
        }
      />

      <Section>
        <SectionTitle count={waiting?.length ? `${waiting.length} waiting` : null}>
          Waiting for approval
        </SectionTitle>

        {waiting?.length ? (
          <>
            <p className="mb-6 max-w-[620px] text-[0.98rem] text-body">
              School emails at clubs we already run are approved automatically — these are the
              ones that need a person: advisors, exec, and students at schools not yet in NCBO.
            </p>
            <div className="overflow-hidden rounded-[8px] border border-edge bg-surface">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-edge bg-band/60">
                    {['Name', 'School', 'Decision'].map((h) => (
                      <th key={h} className="px-6 py-3 font-display text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-meta">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {waiting.map((m) => <PendingRow key={m.id} member={m} />)}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty>
            Nobody is waiting{scope.kind === 'school' ? ' at your school' : ''} right now.
          </Empty>
        )}
      </Section>

      {viewer.isClubLead && (
        <Section band>
          <SectionTitle
            action={
              <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/hub/roster">
                Open roster
              </Link>
            }
          >
            Your roster
          </SectionTitle>
          <p className="max-w-[620px] text-[0.98rem] text-body">
            Your club’s members, their email addresses, and the controls to keep the roster
            current — on its own page, so it has room for them.
          </p>
        </Section>
      )}

      {manages && (
        <Section band>
          <SectionTitle count={members?.length || null}>Approved members</SectionTitle>
          <div className="mb-6 max-w-[620px] text-[0.98rem] text-body">
            Email addresses aren’t shown here — they live in the auth system, not the member
            directory, so they can’t leak through the app. Look one up in the Supabase
            dashboard if you need it.
          </div>
          <div className="overflow-hidden rounded-[8px] border border-edge bg-surface">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-edge bg-band/60">
                  {['Member', 'School', 'Role & club', ''].map((h, i) => (
                    <th key={h || i} className="px-6 py-3 font-display text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-meta">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(members || []).map((m) => (
                  <MemberRow key={m.id} member={m} clubs={clubs || []} />
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {manages && (
        <Section>
          <SectionTitle
            action={
              <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/hub/admin/users">
                Open member admin
              </Link>
            }
          >
            Members &amp; accounts
          </SectionTitle>
          <p className="max-w-[620px] text-[0.98rem] text-body">
            Search every account, edit any profile, and close or restore an account — with
            email addresses, which live behind an admin-only reader.
          </p>
        </Section>
      )}

      {manages && (
        <Section>
          <SectionTitle>Site settings</SectionTitle>
          <Branding settings={settings} publicBase={publicBase()} />
        </Section>
      )}
    </Page>
  );
}

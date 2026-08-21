import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { canReview, canManageRoles, reviewScope } from '@/lib/review';
import { Page, PageHero, Section, SectionTitle, Empty, Card, Meta, Badge, AlumniBadge } from '@/app/ui';
import { publicBase } from '@/lib/branding';
import MemberRow from './member-row';
import PendingRow from './pending-row';
import EditMember from './edit-member';
import Branding from './branding';

export default async function Admin() {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  if (!profile) redirect('/login');
  if (!canReview(profile)) redirect('/hub');

  const scope = reviewScope(profile);
  const manages = canManageRoles(profile);

  // A club lead's queue is their own school. The `.eq` is what shapes the
  // page; the policy is what makes it true — a lead who removed the filter by
  // hand would still be refused by Postgres on the decision itself.
  let pendingQuery = supabase.from('profiles')
    .select('id, display_name, schools(name), created_at')
    .eq('status', 'pending')
    .order('created_at');
  if (scope.kind === 'school') pendingQuery = pendingQuery.eq('school_id', scope.schoolId);

  /* A club lead's roster: the approved members of their own school. This is
     the dashboard half of the portal — the queue above is only the people
     still knocking. Admins get the full member table further down instead. */
  const rosterQuery = scope.kind === 'school'
    ? supabase.from('profiles')
        .select('id, display_name, role, division, home_region, club_id, is_alumni, alumni_since, instagram_handle, tiktok_handle, schools(name), clubs(name)')
        .eq('status', 'approved')
        .eq('school_id', scope.schoolId)
        .order('display_name')
    : Promise.resolve({ data: null });

  const [{ data: members }, { data: clubs }, { data: waiting }, { data: roster }, { data: settings }] = await Promise.all([
    manages
      ? supabase.from('profiles')
          .select('id, display_name, role, club_id, division, home_region, is_alumni, alumni_since, instagram_handle, tiktok_handle, schools(name)')
          .eq('status', 'approved')
          .order('display_name')
      : Promise.resolve({ data: null }),
    manages
      ? supabase.from('clubs').select('id, name, schools(name)').order('name')
      : Promise.resolve({ data: null }),
    pendingQuery,
    rosterQuery,
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

      {scope.kind === 'school' && (
        <Section band>
          <SectionTitle count={roster?.length ? `${roster.length}` : null}>
            Your roster
          </SectionTitle>
          <p className="mb-6 max-w-[620px] text-[0.98rem] text-body">
            Everyone approved at your school. You can correct their details and mark
            graduates as alumni — they keep their account either way. Roles and club
            assignments are set by an NCBO admin.
          </p>

          {roster?.length ? (
            <ul className="grid list-none gap-3">
              {roster.map((m) => (
                <li key={m.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="font-display text-[1.05rem] font-bold uppercase tracking-[0.02em] text-ink">
                          {m.display_name}
                        </span>
                        {m.role !== 'member' && (
                          <Badge tone="active">{m.role.replace('_', ' ')}</Badge>
                        )}
                        {m.is_alumni && <AlumniBadge since={m.alumni_since} />}
                      </div>
                      <Meta className="mt-2">
                        {m.clubs?.name && <span>{m.clubs.name}</span>}
                        {m.clubs?.name && m.division && (
                          <span aria-hidden className="text-fine">·</span>
                        )}
                        {m.division && <span>{m.division}</span>}
                      </Meta>
                    </div>
                    <EditMember member={m} canRoster />
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nobody is on your roster yet.</Empty>
          )}
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
          <SectionTitle>Site settings</SectionTitle>
          <Branding settings={settings} publicBase={publicBase()} />
        </Section>
      )}
    </Page>
  );
}

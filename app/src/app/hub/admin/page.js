import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { Page, PageHero, Section, SectionTitle, Empty, Card, Meta, Badge, AlumniBadge, btnGhost, btnSmall } from '@/app/ui';
import { publicBase } from '@/lib/branding';
import MemberRow from './member-row';
import EditMember from './edit-member';
import Branding from './branding';

export default async function Admin() {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  const profile = viewer.profile;
  /* Layout and page render in parallel, so this page runs even when the layout
     is about to show the schema error. Redirecting here would win that race and
     send a signed-in member back to /login, which is the loop this whole change
     exists to remove. Render nothing and let the layout explain. */
  if (!viewer?.signedIn) redirect('/login');
  if (!profile) return null;

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

  const [{ data: members }, { data: clubs }, { data: chapters }, { data: settings }] = await Promise.all([
    manages
      ? supabase.from('member_directory')
          .select('id, display_name, role, club_id, club_name, division, home_region, is_alumni, alumni_since, instagram_handle, tiktok_handle, school_name, club_role')
          .order('display_name')
      : Promise.resolve({ data: null }),
    manages
      ? supabase.from('club_directory').select('id, club_name, short_name, school_name').order('short_name')
      : Promise.resolve({ data: null }),
    /* Where the applications actually are. An admin gets the numbers so they
       can see a chapter falling behind; they are not the approver for any of
       them and are not notified about any of them. */
    supabase.from('club_directory')
      .select('id, short_name, club_name, pending_count, approver_count')
      .order('short_name'),
    manages
      ? supabase.from('site_settings').select('logo_path, hero_path').eq('id', true).single()
      : Promise.resolve({ data: null }),
  ]);

  const waitingSomewhere = (chapters || []).filter((c) => c.pending_count > 0);
  const thinlyStaffed = (chapters || []).filter((c) => c.approver_count <= 1);

  return (
    <Page>
      <PageHero
        eyebrow={manages ? 'Admin' : 'Club lead'}
        title={manages ? 'The organisation.' : 'Your chapter.'}
        lead={
          manages
            ? 'Applications are decided by club leads at their own chapter, not here. This page is accounts, roles and reference data.'
            : 'Your applications and your roster, both a click away.'
        }
      />

      <Section>
        <SectionTitle
          count={waitingSomewhere.length ? `${waitingSomewhere.length} chapter${waitingSomewhere.length === 1 ? '' : 's'}` : null}
          action={
            <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/club/applications">
              Open a queue
            </Link>
          }
        >
          Applications
        </SectionTitle>

        <p className="mb-6 max-w-[620px] text-[0.98rem] text-body">
          New members are approved by the lead at their own chapter, who is the person
          able to tell whether a name belongs there. You can open any queue for support.
          You are not notified about them, on purpose: an admin standing in as the
          fallback approver is what let the old queue back up during recruiting season.
        </p>

        {waitingSomewhere.length ? (
          <ul className="grid list-none gap-2">
            {waitingSomewhere.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/club/applications?club=${c.id}`}
                  className="flex items-center justify-between gap-4 rounded-[8px] border border-edge bg-surface px-5 py-4 hover:bg-band"
                >
                  <span className="font-display text-[1rem] font-bold uppercase tracking-[0.02em] text-ink">
                    {c.short_name || c.club_name}
                  </span>
                  <Meta>{c.pending_count} waiting</Meta>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No chapter has anybody waiting right now.</Empty>
        )}

        {thinlyStaffed.length > 0 && (
          <Card className="mt-5 border-l-[3px] border-l-danger p-5">
            <p className="font-display text-[0.95rem] font-bold uppercase tracking-[0.03em] text-ink">
              {thinlyStaffed.length} chapter{thinlyStaffed.length === 1 ? '' : 's'} with one approver or none
            </p>
            <p className="mt-2 text-[0.95rem] text-body">
              {thinlyStaffed.map((c) => c.short_name || c.club_name).join(', ')}. Leadership
              turns over in May and December, and a chapter that drops to zero approvers
              cannot admit anybody until you appoint one.
            </p>
          </Card>
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
            Your chapter’s members, their email addresses, and the controls to keep the
            roster current, on its own page so it has room for them.
          </p>
        </Section>
      )}

      {manages && (
        <Section band>
          <SectionTitle count={members?.length || null}>Approved members</SectionTitle>
          <div className="mb-6 max-w-[620px] text-[0.98rem] text-body">
            Email addresses aren’t shown here. They are behind an admin-only reader on the
            member admin page, and a member’s own address never leaves their session.
          </div>
          <div className="overflow-hidden rounded-[8px] border border-edge bg-surface">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-edge bg-band/60">
                  {['Member', 'University', 'Chapter role', ''].map((h, i) => (
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
            Search every account, edit any profile, and close or restore an account, with
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

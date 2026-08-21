import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { Page, PageHero, Section, SectionTitle, Empty, Badge, fineprint } from '@/app/ui';
import RosterTable from './roster-table';

/**
 * The club lead's roster.
 *
 * Emails come from `get_club_roster()`, a SECURITY DEFINER function that does
 * its own authorisation — `profiles.email` has its SELECT privilege revoked
 * from `authenticated`, so there is no query the browser could send that would
 * return one. A lead who is not a lead of the club asked for gets an exception
 * from Postgres, not an empty list.
 */
export default async function Roster({ searchParams }) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);

  if (!viewer.profile) redirect('/login');
  /* Admins are allowed in — they lead nothing, but they manage everything. */
  if (!viewer.isClubLead && !viewer.isAdmin) redirect('/hub');

  /* An admin has no clubs of their own, so they browse the roster by picking
     one; a lead of several switches between theirs. */
  let clubs = viewer.ledClubs || [];
  if (viewer.isAdmin && clubs.length === 0) {
    const { data } = await supabase
      .from('club_directory').select('id, club_name').order('club_name');
    clubs = (data || []).map((c) => ({ id: c.id, name: c.club_name }));
  }

  if (clubs.length === 0) {
    return (
      <Page>
        <PageHero eyebrow="Roster" title="No club to manage." />
        <Section>
          <Empty>
            You’re marked as a club lead but aren’t linked to a club yet. An NCBO admin can
            add you on the club’s record.
          </Empty>
        </Section>
      </Page>
    );
  }

  const params = await searchParams;
  const wanted = String(params?.club || '');
  const active = clubs.find((c) => c.id === wanted) || clubs[0];

  const { data: members, error } = await supabase
    .rpc('get_club_roster', { target_club: active.id });

  return (
    <Page>
      <PageHero
        eyebrow="Roster"
        title={active.name}
        lead="Your club’s members, with the addresses you need to reach them. Everything here stays inside your club."
      />

      {clubs.length > 1 && (
        <Section>
          <SectionTitle>Your clubs</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {clubs.map((c) => (
              <Link
                key={c.id}
                href={`/hub/roster?club=${c.id}`}
                aria-current={c.id === active.id ? 'page' : undefined}
                className={`min-h-[44px] rounded-full border px-4 py-3 font-display text-[0.76rem] font-bold uppercase tracking-[0.1em] transition ${
                  c.id === active.id
                    ? 'border-brand bg-brand text-white'
                    : 'border-edge bg-surface text-meta hover:border-brand hover:text-brand'
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section>
        <SectionTitle
          count={members?.length ? `${members.length}` : null}
          action={<Badge tone="forming">Emails are lead-only</Badge>}
        >
          Members
        </SectionTitle>

        {error ? (
          <Empty>
            The roster wouldn’t load: {error.message}. If this keeps happening, an admin can
            check that you’re listed as a lead of this club.
          </Empty>
        ) : members?.length ? (
          <RosterTable members={members} canPromote />
        ) : (
          <Empty>
            Nobody has joined this club yet. Members appear here once their account is
            approved and an admin assigns them to the club.
          </Empty>
        )}

        <p className={`mt-6 ${fineprint}`}>
          Addresses come from members’ sign-in accounts and are visible to this club’s leads
          and NCBO admins only, never to other members.
        </p>
      </Section>
    </Page>
  );
}

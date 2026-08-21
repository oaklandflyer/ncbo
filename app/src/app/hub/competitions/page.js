import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import {
  Page, PageHero, Section, SectionTitle, Card, Badge, Meta, Empty, fineprint,
} from '@/app/ui';
import { UserChip } from '../profile-popup/popup';
import { showDate } from '../home/panels';
import { AddCompetition, AddResult, ConfirmResult } from './forms';

export const metadata = { title: 'Calendar · NCBO' };

/**
 * The competition calendar.
 *
 * Open to any signed-in account, with or without a chapter, because it is the
 * surface most likely to bring somebody in and gating it behind a membership
 * they do not have yet is backwards. What is gated is entering a result: that
 * needs a chapter, since a result has to score for somebody.
 */
export default async function Competitions() {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.profile) redirect('/login');

  const today = new Date().toISOString().slice(0, 10);
  const canAdd = viewer.isAdmin || viewer.orgRoles.includes('exec_board') || viewer.isClubLead;

  const [{ data: upcoming }, { data: past }, { data: federations }, { data: toConfirm }, { data: mine }] =
    await Promise.all([
      supabase.from('competitions')
        .select('id, name, level, starts_on, ends_on, city, state, info_url, ncbo_sanctioned, notes, federations(code, name)')
        .gte('starts_on', today)
        .order('starts_on')
        .limit(40),

      supabase.from('competitions')
        .select('id, name, level, starts_on, city, state, ncbo_sanctioned, federations(code)')
        .lt('starts_on', today)
        .order('starts_on', { ascending: false })
        .limit(12),

      supabase.from('federations').select('id, code, name').order('sort'),

      /* Results waiting on this person. RLS already limits what comes back to
         the chapters they lead, so this is the list and not a subset of it. */
      viewer.isClubLead || viewer.isAdmin || viewer.orgRoles.includes('exec_board')
        ? supabase.from('competition_entries')
            .select('id, division, placement, class_size, is_overall, created_at, competitions(name, starts_on), profiles!competition_entries_user_id_fkey(id, display_name)')
            .eq('status', 'pending')
            .order('created_at')
        : Promise.resolve({ data: null }),

      supabase.from('competition_entries')
        .select('id, division, placement, status, competitions(name, starts_on)')
        .eq('user_id', viewer.userId)
        .order('created_at', { ascending: false }),
    ]);

  return (
    <Page>
      <PageHero
        eyebrow="Competitions"
        title="The calendar."
        lead="Every show the network is entering, and every result once a club lead has confirmed it."
        actions={canAdd ? <AddCompetition federations={federations || []} /> : null}
      />

      {/* A lead's queue of results to confirm sits above everything else:
          it is the only thing on this page that is waiting on them. */}
      {toConfirm?.length > 0 && (
        <Section>
          <SectionTitle count={`${toConfirm.length} waiting`}>Results to confirm</SectionTitle>
          <p className="mb-5 max-w-[620px] text-[0.98rem] text-body">
            Members enter their own results and somebody else confirms them, which is what
            keeps the rankings worth reading. An unconfirmed result scores nothing.
          </p>
          <ul className="grid list-none gap-3">
            {toConfirm.map((e) => (
              <li key={e.id}>
                <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <UserChip
                      userId={e.profiles?.id}
                      className="font-display text-[1.02rem] font-bold uppercase tracking-[0.02em] text-ink"
                    >
                      {e.profiles?.display_name || 'A member'}
                    </UserChip>
                    <Meta className="mt-1">
                      {e.competitions?.name}
                      {e.division ? ` · ${e.division}` : ''}
                      {e.placement ? ` · placed ${e.placement}` : ' · placement not given'}
                      {e.class_size ? ` of ${e.class_size}` : ''}
                      {e.is_overall ? ' · overall' : ''}
                    </Meta>
                  </div>
                  <ConfirmResult entry={e} />
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section band={toConfirm?.length > 0}>
        <SectionTitle count={upcoming?.length || null}>Coming up</SectionTitle>
        {upcoming?.length ? (
          <ul className="grid list-none gap-3">
            {upcoming.map((c) => (
              <li key={c.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-display text-[1.08rem] font-bold uppercase tracking-[0.02em] text-ink">
                        {c.name}
                      </p>
                      <Meta className="mt-1">
                        {showDate(c.starts_on)}
                        {c.city ? ` · ${c.city}${c.state ? `, ${c.state}` : ''}` : ''}
                        {c.federations?.code ? ` · ${c.federations.code}` : ''}
                      </Meta>
                      {c.notes && <p className={`mt-2 ${fineprint}`}>{c.notes}</p>}
                      {c.info_url && (
                        <a
                          href={c.info_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-[0.9rem] font-semibold text-brand underline underline-offset-2"
                        >
                          Show details
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {c.ncbo_sanctioned && <Badge tone="active">NCBO</Badge>}
                      {c.level !== 'local' && <Badge>{c.level}</Badge>}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            Nothing on the calendar yet. Club leads and the exec board add shows, so if your
            chapter is entering one, ask your lead to put it up.
          </Empty>
        )}
      </Section>

      <Section>
        <SectionTitle>Recent shows</SectionTitle>
        {past?.length ? (
          <ul className="grid list-none gap-3">
            {past.map((c) => (
              <li key={c.id}>
                <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="font-display text-[1.02rem] font-bold uppercase tracking-[0.02em] text-ink">
                      {c.name}
                    </p>
                    <Meta className="mt-1">
                      {showDate(c.starts_on)}
                      {c.city ? ` · ${c.city}${c.state ? `, ${c.state}` : ''}` : ''}
                      {c.federations?.code ? ` · ${c.federations.code}` : ''}
                    </Meta>
                  </div>
                  {/* Entering a result needs a chapter: the result has to score
                      for somebody, and the database stamps that from the
                      membership rather than from this form. */}
                  {viewer.membership
                    ? <AddResult competitionId={c.id} competitionName={c.name} />
                    : <Meta>Join a chapter to log a result</Meta>}
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No past shows on the calendar yet.</Empty>
        )}
      </Section>

      {mine?.length > 0 && (
        <Section band>
          <SectionTitle>Your results</SectionTitle>
          <ul className="grid list-none gap-2">
            {mine.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-edge bg-surface px-5 py-4"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{e.competitions?.name}</span>
                  <Meta className="mt-1">
                    {showDate(e.competitions?.starts_on)}
                    {e.division ? ` · ${e.division}` : ''}
                    {e.placement ? ` · placed ${e.placement}` : ''}
                  </Meta>
                </span>
                {e.status === 'confirmed' && <Badge tone="active">Confirmed</Badge>}
                {e.status === 'pending' && <Badge>With your lead</Badge>}
                {e.status === 'disputed' && <Badge tone="forming">Queried</Badge>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}

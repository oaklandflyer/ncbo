import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canReview } from '@/lib/review';
import { getViewerContext } from '@/lib/viewer';
import { affiliationLabel, phaseLabel } from '@/lib/membership';
import {
  Page, PageHero, Section, SectionTitle, Stat, Stats, Badge, Empty, Meta,
  btnGhost, btnSmall, fineprint,
} from '@/app/ui';
import { UserChip } from './profile-popup/popup';
import {
  UpcomingShows, RankingsPanel, AskPanel, NewJoinersPanel, BeginnerPanel, LeaguePanel,
} from './home/panels';

/**
 * Home, in three arrangements.
 *
 * `profiles.experience_phase` decides the order. The three personas want
 * genuinely different things on the day they arrive, and one screen that
 * serves all of them serves none of them well:
 *
 *   new_to_lifting       — when the club meets, who to show up with, what the
 *                          first eight weeks look like. Explicitly not a
 *                          forum: this person wants people, not threads.
 *   new_to_bodybuilding  — how prep works, what division they are, what a
 *                          coach costs. Leads with Q&A and the prep timeline.
 *   competing            — the calendar, results, and where they stand
 *                          nationally. Leads with rankings.
 *
 * Everybody gets everything eventually; only the order changes. Somebody who
 * joins as a beginner becomes a competitor without needing a different app,
 * and the phase is editable from their profile.
 *
 * A member who never answered the question gets the middle layout, which is
 * the one that assumes least.
 */
export default async function Hub() {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  const profile = viewer.profile;

  // The layout redirects too, but layouts and pages render in parallel, so
  // this page still runs and would crash before that redirect lands.
  if (!profile) redirect('/login');

  const membership = viewer.membership;
  const phase = profile.experience_phase || 'new_to_bodybuilding';
  const season = new Date().getFullYear();
  const canAnswer = viewer.canModerateContent;

  const [clubmates, joiners, shows, rankings, chapters, topQuestions, openQuestions, pendingCount] =
    await Promise.all([
      /* The roster reads `member_directory`, whose club comes from an active
         membership and nothing else. See the roster audit in 0016. */
      membership?.clubId
        ? supabase.from('member_directory')
            .select('id, display_name, club_role, division, is_alumni, member_verified')
            .eq('club_id', membership.clubId)
            .order('display_name')
        : Promise.resolve({ data: null }),

      membership?.clubId
        ? supabase.from('club_memberships')
            .select('user_id, created_at, profiles!club_memberships_user_id_fkey(id, display_name)')
            .eq('club_id', membership.clubId)
            .eq('status', 'active')
            .neq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(8)
        : Promise.resolve({ data: null }),

      supabase.from('competitions')
        .select('id, name, level, starts_on, city, state, ncbo_sanctioned, federations(code)')
        .gte('starts_on', new Date().toISOString().slice(0, 10))
        .order('starts_on')
        .limit(4),

      supabase.from('national_rankings')
        .select('user_id, display_name, chapter, shows, points, rank')
        .eq('season', season)
        .order('rank')
        .limit(10),

      supabase.from('chapter_rankings')
        .select('club_id, chapter, points, rank, competing_members')
        .eq('season', season)
        .order('rank')
        .limit(10),

      supabase.from('question_feed')
        .select('id, body, answer_count, helpful_count')
        .eq('status', 'approved')
        .eq('answered', true)
        .order('helpful_count', { ascending: false })
        .limit(4),

      canAnswer
        ? supabase.from('question_feed').select('id', { count: 'exact', head: true }).eq('answered', false)
        : Promise.resolve({ count: 0 }),

      viewer.isClubLead
        ? supabase.from('club_memberships').select('id', { count: 'exact', head: true })
            .eq('status', 'pending').in('club_id', viewer.ledClubIds)
        : Promise.resolve({ count: 0 }),
    ]);

  const roster = clubmates.data || [];
  const newJoiners = (joiners.data || []).map((r) => r.profiles).filter(Boolean);
  const competitions = (shows.data || []).map((c) => ({ ...c, federation: c.federations?.code }));
  const chapter = membership ? affiliationLabel({ university_short_name: membership.shortName }) : null;
  const firstName = String(profile.display_name || 'member').split(/\s+/)[0];
  const roleLabel = (r) => ({ club_lead: 'Club lead', co_lead: 'Co-lead' }[r] || 'Member');

  /* My own rank, if I have one. Worth surfacing above everything else for the
     competing persona: a number that moved is the reason to come back. */
  const myRank = (rankings.data || []).find((r) => r.user_id === profile.id);

  const hero = {
    new_to_lifting: {
      title: membership?.clubName || `Welcome, ${firstName}.`,
      lead: membership
        ? 'Your chapter, the people in it, and what the first eight weeks look like.'
        : 'Find a chapter, see what training with one looks like, and start.',
    },
    new_to_bodybuilding: {
      title: membership?.clubName || `Welcome back, ${firstName}.`,
      lead: 'How prep works, what division you are, and what it costs. Answered already, not waiting on a reply.',
    },
    competing: {
      title: myRank
        ? `${season}: you are ranked ${myRank.rank}.`
        : membership?.clubName || `Welcome back, ${firstName}.`,
      lead: 'Where the network stands this season, and what is on the calendar next.',
    },
  }[phase];

  return (
    <Page>
      <PageHero
        eyebrow={chapter || 'NCBO'}
        title={hero.title}
        lead={hero.lead}
        actions={
          canReview(viewer) && pendingCount.count > 0 ? (
            <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/hub/club/queue">
              {pendingCount.count} waiting
            </Link>
          ) : null
        }
      >
        {(roster.length > 0 || myRank || pendingCount.count > 0 || openQuestions.count > 0) && (
          <div className="mt-9 max-w-2xl">
            <Stats>
              {myRank && <Stat value={Math.round(myRank.points)} label={`Points, ${season}`} />}
              {roster.length > 0 && (
                <Stat value={roster.length} label={roster.length === 1 ? 'Chapter member' : 'Chapter members'} />
              )}
              {canAnswer && openQuestions.count > 0 && (
                <Stat value={openQuestions.count} label="Questions open" />
              )}
              {canReview(viewer) && pendingCount.count > 0 && (
                <Stat value={pendingCount.count} label="Awaiting approval" />
              )}
            </Stats>
          </div>
        )}
      </PageHero>

      {/* ── the three arrangements ───────────────────────────────────────── */}

      {phase === 'new_to_lifting' && (
        <>
          <ChapterPanel
            membership={membership}
            chapter={chapter}
            roster={roster}
            roleLabel={roleLabel}
            viewer={viewer}
            pending={viewer.pendingMembership}
          />
          <NewJoinersPanel joiners={newJoiners} chapter={chapter || 'your chapter'} />
          <BeginnerPanel chapter={chapter} hasChapter={!!membership} />
          <AskPanel questions={topQuestions.data} />
          <UpcomingShows
            competitions={competitions}
            heading="Shows, when you are ready"
            lead="Nobody expects you to enter one this year. They are here so you can see where this goes."
          />
        </>
      )}

      {phase === 'new_to_bodybuilding' && (
        <>
          <AskPanel questions={topQuestions.data} prominent />
          <PrepTimeline />
          <UpcomingShows
            competitions={competitions}
            heading="On the calendar"
            lead="Work backwards from a date. Sixteen to twenty weeks is the usual first prep, and starting late is the most common way one goes wrong."
          />
          <RankingsPanel rankings={rankings.data} chapters={chapters.data} season={season} />
          <ChapterPanel
            membership={membership}
            chapter={chapter}
            roster={roster}
            roleLabel={roleLabel}
            viewer={viewer}
            pending={viewer.pendingMembership}
          />
        </>
      )}

      {phase === 'competing' && (
        <>
          <RankingsPanel rankings={rankings.data} chapters={chapters.data} season={season} />
          <UpcomingShows
            competitions={competitions}
            heading="Next up"
            lead="Add a result from any past show and your club lead confirms it. Confirmed results are what the rankings are made of."
          />
          <ChapterPanel
            membership={membership}
            chapter={chapter}
            roster={roster}
            roleLabel={roleLabel}
            viewer={viewer}
            pending={viewer.pendingMembership}
          />
          <AskPanel questions={topQuestions.data} />
        </>
      )}

      <LeaguePanel />

      <Section>
        <p className={fineprint}>
          Your home screen is set up for {phaseLabel(phase)?.toLowerCase() || 'where you are now'}.{' '}
          <Link className="font-semibold text-brand underline underline-offset-2" href="/hub/profile/edit">
            Change that
          </Link>{' '}
          any time.
        </p>
      </Section>
    </Page>
  );
}

/** The member's own chapter roster, shared by all three arrangements. */
function ChapterPanel({ membership, chapter, roster, roleLabel, viewer, pending }) {
  if (!membership) {
    return (
      <Section>
        <SectionTitle>Your chapter</SectionTitle>
        <Empty>
          {pending
            ? 'Your application is with your club lead. They usually get to it within a few days, and your chapter appears here once they do.'
            : 'You are not at a chapter yet. If your school has one you can apply from your profile, and if it does not, we will tell you when that changes.'}
        </Empty>
      </Section>
    );
  }

  return (
    <Section>
      <SectionTitle
        count={`${roster.length} member${roster.length === 1 ? '' : 's'}`}
        action={
          viewer.isClubLead || viewer.isAdmin ? (
            <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/hub/roster">
              Manage roster
            </Link>
          ) : null
        }
      >
        {chapter}
      </SectionTitle>

      {roster.length === 0 ? (
        <Empty>Nobody else on the roster yet.</Empty>
      ) : (
        <ul className="grid list-none gap-2 sm:grid-cols-2">
          {roster.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-[6px] border border-edge bg-surface px-4 py-3"
            >
              <UserChip userId={m.id} className="min-w-0 truncate font-medium text-ink">
                {m.display_name || 'No name yet'}
              </UserChip>
              <span className="flex shrink-0 items-center gap-2">
                {m.club_role !== 'member' && <Badge tone="active">{roleLabel(m.club_role)}</Badge>}
                {m.division && <Meta>{m.division}</Meta>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/**
 * The prep timeline, for the persona who asked how far out to start.
 *
 * Weeks-out rather than dates, because it has to be true whichever show they
 * pick. Every number here is the same one the Q&A library gives, so the two
 * cannot contradict each other on the same screen.
 */
function PrepTimeline() {
  const stages = [
    ['20 to 16 weeks out', 'Pick the show. Work backwards from it, and add weeks rather than accelerating later.'],
    ['16 to 8 weeks out', 'The long middle. Lose weight slowly, keep training hard, start posing practice.'],
    ['8 to 2 weeks out', 'Conditioning gets decided here. Get somebody experienced looking at you in person.'],
    ['The last week', 'Peak week. Boring is correct, and it is the worst possible week to improvise.'],
  ];

  return (
    <Section>
      <SectionTitle>What a first prep looks like</SectionTitle>
      <ol className="grid list-none gap-3 sm:grid-cols-2">
        {stages.map(([when, what]) => (
          <li key={when} className="rounded-[8px] border border-edge bg-surface p-5">
            <p className="font-display text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-meta">
              {when}
            </p>
            <p className="mt-2 text-[0.98rem] text-body">{what}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

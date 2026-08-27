import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canReview } from '@/lib/review';
import { getViewerContext } from '@/lib/viewer';
import { affiliationLabel, phaseLabel } from '@/lib/membership';
import {
  Page, PageHero, Section, SectionTitle, Stat, Stats, Badge, Empty, Meta,
  btnGhost, btnSmall, fineprint, wrap,
} from '@/app/ui';
import { UserChip } from './profile-popup/popup';
import Tutorial from './tutorial';
import {
  UpcomingShows, RankingsPanel, AskPanel, NewJoinersPanel, BeginnerPanel, LeaguePanel,
  showDate,
} from './home/panels';
import {
  WidgetGrid, ChapterCupWidget, NextUpWidget, TrainingWidget, ordinal,
} from './home/widgets';
import { fetchUpcomingEvents } from '@/lib/gcal';
import { sessionSummary, daysOut } from '@/lib/workoutSummary';

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
  /* Layout and page render in parallel, so this page runs even when the layout
     is about to show the schema error. Redirecting here would win that race and
     send a signed-in member back to /login, which is the loop this whole change
     exists to remove. Render nothing and let the layout explain. */
  if (!viewer?.signedIn) redirect('/login');
  if (!profile) return null;

  const membership = viewer.membership;
  const phase = profile.experience_phase || 'new_to_bodybuilding';
  const season = new Date().getFullYear();
  const canAnswer = viewer.canModerateContent;

  /* Applications waiting on this viewer. An admin is included, unscoped: they
     can open any chapter's queue, and at a chapter with no lead appointed they
     are the only person who can — so counting only led clubs showed an admin
     zero while people sat waiting. */
  const applicationsWaiting = () => {
    const q = supabase.from('club_memberships')
      .select('id', { count: 'exact', head: true }).eq('status', 'pending');
    return viewer.isAdmin ? q : q.in('club_id', viewer.ledClubIds);
  };

  const [
    clubmates, joiners, shows, rankings, chapters, topQuestions, openQuestions, pendingCount,
    clubCalendar, lastSession, myTotals,
  ] = await Promise.all([
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

      canReview(viewer) ? applicationsWaiting() : Promise.resolve({ count: 0 }),

      /* The chapter's own calendar, for the Next Up widget. Two narrow columns
         rather than the whole club row: this is here to answer "is there a
         calendar and may I read it", and nothing else on this page needs the
         rest. */
      membership?.clubId
        ? supabase.from('clubs').select('gcal_id, gcal_published').eq('id', membership.clubId).maybeSingle()
        : Promise.resolve({ data: null }),

      /* The last finished session, for the Training widget. One row, because
         the widget describes one workout. */
      supabase.from('workout_sessions')
        .select('id, start_time, end_time, workout_data')
        .eq('status', 'completed')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle(),

      /* Sessions completed, as a single number. The view counts in Postgres —
         the alternative is shipping every workout document to a phone to
         count them, which is a few hundred KB to render one stat.
         `security_invoker` means it can only ever return the viewer's own row;
         see the policy tests in supabase/tests/11_workout_totals.sql.
         `total_volume` is deliberately not selected: nothing renders it any
         more, and a column nobody draws is one the next person adds a widget
         for. */
      supabase.from('my_workout_totals').select('sessions').maybeSingle(),
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

  /* ── the widget row ───────────────────────────────────────────────────
     Three answers, above everything else, for all three personas: where my
     chapter stands, what is next, and what I last did. The reading material
     the phases reorder is still below — this is the part somebody checks
     between classes without scrolling. */

  const chapterTable = chapters.data || [];
  const myChapter = membership?.clubId
    ? chapterTable.find((c) => c.club_id === membership.clubId)
    : null;
  const cupLeader = chapterTable[0]
    ? { chapter: chapterTable[0].chapter, points: chapterTable[0].points, runnerUpPoints: chapterTable[1]?.points ?? null }
    : null;

  /* The chapter's own calendar beats the national one when there is a live
     one to read: "training at 6" is nearer than a show in March. Fetched
     after the parallel batch because it depends on its result, and skipped
     entirely when the chapter has not published a calendar — which also means
     no Google round trip on most people's home screen. */
  const calendarLive = !!(clubCalendar?.data?.gcal_id && clubCalendar.data.gcal_published);
  const { events: chapterEvents } = calendarLive
    ? await fetchUpcomingEvents(clubCalendar.data.gcal_id, { max: 3 })
    : { events: [] };

  const nextEvent = chapterEvents?.[0] || null;
  const nextShow = competitions[0] || null;
  const nextUp = nextEvent
    ? {
      kind: 'Next up',
      title: nextEvent.title,
      when: eventWhen(nextEvent),
      where: nextEvent.location,
      days: daysOut(nextEvent.start),
      href: '/hub/calendar',
    }
    : nextShow && {
      kind: 'Next show',
      title: nextShow.name,
      when: showDate(nextShow.starts_on),
      where: [nextShow.city, nextShow.state].filter(Boolean).join(', ') || null,
      days: daysOut(nextShow.starts_on),
      href: '/hub/calendar',
    };

  /* The tracker is still dark-launched, so the widget follows the same gate
     the nav does rather than inventing a second answer to who can see it. */
  const lastWorkout = viewer.isAdmin ? sessionSummary(lastSession?.data) : null;
  const sessionsCompleted = viewer.isAdmin ? Number(myTotals?.data?.sessions || 0) : 0;

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
    /* The chapter leads, not the individual. This said "2026: you are ranked
       3." — the single most individual-emphasising line on the home screen,
       at the top of it, for the persona most likely to read it as the point
       of the app. The Cup standing is the headline now and a member's own
       rank is the sentence under it, which is the same information ordered
       the way NCBO actually competes. */
    competing: {
      title: myChapter
        ? `${season}: ${myChapter.chapter || membership?.clubName} is ${ordinal(myChapter.rank)}.`
        : membership?.clubName || `Welcome back, ${firstName}.`,
      lead: myRank
        ? `You are ranked ${myRank.rank} nationally, and your results are part of that standing. Here is what is on the calendar next.`
        : 'Where the network stands this season, and what is on the calendar next.',
    },
  }[phase];

  return (
    <Page>
      {/* Once per device, and only ever on this page: the dashboard is where
          somebody lands after signing up, and an overlay that could appear on
          any route is one that appears at the wrong moment.

          The workout tracker is listed only for the people who can see it, so
          the tour does not describe a tab that is not there. */}
      <Tutorial
        extraSteps={viewer.isAdmin
          ? [['Workout', 'Log a session set by set. Only you can see it, and it survives a reload.']]
          : []}
      />

      <PageHero
        eyebrow={chapter || 'NCBO'}
        title={hero.title}
        lead={hero.lead}
        actions={
          canReview(viewer) && pendingCount.count > 0 ? (
            <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/club/applications">
              {pendingCount.count} waiting
            </Link>
          ) : null
        }
      >
        {(roster.length > 0 || myRank || pendingCount.count > 0 || openQuestions.count > 0) && (
          <div className="mt-9 max-w-2xl">
            {/* Chapter first, and the member's own points labelled as what
                they are: a contribution to that chapter's total, not a
                standing of their own that happens to sit beside it. */}
            <Stats>
              {roster.length > 0 && (
                <Stat value={roster.length} label={roster.length === 1 ? 'Chapter member' : 'Chapter members'} />
              )}
              {myRank && (
                <Stat value={Math.round(myRank.points)} label={`Your points, ${season}`} />
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

      {/* Tighter than a Section, and deliberately not one: the widget row is
          the top of the page's own rhythm, not a band of its own. */}
      <div className={`${wrap} pb-1 pt-6`}>
        <WidgetGrid>
          {myChapter && (
            <ChapterCupWidget
              season={season}
              rank={myChapter.rank}
              chapter={myChapter.chapter || membership?.clubName}
              points={myChapter.points}
              leader={cupLeader}
              contributed={myRank?.points || 0}
            />
          )}
          <NextUpWidget {...(nextUp || {})} />
          {viewer.isAdmin && <TrainingWidget last={lastWorkout} sessions={sessionsCompleted} />}
        </WidgetGrid>
      </div>

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

/** A Google Calendar event's start, as a person reads it. */
function eventWhen(event) {
  if (!event?.start) return null;
  const date = new Date(event.start);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    ...(event.allDay ? {} : { hour: 'numeric', minute: '2-digit' }),
  });
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

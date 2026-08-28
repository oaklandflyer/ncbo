import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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
import { currentSeason } from '@/lib/season';
import { StatsSkeleton, WidgetRowSkeleton, SectionSkeleton } from './home/skeletons';
import {
  loadRoster, loadJoiners, loadShows, loadAthletes, loadChapterCup, loadTopQuestions,
  loadOpenQuestionCount, loadPendingCount, pendingArgs, loadClubCalendar,
  loadLastSession, loadSessionCount,
} from './home/data';

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

  /* Layout and page render in parallel, so this page runs even when the layout
     is about to show the schema error. Redirecting here would win that race and
     send a signed-in member back to /login, which is the loop this whole change
     exists to remove. Render nothing and let the layout explain. */
  if (!viewer?.signedIn) redirect('/login');
  if (!profile) return null;

  const membership = viewer.membership;
  const phase = profile.experience_phase || 'new_to_bodybuilding';
  const clubId = membership?.clubId || null;
  const season = currentSeason();
  const chapter = membership ? affiliationLabel({ university_short_name: membership.shortName }) : null;
  const firstName = String(profile.display_name || 'member').split(/\s+/)[0];

  /*
   * The hero no longer waits for anything.
   *
   * It used to read the Chapter Cup standings, so that a competing member's
   * title could say "Pitt is 3rd." — which meant the entire page, headings
   * and nav included, blocked on the slowest RPC on the screen. The standing
   * has not been lost: it is the largest number in the widget row directly
   * below, where it was already being printed twice.
   *
   * Everything under here is a Suspense boundary. The shell — hero, tabs,
   * headings — is static enough to render from the viewer alone, so it arrives
   * immediately and the data fills in as it lands.
   */
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
      title: membership?.clubName || `Welcome back, ${firstName}.`,
      lead: `Where your chapter stands in the ${season} Chapter Cup, and what is on the calendar next.`,
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
          /* No fallback: a link that is not there yet should be absent, not a
             grey rectangle in the hero. */
          <Suspense fallback={null}><ReviewQueueLink viewer={viewer} /></Suspense>
        }
      >
        <Suspense fallback={<StatsSkeleton />}>
          <HeroStats viewer={viewer} clubId={clubId} season={season} />
        </Suspense>
      </PageHero>

      {/* Tighter than a Section, and deliberately not one: the widget row is
          the top of the page's own rhythm, not a band of its own. */}
      <div className={`${wrap} pb-1 pt-6`}>
        <Suspense fallback={<WidgetRowSkeleton />}>
          <WidgetRow viewer={viewer} membership={membership} clubId={clubId} season={season} />
        </Suspense>
      </div>

      {/* The reading material, in the order this phase wants it. One boundary
          rather than one per panel: below the fold the panels arrive together
          anyway, and five separate skeletons is a page that flickers five
          times instead of once. */}
      <Suspense fallback={<><SectionSkeleton /><SectionSkeleton rows={2} /></>}>
        <PhasePanels
          phase={phase}
          viewer={viewer}
          membership={membership}
          chapter={chapter}
          clubId={clubId}
          season={season}
        />
      </Suspense>

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

/** The "N waiting" link in the hero, for anybody who can clear a queue. */
async function ReviewQueueLink({ viewer }) {
  const pending = await loadPendingCount(...pendingArgs(viewer));
  if (pending === 0) return null;
  return (
    <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/club/applications">
      {pending} waiting
    </Link>
  );
}

/**
 * The stat strip under the hero.
 *
 * Chapter first, and the member's own points labelled as what they are: a
 * contribution to that chapter's total, not a standing of their own that
 * happens to sit beside it.
 */
async function HeroStats({ viewer, clubId, season }) {
  const [roster, rankings, openQuestions, pending] = await Promise.all([
    loadRoster(clubId),
    loadAthletes(season),
    loadOpenQuestionCount(viewer.canModerateContent),
    loadPendingCount(...pendingArgs(viewer)),
  ]);

  const myRank = rankings.find((r) => r.user_id === viewer.userId);
  if (roster.length === 0 && !myRank && pending === 0 && openQuestions === 0) return null;

  return (
    <div className="mt-9 max-w-2xl">
      <Stats>
        {roster.length > 0 && (
          <Stat value={roster.length} label={roster.length === 1 ? 'Chapter member' : 'Chapter members'} />
        )}
        {myRank && <Stat value={Math.round(myRank.points)} label="Your points" />}
        {viewer.canModerateContent && openQuestions > 0 && (
          <Stat value={openQuestions} label="Questions open" />
        )}
        {pending > 0 && <Stat value={pending} label="Awaiting approval" />}
      </Stats>
    </div>
  );
}

/**
 * The widget row.
 *
 * Three answers, above everything else, for all three personas: where my
 * chapter stands, what is next, and what I last did. The reading material the
 * phases reorder is below — this is the part somebody checks between classes
 * without scrolling.
 */
async function WidgetRow({ viewer, membership, clubId, season }) {
  const [chapters, rankings, competitions, calendar, lastSession, sessions] = await Promise.all([
    loadChapterCup(season),
    loadAthletes(season),
    loadShows(),
    loadClubCalendar(clubId),
    viewer.isAdmin ? loadLastSession() : Promise.resolve(null),
    viewer.isAdmin ? loadSessionCount() : Promise.resolve(0),
  ]);

  const myChapter = clubId ? chapters.find((c) => c.club_id === clubId) : null;
  const myRank = rankings.find((r) => r.user_id === viewer.userId);
  const cupLeader = chapters[0]
    ? {
      chapter: chapters[0].chapter,
      points: chapters[0].points,
      runnerUpPoints: chapters[1]?.points ?? null,
    }
    : null;

  /* The chapter's own calendar beats the national one when there is a live one
     to read: "training at 6" is nearer than a show in March. Fetched after the
     batch because it depends on its result, and skipped entirely when the
     chapter has not published a calendar — which also means no Google round
     trip on most people's home screen. */
  const calendarLive = !!(calendar?.gcal_id && calendar.gcal_published);
  const { events: chapterEvents } = calendarLive
    ? await fetchUpcomingEvents(calendar.gcal_id, { max: 3 })
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

  return (
    <WidgetGrid>
      {myChapter && (
        <ChapterCupWidget
          rank={myChapter.rank}
          chapter={myChapter.chapter || membership?.clubName}
          points={myChapter.points}
          leader={cupLeader}
          contributed={myRank?.points || 0}
          season={season}
        />
      )}
      <NextUpWidget {...(nextUp || {})} />
      {/* The tracker is still dark-launched, so the widget follows the same
          gate the nav does rather than inventing a second answer to who can
          see it. */}
      {viewer.isAdmin && (
        <TrainingWidget last={sessionSummary(lastSession)} sessions={sessions} />
      )}
    </WidgetGrid>
  );
}

/** The three arrangements. Same panels, ordered by what the phase came for. */
async function PhasePanels({ phase, viewer, membership, chapter, clubId, season }) {
  const [roster, joiners, competitions, topQuestions, rankings, chapters] = await Promise.all([
    loadRoster(clubId),
    loadJoiners(clubId, viewer.userId),
    loadShows(),
    loadTopQuestions(),
    loadAthletes(season),
    loadChapterCup(season),
  ]);

  const chapterPanel = (
    <ChapterPanel
      membership={membership}
      chapter={chapter}
      roster={roster}
      viewer={viewer}
      pending={viewer.pendingMembership}
    />
  );

  if (phase === 'new_to_lifting') {
    return (
      <>
        {chapterPanel}
        <NewJoinersPanel joiners={joiners} chapter={chapter || 'your chapter'} />
        <BeginnerPanel chapter={chapter} hasChapter={!!membership} />
        <AskPanel questions={topQuestions} />
        <UpcomingShows
          competitions={competitions}
          heading="Shows, when you are ready"
          lead="Nobody expects you to enter one this year. They are here so you can see where this goes."
        />
      </>
    );
  }

  if (phase === 'competing') {
    return (
      <>
        <RankingsPanel rankings={rankings} chapters={chapters} season={season} />
        <UpcomingShows
          competitions={competitions}
          heading="Next up"
          lead="Add a result from any past show and your club lead confirms it. Confirmed results are what the rankings are made of."
        />
        {chapterPanel}
        <AskPanel questions={topQuestions} />
      </>
    );
  }

  return (
    <>
      <AskPanel questions={topQuestions} prominent />
      <PrepTimeline />
      <UpcomingShows
        competitions={competitions}
        heading="On the calendar"
        lead="Work backwards from a date. Sixteen to twenty weeks is the usual first prep, and starting late is the most common way one goes wrong."
      />
      <RankingsPanel rankings={rankings} chapters={chapters} season={season} />
      {chapterPanel}
    </>
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
function ChapterPanel({ membership, chapter, roster, viewer, pending }) {
  const roleLabel = (r) => ({ club_lead: 'Club lead', co_lead: 'Co-lead' }[r] || 'Member');

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

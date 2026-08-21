import Link from 'next/link';
import {
  Section, SectionTitle, Card, DarkTile, Meta, Badge, Empty,
  btnGhost, btnSmall, fineprint,
} from '@/app/ui';
import { UserChip } from '@/app/hub/profile-popup/popup';

/**
 * The panels the three Home layouts are assembled from.
 *
 * Shared components rather than three bespoke pages, because the personas
 * overlap: everybody eventually wants the calendar, and somebody who joins as
 * a beginner becomes a competitor without needing a different app. What
 * differs between the three is the order, and what leads.
 */

/** Dates read as "Sat, Mar 14", which is what somebody scanning a calendar needs. */
export function showDate(value) {
  if (!value) return null;
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function daysUntil(value) {
  return Math.round((new Date(`${value}T12:00:00`) - new Date()) / 86400000);
}

/**
 * The competition calendar as a Home panel.
 *
 * Leads for personas 2 and 3, and appears lower down for persona 1: a beginner
 * does not need a show date in week one, but should be able to see that shows
 * exist and that people they know are entering them.
 */
export function UpcomingShows({ competitions, heading = 'On the calendar', lead }) {
  return (
    <Section>
      <SectionTitle
        count={competitions?.length ? `${competitions.length}` : null}
        action={
          <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/hub/competitions">
            Full calendar
          </Link>
        }
      >
        {heading}
      </SectionTitle>

      {lead && <p className="mb-5 max-w-[620px] text-[0.98rem] text-body">{lead}</p>}

      {competitions?.length ? (
        <ul className="grid list-none gap-3">
          {competitions.map((c) => {
            const days = daysUntil(c.starts_on);
            return (
              <li key={c.id}>
                <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="font-display text-[1.05rem] font-bold uppercase tracking-[0.02em] text-ink">
                      {c.name}
                    </p>
                    <Meta className="mt-1">
                      {showDate(c.starts_on)}
                      {c.city ? ` · ${c.city}${c.state ? `, ${c.state}` : ''}` : ''}
                      {c.federation ? ` · ${c.federation}` : ''}
                    </Meta>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {c.ncbo_sanctioned && <Badge tone="active">NCBO</Badge>}
                    {c.level !== 'local' && <Badge>{c.level}</Badge>}
                    {days >= 0 && (
                      <span className={fineprint}>
                        {days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'}`}
                      </span>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>
          Nothing on the calendar yet. Club leads and the exec board add shows, so if
          your chapter is entering one, ask your lead to put it up.
        </Empty>
      )}
    </Section>
  );
}

/**
 * National rankings, top five each.
 *
 * The thing no single chapter can build for itself, and the reason somebody at
 * Iowa opens this on a quiet Tuesday.
 */
export function RankingsPanel({ rankings, season, chapters }) {
  return (
    <Section band>
      <SectionTitle
        action={
          <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/hub/rankings">
            Full rankings
          </Link>
        }
      >
        {season} rankings
      </SectionTitle>

      {rankings?.length ? (
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-3 font-display text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-meta">
              Lifters
            </p>
            <ol className="grid list-none gap-2">
              {rankings.slice(0, 5).map((r) => (
                <li
                  key={r.user_id}
                  className="flex items-center gap-3 rounded-[6px] border border-edge bg-surface px-4 py-3"
                >
                  <span className="w-6 shrink-0 font-display text-[1rem] font-bold text-brand">
                    {r.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <UserChip userId={r.user_id} className="font-semibold text-ink">
                      {r.display_name}
                    </UserChip>
                    {r.chapter && <span className="ml-2 text-[0.85rem] text-meta">{r.chapter}</span>}
                  </span>
                  <span className="shrink-0 font-display text-[0.9rem] font-bold text-ink">
                    {Math.round(r.points)}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="mb-3 font-display text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-meta">
              Chapters
            </p>
            {chapters?.length ? (
              <ol className="grid list-none gap-2">
                {chapters.slice(0, 5).map((c) => (
                  <li
                    key={c.club_id}
                    className="flex items-center gap-3 rounded-[6px] border border-edge bg-surface px-4 py-3"
                  >
                    <span className="w-6 shrink-0 font-display text-[1rem] font-bold text-brand">
                      {c.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                      {c.chapter}
                    </span>
                    <span className="shrink-0 font-display text-[0.9rem] font-bold text-ink">
                      {Math.round(c.points)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>No chapter has a confirmed result this season yet.</Empty>
            )}
          </div>
        </div>
      ) : (
        <Empty>
          No confirmed results this season yet. A result is entered by the lifter and
          confirmed by their club lead, so if you have competed, add it from the calendar.
        </Empty>
      )}
    </Section>
  );
}

/** The Q&A entry point, sized up for the persona whose Home leads with it. */
export function AskPanel({ questions, prominent = false }) {
  return (
    <Section band={prominent}>
      <SectionTitle
        action={
          <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/hub/qa">
            Open Q&amp;A
          </Link>
        }
      >
        {prominent ? 'Answers, already written' : 'Q&A'}
      </SectionTitle>

      {prominent && (
        <p className="mb-5 max-w-[620px] text-[0.98rem] text-body">
          How prep works, what division you are, what a coach costs, how far out to
          start. The board opens with thirty answered questions, so you are not waiting
          on anybody to reply.
        </p>
      )}

      {questions?.length ? (
        <ul className="grid list-none gap-2">
          {questions.map((q) => (
            <li key={q.id}>
              <Link
                href={`/hub/qa/${q.id}`}
                className="block rounded-[6px] border border-edge bg-surface px-5 py-4 hover:bg-band"
              >
                <span className="block text-[0.98rem] font-medium text-ink">{q.body}</span>
                <Meta className="mt-1">
                  {q.answer_count} answer{q.answer_count === 1 ? '' : 's'}
                  {q.helpful_count > 0 && ` · ${q.helpful_count} found this helpful`}
                </Meta>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Nothing on the board yet. Ask the first question.</Empty>
      )}
    </Section>
  );
}

/**
 * Who else joined recently at your chapter.
 *
 * Persona 1 explicitly does not want an anonymous forum: they want to know who
 * to show up with. Names of people at the same stage, at the same school, is
 * the whole answer, and it is why these are tappable.
 */
export function NewJoinersPanel({ joiners, chapter }) {
  return (
    <Section>
      <SectionTitle>Who else just joined</SectionTitle>
      {joiners?.length ? (
        <>
          <p className="mb-5 max-w-[620px] text-[0.98rem] text-body">
            People at {chapter} who joined recently. Tap a name to see their profile, and
            go to a lift with one of them.
          </p>
          <ul className="flex list-none flex-wrap gap-2">
            {joiners.map((j) => (
              <li key={j.id} className="rounded-full border border-edge bg-surface px-4 py-2">
                <UserChip userId={j.id} className="text-[0.95rem] font-medium text-ink">
                  {j.display_name}
                </UserChip>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Empty>
          Nobody else has joined at {chapter} recently. You are early, which is a fine
          thing to be.
        </Empty>
      )}
    </Section>
  );
}

/**
 * The first eight weeks, for somebody who has never trained.
 *
 * Deliberately not a program. NCBO is not writing anybody a training plan
 * through an app, and a generated one would be worse than the one their chapter
 * already runs. This is the shape of the first two months, so a beginner knows
 * what normal looks like and when to ask for something real.
 */
export function BeginnerPanel({ chapter, hasChapter }) {
  const weeks = [
    ['Weeks 1 to 2', 'Show up twice a week and learn the lifts with somebody watching. Nothing heavy.'],
    ['Weeks 3 to 4', 'Three sessions a week. Start writing down what you lifted.'],
    ['Weeks 5 to 6', 'Add weight where the last session felt easy. Eat enough protein.'],
    ['Weeks 7 to 8', 'You have a baseline now. This is the point to ask about a real program.'],
  ];

  return (
    <Section>
      <SectionTitle>Your first eight weeks</SectionTitle>
      <p className="mb-5 max-w-[620px] text-[0.98rem] text-body">
        {hasChapter
          ? `Not a program. ${chapter} runs one, and it will be better than anything an app writes for you. This is the shape of the first two months so you know what normal looks like.`
          : 'Not a program, and not a substitute for training with people. This is the shape of the first two months so you know what normal looks like.'}
      </p>
      <ol className="grid list-none gap-3 sm:grid-cols-2">
        {weeks.map(([label, text]) => (
          <li key={label}>
            <Card className="p-5">
              <p className="font-display text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-meta">
                {label}
              </p>
              <p className="mt-2 text-[0.98rem] text-body">{text}</p>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** The two league boards, as they were. */
export function LeaguePanel() {
  return (
    <Section band>
      <SectionTitle>The league</SectionTitle>
      <div className="grid gap-5 md:grid-cols-2">
        <DarkTile href="/hub/topics" Component={Link} kicker="Channels" title="Topics">
          Every chapter in one room. Short posts, named or anonymous.
        </DarkTile>
        <DarkTile href="/hub/qa" Component={Link} kicker="Ask the network" title="Q&amp;A">
          Advisors and the exec team answer. Answers stay on the board.
        </DarkTile>
      </div>
    </Section>
  );
}

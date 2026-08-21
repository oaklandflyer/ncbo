import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { Page, PageHero, Section, Card, Meta, Empty } from '@/app/ui';
import { Segmented, HowPointsWork, tabularNums } from '../segmented';
import ClubLogo from '@/app/brand/club-logo';

export const metadata = { title: 'Chapter Cup · NCBO' };

/* One colour per component, used by both the bar and its key, so the two
   cannot drift into meaning different things. */
const PARTS = [
  ['roster_points', 'Roster', '#2F5FA8'],
  ['stage_points', 'Stage', '#1B7F5A'],
  ['handler_points', 'Handling', '#B26A1F'],
  ['qa_points', 'Q&A', '#6B4E9B'],
];

export default async function ChapterCup() {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.signedIn) redirect('/login');
  if (!viewer.profile) return null;

  const { data: rows } = await supabase.rpc('get_chapter_cup_standings');
  const standings = (rows || []).filter((c) => c.total_points > 0);
  const myClub = viewer.membership?.clubId;

  return (
    <Page>
      <PageHero
        eyebrow="Rankings"
        title="Chapter Cup."
        lead="Four ways a chapter earns: showing up, competing, crewing for each other, and answering questions."
      >
        <div className="mt-8"><Segmented current="/rankings/clubs" /></div>
      </PageHero>

      <Section>
        {standings.length === 0 ? (
          <Empty>No chapter has scored yet this season.</Empty>
        ) : (
          <ol className="grid list-none gap-3">
            {standings.map((c) => (
              <li key={c.club_id}>
                <Card className={`p-5 ${c.club_id === myClub ? 'border-brand' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* items-center, not items-baseline: the logo is a box,
                        and a box has no baseline to sit on. */}
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="font-display text-[1.15rem] font-bold text-brand" style={tabularNums}>
                        {c.rank}
                      </span>
                      <ClubLogo club={c} size="md" />
                      <span className="truncate font-display text-[1.1rem] font-bold uppercase tracking-[0.02em] text-ink">
                        {c.chapter}
                      </span>
                    </span>
                    <span className="font-display text-[1.3rem] font-extrabold text-ink" style={tabularNums}>
                      {c.total_points}
                    </span>
                  </div>

                  {/* Full width, stacked, one segment per component. A chapter
                      can see at a glance whether it is winning on turnout or
                      on stage time, which is the only actionable thing a
                      leaderboard can tell anybody. */}
                  <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-band" aria-hidden>
                    {PARTS.map(([key, , colour]) => {
                      const value = c[key] || 0;
                      if (!value) return null;
                      return (
                        <span
                          key={key}
                          style={{ width: `${(value / c.total_points) * 100}%`, background: colour }}
                          className="h-full"
                        />
                      );
                    })}
                  </div>

                  <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                    {PARTS.map(([key, label, colour]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: colour }} />
                        <dt className="text-[0.82rem] text-meta">{label}</dt>
                        <dd className="text-[0.82rem] font-semibold text-ink" style={tabularNums}>
                          {c[key] || 0}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {/* Only shown when the cap actually bit. Saying "capped" on
                      every row would read as a penalty rather than a ceiling. */}
                  {c.qa_uncapped > c.qa_points && (
                    <Meta className="mt-2">
                      Q&A capped at {c.qa_points} of {c.qa_uncapped} earned, the 25% ceiling.
                    </Meta>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section>
        <HowPointsWork>
          <ul className="list-none">
            <li><b className="font-semibold text-ink">Roster</b> — 1 point per active member. Showing up and staying.</li>
            <li className="mt-2"><b className="font-semibold text-ink">Stage</b> — 5 per verified result, placing or not.</li>
            <li className="mt-2"><b className="font-semibold text-ink">Handling</b> — 2 per verified result you crewed for somebody else.</li>
            <li className="mt-2"><b className="font-semibold text-ink">Q&A</b> — 1 per upvote on an answer one of your members wrote.</li>
          </ul>
          <p className="mt-4">
            Q&A is capped at a quarter of a chapter&rsquo;s total. Answering is cheap and competing
            is not, so without a ceiling a chapter could win the Cup without anyone stepping on
            stage. It still pays, because the alternative tells members that helping is worthless.
          </p>
        </HowPointsWork>
      </Section>
    </Page>
  );
}

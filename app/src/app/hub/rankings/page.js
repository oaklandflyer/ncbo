import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import {
  Page, PageHero, Section, SectionTitle, Card, Badge, Meta, Empty, Stat, Stats, fineprint,
} from '@/app/ui';
import { UserChip } from '../profile-popup/popup';

export const metadata = { title: 'Rankings · NCBO' };

/**
 * National rankings.
 *
 * The one thing in this app that no chapter could build for itself, and the
 * reason somebody at Iowa opens it on a day when nobody else is online.
 *
 * Two things are stated on the page rather than left implicit, because a
 * leaderboard nobody understands is a leaderboard nobody trusts: how a result
 * becomes points, and why a chapter's score is its best five rather than its
 * total.
 */
export default async function Rankings({ searchParams }) {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.profile) redirect('/login');

  const params = await searchParams;
  const thisYear = new Date().getFullYear();
  const season = Number(params?.season) || thisYear;

  const [{ data: lifters }, { data: chapters }, { data: seasons }] = await Promise.all([
    supabase.from('national_rankings')
      .select('user_id, display_name, chapter, club_id, shows, points, best_placement, rank')
      .eq('season', season)
      .order('rank')
      .limit(100),
    supabase.from('chapter_rankings')
      .select('club_id, chapter, points, rank, shows, competing_members, scoring_members')
      .eq('season', season)
      .order('rank'),
    supabase.from('scored_results').select('season').order('season', { ascending: false }),
  ]);

  const availableSeasons = [...new Set((seasons || []).map((s) => s.season))];
  const me = (lifters || []).find((l) => l.user_id === viewer.userId);
  const myChapter = viewer.membership
    ? (chapters || []).find((c) => c.club_id === viewer.membership.clubId)
    : null;

  return (
    <Page>
      <PageHero
        eyebrow={`${season} season`}
        title="National rankings."
        lead="Every confirmed result across every chapter, in one table. This is the only scoreboard collegiate bodybuilding has."
      >
        {(me || myChapter) && (
          <div className="mt-9 max-w-2xl">
            <Stats>
              {me && <Stat value={me.rank} label="Your rank" />}
              {me && <Stat value={Math.round(me.points)} label="Your points" />}
              {myChapter && <Stat value={myChapter.rank} label={`${myChapter.chapter} rank`} />}
            </Stats>
          </div>
        )}
      </PageHero>

      {availableSeasons.length > 1 && (
        <Section>
          <ul className="flex list-none flex-wrap gap-2">
            {availableSeasons.map((s) => (
              <li key={s}>
                <a
                  href={`/hub/rankings?season=${s}`}
                  className={`inline-block rounded-full border border-edge px-4 py-2 font-display text-[0.75rem] font-semibold uppercase tracking-[0.12em] ${
                    s === season ? 'bg-brand text-white' : 'bg-surface text-meta hover:text-ink'
                  }`}
                >
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section>
        <SectionTitle count={chapters?.length ? `${chapters.length} chapters` : null}>
          Chapters
        </SectionTitle>
        <p className="mb-5 max-w-[620px] text-[0.98rem] text-body">
          A chapter scores its best five members, not its total. Adding up everybody would
          measure recruitment and call it competitiveness, and a chapter of nine that
          competes well should beat a chapter of ninety that does not.
        </p>

        {chapters?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b border-edge bg-band/60">
                  {['', 'Chapter', 'Points', 'Scoring', 'Competing', 'Shows'].map((h, i) => (
                    <th
                      key={h || i}
                      className="px-4 py-3 font-display text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-meta"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chapters.map((c) => (
                  <tr
                    key={c.club_id}
                    className={`border-b border-edge/70 last:border-0 ${
                      myChapter?.club_id === c.club_id ? 'bg-brand-wash/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-display text-[1rem] font-bold text-brand">{c.rank}</td>
                    <td className="px-4 py-3 font-display text-[1rem] font-bold uppercase text-ink">
                      {c.chapter}
                    </td>
                    <td className="px-4 py-3 font-display font-bold text-ink">{Math.round(c.points)}</td>
                    <td className="px-4 py-3 text-[0.92rem] text-body">{c.scoring_members}</td>
                    <td className="px-4 py-3 text-[0.92rem] text-body">{c.competing_members}</td>
                    <td className="px-4 py-3 text-[0.92rem] text-body">{c.shows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            No chapter has a confirmed result in {season} yet. Results are entered by the
            lifter and confirmed by their club lead.
          </Empty>
        )}
      </Section>

      <Section band>
        <SectionTitle count={lifters?.length ? `${lifters.length}` : null}>Lifters</SectionTitle>

        {lifters?.length ? (
          <ol className="grid list-none gap-2">
            {lifters.map((l) => (
              <li key={l.user_id}>
                <Card
                  className={`flex flex-wrap items-center gap-4 p-4 ${
                    l.user_id === viewer.userId ? 'border-brand' : ''
                  }`}
                >
                  <span className="w-8 shrink-0 font-display text-[1.15rem] font-bold text-brand">
                    {l.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <UserChip
                      userId={l.user_id}
                      className="font-display text-[1.02rem] font-bold uppercase tracking-[0.02em] text-ink"
                    >
                      {l.display_name}
                    </UserChip>
                    <Meta className="mt-1">
                      {l.chapter || 'Independent'}
                      {` · ${l.shows} show${l.shows === 1 ? '' : 's'}`}
                      {l.best_placement ? ` · best finish ${ordinal(l.best_placement)}` : ''}
                    </Meta>
                  </span>
                  {l.user_id === viewer.userId && <Badge tone="active">You</Badge>}
                  <span className="shrink-0 font-display text-[1.05rem] font-bold text-ink">
                    {Math.round(l.points)}
                  </span>
                </Card>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>
            No confirmed results in {season} yet. If you have competed, add it from the
            calendar and your club lead confirms it.
          </Empty>
        )}
      </Section>

      {/* Stated plainly, because a scoring system nobody can see is one nobody
          argues with, and one nobody argues with is one nobody trusts. */}
      <Section>
        <SectionTitle>How the points work</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <p className="font-display text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-meta">
              Placement
            </p>
            <p className="mt-2 text-[0.98rem] text-body">
              First is 100, second 85, third 72, then 61, 52 and 44. Seventh and below is 30,
              and competing without recording a placement is 20. The curve is steep at the top
              because the gap between first and second is real, and flat at the bottom because
              the gap between eighth and ninth is noise.
            </p>
          </Card>
          <Card className="p-5">
            <p className="font-display text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-meta">
              Then scaled
            </p>
            <p className="mt-2 text-[0.98rem] text-body">
              A regional show multiplies by 1.25 and a national by 1.6. A bigger class is worth
              more, up to 1.5 at forty competitors. An overall title adds 35 percent, because
              it is the whole show and not one class.
            </p>
          </Card>
        </div>
        <p className={`mt-4 ${fineprint}`}>
          Everyone who steps on stage scores something, because that is the thing the
          organisation exists to produce more of.
        </p>
      </Section>
    </Page>
  );
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

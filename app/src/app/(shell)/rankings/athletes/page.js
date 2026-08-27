import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { Page, PageHero, Section, Card, Badge, Meta, Empty } from '@/app/ui';
import { UserChip } from '@/app/hub/profile-popup/popup';
import { Segmented, HowPointsWork, tabularNums } from '../segmented';
import ClubLogo from '@/app/brand/club-logo';

export const metadata = { title: 'Athlete rankings · NCBO' };

export default async function AthleteRankings() {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.signedIn) redirect('/login');
  if (!viewer.profile) return null;

  const { data: rows } = await supabase.rpc('get_athlete_rankings');
  const lifters = rows || [];
  const me = lifters.find((l) => l.profile_id === viewer.userId);
  const meIsOffscreen = me && lifters.indexOf(me) > 9;

  return (
    <Page>
      <PageHero
        eyebrow="Rankings"
        title="Athletes."
        lead="Every verified result across every chapter, in one table. These are the results the Chapter Cup is scored from — the Cup is the competition, this is the detail behind it."
      >
        <div className="mt-8"><Segmented current="/rankings/athletes" /></div>
      </PageHero>

      <Section>
        {lifters.length === 0 ? (
          <Empty>
            No verified results yet. Log one from the Log tab and your club lead verifies it.
          </Empty>
        ) : (
          <ol className="grid list-none gap-2">
            {lifters.map((l) => (
              <li key={l.profile_id}>
                <Card className={`flex flex-wrap items-center gap-4 p-4 ${
                  l.profile_id === viewer.userId ? 'border-brand' : ''
                }`}>
                  <span className="w-8 shrink-0 font-display text-[1.15rem] font-bold text-brand" style={tabularNums}>
                    {l.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <UserChip userId={l.profile_id} className="font-display text-[1.02rem] font-bold uppercase tracking-[0.02em] text-ink">
                      {l.display_name}
                    </UserChip>
                    {/* The mark sits with the chapter name, not with the
                        athlete's: this line is where the row says which club
                        they lift for. `club_logo` comes back from the ranking
                        RPC itself, off a join it was already making, so this
                        costs no query per row. */}
                    <Meta className="mt-1 flex items-center gap-1.5">
                      {l.chapter && <ClubLogo club={l} size="xs" />}
                      <span className="min-w-0 truncate">
                        {l.chapter || 'Independent'}
                        {` · ${l.entries} show${l.entries === 1 ? '' : 's'}`}
                        {l.best_placing !== 'DNP' ? ` · best ${l.best_placing}` : ''}
                      </span>
                    </Meta>
                  </span>
                  {l.profile_id === viewer.userId && <Badge tone="active">You</Badge>}
                  <span className="shrink-0 font-display text-[1.05rem] font-bold text-ink" style={tabularNums}>
                    {l.points}
                  </span>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section>
        <HowPointsWork>
          <p>
            1st is 10 points, then 8, 6, 4 and 2 down to fifth. Winning the overall adds 5. A DNP
            scores nothing individually, which is the one part worth arguing with: stepping on
            stage still earns your chapter 5 points on the Chapter Cup, whatever the placing.
          </p>
          <p className="mt-3">
            Only verified results count. Your club lead verifies them, and nobody verifies their own.
          </p>
        </HowPointsWork>
      </Section>

      {/* The member's own row, pinned where they will see it. Scrolling a
          national table to find yourself is the thing people actually open
          this page to do. */}
      {meIsOffscreen && (
        <div className="fixed inset-x-0 bottom-[64px] z-[120] border-t border-edge bg-surface/95 px-5 py-3 backdrop-blur-[8px] lg:hidden">
          <div className="flex items-center gap-4">
            <span className="w-8 font-display text-[1.05rem] font-bold text-brand" style={tabularNums}>{me.rank}</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">You</span>
            <span className="font-display font-bold text-ink" style={tabularNums}>{me.points}</span>
          </div>
        </div>
      )}
    </Page>
  );
}

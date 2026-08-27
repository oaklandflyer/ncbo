import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/viewer';
import { Page, PageHero, Section, SectionTitle, Card, Meta, Empty, btnGhost, btnSmall } from '@/app/ui';

export const metadata = { title: 'Clubs · NCBO' };

/**
 * Every chapter, and the way into each one's screens.
 *
 * The links carry `?club=`, which is the same scope the switcher writes. An
 * admin lands on the lead's own screen for that chapter rather than an
 * admin-only variant of it.
 */
export default async function AdminClubs() {
  const supabase = await createClient();
  const viewer = await getViewerContext(supabase);
  if (!viewer.signedIn) redirect('/login');
  if (!viewer.profile) return null;
  if (!viewer.isAdmin) redirect('/hub');

  const { data: clubs } = await supabase
    .from('club_directory')
    .select('id, club_name, short_name, school_name, status, member_count, pending_count, approver_count, orphan_lead_count')
    .order('short_name');

  return (
    <Page>
      <PageHero
        eyebrow="Admin"
        title="Chapters."
        lead="Every club, its headcount, and whether it has enough approvers to admit anybody."
      />
      <Section>
        <SectionTitle count={clubs?.length || null}>All chapters</SectionTitle>
        {clubs?.length ? (
          <ul className="grid list-none gap-3">
            {clubs.map((c) => (
              <li key={c.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="font-display text-[1.08rem] font-bold uppercase tracking-[0.02em] text-ink">
                      {c.short_name || c.club_name}
                    </span>
                    <Meta>
                      {c.member_count} member{c.member_count === 1 ? '' : 's'}
                      {c.pending_count > 0 && ` · ${c.pending_count} waiting`}
                    </Meta>
                  </div>
                  <Meta className="mt-1">{c.school_name} · {c.status}</Meta>

                  {/* The seeded names, and the ones deleted accounts left
                      behind. The directory already hides them; this is how an
                      admin finds the chapters that still carry them, since a
                      hidden row is by definition not visible where the bug was
                      reported. */}
                  {c.orphan_lead_count > 0 && (
                    <p className="mt-3 rounded-[6px] border-l-[3px] border-l-edge bg-band px-3 py-2 text-[0.92rem] text-body">
                      {c.orphan_lead_count} lead {c.orphan_lead_count === 1 ? 'entry names' : 'entries name'}
                      {' '}somebody with no live account. Hidden from the directory; clear
                      {' '}{c.orphan_lead_count === 1 ? 'it' : 'them'} in Settings.
                    </p>
                  )}

                  {c.approver_count <= 1 && (
                    <p className="mt-3 rounded-[6px] border-l-[3px] border-l-danger bg-band px-3 py-2 text-[0.92rem] text-body">
                      {c.approver_count === 0
                        ? 'No approvers. Nobody can admit a member here until you appoint one.'
                        : 'One approver. When they graduate this chapter freezes.'}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link className={`${btnGhost} ${btnSmall}`} href={`/club/entries?club=${c.id}`}>Results</Link>
                    <Link className={`${btnGhost} ${btnSmall}`} href={`/club/roster?club=${c.id}`}>Roster</Link>
                    <Link className={`${btnGhost} ${btnSmall}`} href={`/club/settings?club=${c.id}`}>Settings</Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No chapters yet.</Empty>
        )}
      </Section>
    </Page>
  );
}

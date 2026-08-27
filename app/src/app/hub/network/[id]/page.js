import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getProfileResult } from '@/lib/supabase/server';
import { loadPublicProfile } from '@/app/hub/profile-popup/read';
import { affiliationLabel, badgesFor, clubRoleLabel, phaseLabel } from '@/lib/membership';
import { academicLevelLabel } from '@/lib/academicYear';
import Avatar from '@/app/brand/avatar';
import {
  Page, PageHero, Section, SectionTitle, Card, Badge, Meta, Empty,
  VettedSeal, Credentials, SocialLinks, AlumniBadge, BackLink,
} from '@/app/ui';

/**
 * A member's full profile, as a page.
 *
 * This is where "View full profile" goes. It used to link to
 * `/hub/network?member=<id>`, and nothing anywhere read that parameter: the
 * popup closed, the directory reloaded, and the member landed on an unchanged
 * list of everybody. The link was not broken in the sense of erroring — it
 * navigated perfectly well to a page that ignored it, which is the shape of
 * bug that gets reported as "the button does nothing".
 *
 * A route rather than a second modal, because the whole point of "full" is
 * that it is more than the popup: the complete competition history rather than
 * the first five, and an address somebody can send to a club lead.
 *
 * The read is the same `get_public_profile()` the popup uses — one fixed
 * projection, enforced in Postgres, so this page cannot show a field the popup
 * is not allowed to.
 */
export async function generateMetadata({ params }) {
  const { id } = await params;
  const { profile } = await loadPublicProfile(id);
  return { title: profile?.display_name ? `${profile.display_name} · NCBO` : 'Profile · NCBO' };
}

export default async function MemberProfile({ params }) {
  const { id } = await params;

  const supabase = await createClient();
  const { signedIn, profile: viewer } = await getProfileResult(supabase);
  /* Layout and page render in parallel, so this page runs even when the layout
     is about to show the schema error. Redirecting here would win that race and
     send a signed-in member back to /login, which is the loop that whole change
     exists to remove. Render nothing and let the layout explain. */
  if (!signedIn) redirect('/login');
  if (!viewer) return null;

  const { profile: person, history = [], error } = await loadPublicProfile(id);

  if (error || !person) {
    return (
      <Page>
        <PageHero eyebrow="The network" title="No such member.">
          <div className="mt-6">
            <BackLink href="/hub/network" Component={Link}>Back to the network</BackLink>
          </div>
        </PageHero>
        <Section>
          <Empty>{error || 'That member is no longer on the network.'}</Empty>
        </Section>
      </Page>
    );
  }

  const isMe = person.id === viewer.id;

  /* Every fact the projection carries, minus the empty ones. Absent rather
     than rendered as "—": a blank row reads as a fact somebody withheld, when
     the truth is only that nobody asked for it. */
  const facts = [
    ['Experience', phaseLabel(person.experience_phase)],
    ['Division', person.division],
    ['Hometown', person.home_region],
    ['Level', academicLevelLabel(person.academic_level)],
    ['Role at chapter', person.club_role ? clubRoleLabel(person.club_role) : null],
    ['Chapter', person.club_name],
    ['College', person.university_name],
  ].filter(([, value]) => value);

  return (
    <Page>
      <PageHero
        eyebrow={affiliationLabel({ university_short_name: person.university_short_name })}
        title={person.display_name || 'Member'}
      >
        <div className="mt-6">
          <BackLink href="/hub/network" Component={Link}>Back to the network</BackLink>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-5">
          <Avatar name={person.display_name} size="lg" tone="raised" />
          <div className="min-w-0">
            <Meta>
              {affiliationLabel({ university_short_name: person.university_short_name })}
              {person.grad_year ? ` · Class of ${person.grad_year}` : ''}
            </Meta>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isMe && <Badge tone="active">You</Badge>}
              {person.is_verified && <Badge tone="active">Verified member</Badge>}
              {badgesFor(person).map((b) => <Badge key={b}>{b}</Badge>)}
              {person.is_alumni && <AlumniBadge />}
              {person.vetted_coach && <VettedSeal />}
            </div>
          </div>
        </div>

        {person.credentials?.length > 0 && (
          <div className="mt-5"><Credentials items={person.credentials} /></div>
        )}

        <SocialLinks
          className="mt-5"
          instagram={person.instagram_handle}
          tiktok={person.tiktok_handle}
        />
      </PageHero>

      {facts.length > 0 && (
        <Section>
          <SectionTitle>Details</SectionTitle>
          <Card className="p-5 sm:p-6">
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-meta">
                    {label}
                  </dt>
                  <dd className="mt-1 text-[0.98rem] text-body">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </Section>
      )}

      {/* The whole history here, where the popup showed five. That difference
          is what makes this page worth navigating to. */}
      <Section band>
        <SectionTitle count={history.length ? `${history.length}` : null}>
          Competition history
        </SectionTitle>

        {history.length > 0 ? (
          <ul className="grid list-none gap-2">
            {history.map((h, i) => (
              <li key={`${h.competition_name}-${h.starts_on}-${i}`}>
                <Card className="flex items-baseline justify-between gap-4 p-4">
                  <span className="min-w-0">
                    <span className="block truncate font-display text-[1rem] font-bold uppercase tracking-[0.02em] text-ink">
                      {h.competition_name}
                    </span>
                    <Meta className="mt-1">
                      {new Date(`${h.starts_on}T12:00:00`).getFullYear()}
                      {h.division ? ` · ${h.division}` : ''}
                      {h.federation ? ` · ${h.federation}` : ''}
                    </Meta>
                  </span>
                  <span className="shrink-0 font-display text-[0.95rem] font-bold text-ink">
                    {h.is_overall ? 'Overall' : h.placement ? `${h.placement}` : 'Competed'}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          /* Not "no results": that implies this person entered a show and did
             not place, which is a different claim from having not competed. */
          <Empty>
            {isMe
              ? 'You have no verified results yet. Add one from the calendar and your club lead confirms it.'
              : 'No verified results yet.'}
          </Empty>
        )}
      </Section>
    </Page>
  );
}

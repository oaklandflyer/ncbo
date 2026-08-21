import { redirect } from 'next/navigation';
import { createClient, getProfile } from '@/lib/supabase/server';
import { isModerator } from '@/lib/review';
import Link from 'next/link';
import {
  Page, PageHero, Section, SectionTitle, Card, Stat, Stats, Badge, Meta,
  VettedSeal, Credentials, SocialLinks, AlumniBadge, fineprint, btnGhost, btnSmall,
} from '@/app/ui';
import SignOut from '../sign-out';

/**
 * The member's own record — the fifth destination on the phone's tab bar, and
 * reachable from the avatar in the header.
 *
 * Every field below is one the database actually holds. The prototype's
 * profile screen also carries a rank, a check-in count and a preferences
 * switch; none of those exist in the schema, and inventing a zero to fill the
 * space would be worse than leaving it out. See the PR for what each would
 * need.
 */
export default async function Profile() {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  if (!profile) redirect('/login');

  const initials = String(profile.display_name || 'M')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase() || 'M';

  const roleLabel = profile.role === 'member' ? 'Member' : profile.role.replace('_', ' ');

  /* The moderation queue's one entry point. Advisors and admins only —
     matching `is_moderator()`, which is what the database checks; a club lead
     reviews accounts, which is a different queue on a different table.
     
     The count is only asked for by someone who can act on it, and a failed
     count renders the entry point without a number rather than taking the
     profile page down with it. */
  const moderates = isModerator(profile);
  let pending = null;
  if (moderates) {
    const { count, error } = await supabase
      .from('question_feed')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    pending = error ? null : (count || 0);
  }

  /* A key-value table, not a form: nothing here is editable yet. Onboarding
     collected it, and an admin moves anyone between schools or clubs. */
  const facts = [
    ['College', profile.schools?.name],
    ['Club', profile.clubs?.name],
    ['Email', profile.email],
    ['Home region', profile.home_region],
    ['Instagram', profile.instagram_handle && `@${profile.instagram_handle}`],
    ['TikTok', profile.tiktok_handle && `@${profile.tiktok_handle}`],
    ['Division', profile.division],
    ['Class year', profile.class_year],
  ].filter(([, value]) => value);

  return (
    <Page>
      <PageHero eyebrow={profile.schools?.name || 'NCBO'} title="Your profile.">
        <div className="mt-7 flex flex-wrap items-center gap-5">
          <span
            aria-hidden
            className="grid h-20 w-20 shrink-0 place-items-center rounded-full border border-edge bg-surface font-display text-[1.6rem] font-extrabold tracking-[0.04em] text-brand-deep shadow-brand-sm"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="font-display text-[1.5rem] font-extrabold uppercase leading-none text-ink">
              {profile.display_name}
            </p>
            <Meta className="mt-2">
              <Badge tone="active">{roleLabel}</Badge>
              {profile.verified && <VettedSeal />}
              {profile.is_alumni && <AlumniBadge since={profile.alumni_since} />}
            </Meta>
            {profile.credentials?.length > 0 && (
              <div className="mt-3"><Credentials items={profile.credentials} /></div>
            )}

            <SocialLinks
              className="mt-3"
              instagram={profile.instagram_handle}
              tiktok={profile.tiktok_handle}
            />
          </div>
        </div>

        {(profile.class_year || profile.division) && (
          <div className="mt-8 max-w-lg">
            <Stats>
              {profile.division && <Stat value={profile.division} label="Division" isText />}
              {profile.class_year && <Stat value={profile.class_year} label="Class year" isText />}
            </Stats>
          </div>
        )}
      </PageHero>

      {moderates && (
        <Section>
          <SectionTitle>Moderation</SectionTitle>
          <Link
            href="/hub/qa#queue"
            className="group flex items-center justify-between gap-4 rounded-[8px] border border-edge bg-surface p-5 transition duration-200 hover:-translate-y-[3px] hover:border-brand-deep hover:shadow-brand focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand-light sm:p-6"
          >
            <span className="min-w-0">
              <span className="block font-display text-[1.15rem] font-extrabold uppercase leading-none text-ink transition group-hover:text-brand">
                Moderation Queue
              </span>
              <span className={`mt-2 block ${fineprint}`}>
                {pending === null
                  ? 'Questions waiting on an advisor before they reach the board.'
                  : pending > 0
                    ? `${pending} question${pending === 1 ? '' : 's'} waiting to be approved or rejected.`
                    : 'Nothing waiting. New questions land here before they reach the board.'}
              </span>
            </span>

            {/* The same pill the rest of the app uses for a count, not a
                second badge component. Absent at zero — a "0" is a number
                nobody needs to read. */}
            <span className="flex shrink-0 items-center gap-3">
              {pending > 0 && <Badge tone="active">{pending} waiting</Badge>}
              <span aria-hidden className="text-meta transition group-hover:translate-x-[3px] group-hover:text-brand">→</span>
            </span>
          </Link>
        </Section>
      )}

      <Section>
        <SectionTitle
          action={
            <Link className={`${btnGhost} ${btnSmall} bg-surface`} href="/hub/profile/edit">
              Edit profile
            </Link>
          }
        >
          Your details
        </SectionTitle>

        {/* Stacked rows rather than a table: two columns of short values read
            the same at every width and never need a horizontal scroll. */}
        <Card className="p-0 sm:p-0">
          <dl className="m-0">
            {facts.map(([label, value], i) => (
              <div
                key={label}
                className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-4 ${
                  i > 0 ? 'border-t border-edge' : ''
                }`}
              >
                <dt className="font-display text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-meta">
                  {label}
                </dt>
                <dd className="min-w-0 text-right text-[1rem] text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <p className={`mt-4 ${fineprint}`}>
          Your email is never shown to other members. Ask an admin to change your school,
          club or role.
        </p>

        <div className="mt-8 md:hidden">
          <SignOut />
        </div>
      </Section>
    </Page>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOut from './sign-out';

/**
 * The hub's top bar, built to match nav.site-nav on thencbo.org: fixed, a
 * translucent white ground with a blur, crest and wordmark on the left, small
 * uppercase links, a steel underline under the current page, and a steel CTA
 * in the last slot.
 *
 * Below the desktop breakpoint it compacts: the wordmark, the member's role
 * and school on one small line, and their avatar. Navigation moves to the
 * bottom tab bar, so the bar carries identity rather than links and the
 * hamburger panel it used to open is gone — one destination per tap, and
 * where you are stays visible.
 *
 * Client-side only so the current route can be underlined. It reads the
 * pathname and nothing else — the layout has already decided who gets here.
 */
const LINKS = [
  ['/hub', 'Home'],
  ['/hub/network', 'Network'],
  ['/hub/topics', 'Topics'],
  ['/hub/qa', 'Q&A'],
  ['/hub/resources', 'Vault'],
];

/**
 * The signed-in member's institution, next to NCBO's own mark.
 *
 * The crest is a container, not an image: university crests and wordmarks are
 * trademarks, and we don't have permission to reproduce any of them yet. It
 * holds the final dimensions and shows the school's initials until a licensed
 * file exists, so swapping one in is a src, not a layout change.
 *
 * Nothing here loads client-side — the layout already has the profile, so the
 * bar renders complete on the server and has no intermediate state to flicker
 * through. A member with no school (staff on `allowed_emails`, or a .edu we
 * don't recognise yet) renders no divider and no gap at all.
 */
function Institution({ school }) {
  if (!school) return null;

  /* "University of Pittsburgh" → PI, "Penn State University" → PS. Two
     characters either way, so the box never has to resize around its
     contents — this is a placeholder standing in for a crest, not a
     wordmark of its own. */
  const words = school
    .replace(/^(the)\s+/i, '')
    .replace(/\b(university|college|of|at|state)\b/gi, ' ')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w));
  const named = words.length ? words : school.split(/\s+/).filter(Boolean);
  const initials = (named.length > 1
    ? named.slice(0, 2).map((w) => w[0]).join('')
    : (named[0] || school).slice(0, 2)
  ).toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden className="h-7 w-px shrink-0 bg-edge" />

      {/* Fixed 32px box whether or not it ends up holding an image, so the
          bar's height and rhythm don't move when crests arrive. */}
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border border-edge bg-band font-display text-[0.72rem] font-bold tracking-[0.06em] text-brand-deep"
      >
        {initials}
      </span>

      {/* The name appears only at lg. Below that it either fights the links
          for room (at md it truncates to "U..", which says nothing) or leaves
          no room for the toggle. It still reaches a screen reader at every
          width through the span below. */}
      <span className="hidden min-w-0 truncate font-display text-[0.86rem] font-semibold uppercase tracking-[0.12em] text-meta lg:block">
        {school}
      </span>
      <span className="sr-only lg:hidden">{school}</span>
    </div>
  );
}

/** Role and school, the phone's one line of context: "MEMBER · PITT". */
function Standing({ role, school }) {
  const shortSchool = (school || '')
    .replace(/^(the)\s+/i, '')
    .replace(/\b(university|college|institute)\b/gi, '')
    .replace(/\bof\b/gi, '')
    .trim()
    .split(/\s+/)[0];

  const label = [role.replace('_', ' '), shortSchool].filter(Boolean).join(' · ');

  return (
    <span className="truncate font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-meta">
      {label}
    </span>
  );
}

export default function HubNav({ canReview, manages, isClubLead = false, school, role = 'member', name = '', logo = '/ncbo-crest.webp' }) {
  const pathname = usePathname() || '';

  /* Two different jobs, two different links: a lead runs their club's roster,
     an admin runs the organisation. Someone who is both gets both. */
  const links = [
    ...LINKS,
    ...(isClubLead ? [['/hub/roster', 'Roster']] : []),
    ...(canReview ? [['/hub/admin', manages ? 'Admin' : 'Review']] : []),
  ];
  const isCurrent = (href) => (href === '/hub' ? pathname === '/hub' : pathname.startsWith(href));

  /* Initials, not a photo: there is no avatar upload in the schema, and a
     generic silhouette says less than someone's own initials do. */
  const initials = String(name || 'M')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase() || 'M';

  return (
    <>
    <nav
      aria-label="Member hub"
      className="fixed inset-x-0 top-0 z-[200] border-b border-edge bg-white/90 shadow-brand-sm backdrop-blur-[12px]"
    >
      <div className="mx-auto flex h-[60px] w-full max-w-[1180px] items-center gap-4 px-5 sm:px-8 md:h-nav lg:px-12">
        {/* min-h on the phone: this is a navigation target too, and 32px of
            wordmark is under the size a fingertip actually is. */}
        <Link href="/hub" className="flex min-h-[44px] shrink-0 items-center gap-[0.65rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={40} height={40} className="h-8 w-8 object-contain md:h-10 md:w-10" />
          <span className="font-display text-[1.15rem] font-extrabold tracking-[0.16em] text-ink md:text-[1.4rem]">
            NCBO
          </span>
        </Link>

        <span className="hidden md:contents"><Institution school={school} /></span>

        {/* ── desktop ─────────────────────────────────────────────────── */}
        <ul className="ml-auto hidden shrink-0 list-none items-center gap-[1.4rem] md:flex">
          {links.map(([href, label]) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isCurrent(href) ? 'page' : undefined}
                className={`relative block py-1 font-display text-[0.88rem] font-semibold uppercase tracking-[0.14em] transition-colors ${
                  isCurrent(href)
                    ? 'text-ink after:absolute after:inset-x-0 after:-bottom-[2px] after:h-[2px] after:bg-brand after:content-[""]'
                    : 'text-meta hover:text-ink'
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-4 hidden md:block">
          <SignOut />
        </div>

        {/* ── mobile ──────────────────────────────────────────────────── */}
        {/* The tab bar is the navigation down here, so this end of the bar is
            identity: who you are, where you're from, and the way through to
            your own profile. */}
        <Link
          href="/hub/profile"
          className="ml-auto flex min-h-[44px] items-center gap-3 md:hidden"
          aria-label="Your profile"
        >
          <span className="flex min-w-0 flex-col items-end leading-tight">
            <Standing role={role} school={school} />
          </span>
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-edge bg-band font-display text-[0.78rem] font-bold tracking-[0.04em] text-brand-deep"
          >
            {initials}
          </span>
        </Link>
      </div>

    </nav>

    </>
  );
}

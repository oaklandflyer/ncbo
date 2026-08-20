/**
 * The hub's visual language, lifted from the public site.
 *
 * Every value here traces to assets/styles.css so the app reads as the same
 * product as thencbo.org rather than an admin panel bolted to its side:
 *
 *   ground #F4F8FD · band #E8F0FA · card #FFFFFF · hairline #D2E0F0
 *   steel  #2F5FA8 · ink #0E1A2F  · body #3E4E68
 *   Barlow Condensed 800 uppercase display · Barlow body at 17px
 *   8px radius · lift-on-hover cards · pill badges · steel-ruled stats
 *
 * The site is light with deep navy photo blocks as its accent, so the page
 * headers here invert the same way its interior heroes do.
 */

/* ── page shell ───────────────────────────────────────────────────────── */

/** Matches .wrap: 1180px, fluid gutters. */
export const wrap = 'mx-auto w-full max-w-[1180px] px-5 sm:px-8 lg:px-12';

export function Page({ children }) {
  return <div className="pb-24">{children}</div>;
}

/** Matches .section: generous vertical rhythm, not app-panel cramped. */
export function Section({ children, band = false, className = '', id }) {
  return (
    <section id={id} className={`${band ? 'border-y border-edge bg-band' : ''} py-10 sm:py-14 ${className}`}>
      <div className={wrap}>{children}</div>
    </section>
  );
}

/** Matches .eyebrow — the 26px steel rule is the site's signature. */
export function Eyebrow({ children, onDark = false }) {
  return (
    <p
      className={`flex items-center gap-3 font-display text-[0.8rem] font-semibold uppercase tracking-[0.3em] ${
        onDark ? 'text-onphoto-soft' : 'text-brand'
      }`}
    >
      <span aria-hidden className={`h-px w-[26px] ${onDark ? 'bg-onphoto-soft' : 'bg-brand'}`} />
      {children}
    </p>
  );
}

/**
 * The interior page hero, straight off the marketing site's .page-hero: the
 * band ground, a steel radial bloom from the top right, the crest watermark
 * at 6%, and a hairline underneath.
 */
export function PageHero({ eyebrow, title, lead, children, actions }) {
  return (
    <header className="relative overflow-hidden border-b border-edge bg-band">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 100% at 80% 0%, rgba(47,95,168,0.10), transparent 60%)',
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        aria-hidden
        alt=""
        src="/ncbo-crest.webp"
        className="pointer-events-none absolute right-[-9%] top-1/2 hidden w-[clamp(280px,28vw,420px)] -translate-y-1/2 opacity-[0.05] lg:block"
      />
      <div className={`relative z-10 ${wrap} pb-10 pt-9 sm:pb-14 sm:pt-12`}>
        {/* Actions sit against the headline, not after the body — trailing
            them below the stats leaves a stray chip floating mid-page. */}
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div className="min-w-0 max-w-[760px]">
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <h1 className="mt-4 font-display text-[clamp(2.1rem,5vw,3.6rem)] font-extrabold uppercase leading-[0.94] tracking-[0.005em] text-ink">
              {title}
            </h1>
            {lead && <p className="mt-4 max-w-[620px] text-[1.05rem] leading-relaxed text-body">{lead}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-3 pt-2">{actions}</div>}
        </div>
        {children}
      </div>
    </header>
  );
}

/** Section heading inside a page — display face, ruled like the site's h2s. */
export function SectionTitle({ children, count, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-edge pb-3">
      <h2 className="flex items-baseline gap-3 font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold uppercase leading-none text-ink">
        {children}
        {count != null && (
          <span className="font-body text-[0.82rem] font-normal uppercase tracking-[0.08em] text-meta">
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  );
}

/* ── cards ────────────────────────────────────────────────────────────── */

const CARD = 'rounded-[8px] border border-edge bg-surface';
const LIFT =
  'transition duration-200 hover:-translate-y-[3px] hover:border-brand-deep hover:shadow-brand';

export function Card({ children, className = '' }) {
  return <div className={`${CARD} p-6 sm:p-7 ${className}`}>{children}</div>;
}

/** A card that is a link. Whole tile is the target. */
export function CardLink({ href, children, className = '', Component }) {
  const El = Component || 'a';
  return (
    <El
      href={href}
      className={`${CARD} ${LIFT} group block p-6 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand-light sm:p-7 ${className}`}
    >
      {children}
    </El>
  );
}

/**
 * The inverted tile — the site's one dark surface, used here for the two
 * league destinations so the boards carry the weight the CTA tiles have on
 * the home page.
 */
export function DarkTile({ href, kicker, title, children, Component }) {
  const El = Component || 'a';
  return (
    <El
      href={href}
      className="group relative isolate flex min-h-[190px] flex-col justify-end overflow-hidden rounded-[8px] p-7 text-onphoto focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand-light"
      style={{
        background:
          'radial-gradient(ellipse 80% 70% at 15% 100%, rgba(47,95,168,0.55), transparent 65%), linear-gradient(160deg, #14264A 0%, #0E1A2F 60%, #0A1424 100%)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 -z-10 transition duration-300 group-hover:bg-brand/15"
      />
      <span className="font-display text-[0.74rem] font-semibold uppercase tracking-[0.2em] text-onphoto-accent">
        {kicker}
      </span>
      <span className="mt-2 font-display text-[1.9rem] font-extrabold uppercase leading-none">
        {title}
      </span>
      <span className="mt-2 text-[0.96rem] text-onphoto-soft">{children}</span>
      <span className="mt-4 inline-flex items-center gap-2 font-display text-[0.82rem] font-bold uppercase tracking-[0.12em] text-onphoto-accent">
        Open
        <span aria-hidden className="transition group-hover:translate-x-[5px]">→</span>
      </span>
    </El>
  );
}

/** Matches .stat: a steel rule down the left, display numeral, small label. */
export function Stat({ value, label, isText = false }) {
  return (
    <div className="border-l-2 border-brand pl-4">
      <span
        className={`block font-display font-extrabold leading-[1.05] text-ink ${
          isText ? 'text-[1.5rem]' : 'text-[2.4rem]'
        }`}
      >
        {value}
      </span>
      <span className="text-[0.82rem] uppercase tracking-[0.08em] text-meta">{label}</span>
    </div>
  );
}

export function Stats({ children }) {
  return (
    <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
      {children}
    </div>
  );
}

/* ── small parts ──────────────────────────────────────────────────────── */

const BADGES = {
  active: 'bg-brand-wash text-brand-deep border-[rgba(47,95,168,0.35)]',
  forming: 'bg-[rgba(86,101,128,0.08)] text-dim border-edge',
  onDark: 'border-white/25 bg-white/10 text-onphoto-soft',
  /* Waiting on a person. Reads as held rather than wrong, so it takes the
     raised well rather than danger — a question in the queue is not an error. */
  pending: 'bg-raised text-body border-edge',
  /* A fact the organisation is asserting: the band ground and the deep steel
     text, one step firmer than `active` without becoming a second brand. */
  credential: 'bg-band text-brand-deep border-edge',
};

/** Matches .badge — pill, display face, tight tracking. */
export function Badge({ tone = 'forming', children }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-[0.65rem] py-[0.28rem] font-display text-[0.68rem] font-bold uppercase tracking-[0.1em] ${BADGES[tone] || BADGES.forming}`}
    >
      {children}
    </span>
  );
}

/**
 * The NCBO Vetted seal.
 *
 * Deliberately the same pill geometry as Badge, with the shield ahead of the
 * label: it has to read as part of the same family, not as a sticker. The
 * caller decides whether a profile has earned it — this component draws it and
 * nothing more, so a seal can never appear without the data behind it.
 */
export function VettedSeal({ label = 'NCBO Vetted' }) {
  return (
    <span
      role="img"
      aria-label={`${label} — verified by NCBO`}
      className="inline-flex items-center gap-[0.4rem] whitespace-nowrap rounded-full border border-[rgba(47,95,168,0.35)] bg-brand-wash px-[0.65rem] py-[0.28rem] font-display text-[0.68rem] font-bold uppercase tracking-[0.1em] text-brand-deep"
    >
      <svg aria-hidden width="12" height="14" viewBox="0 0 24 28" fill="none">
        <path
          d="M12 1.5 22 5.2v8.3c0 6.1-4.1 11.3-10 13-5.9-1.7-10-6.9-10-13V5.2L12 1.5Z"
          fill="currentColor" opacity="0.14"
        />
        <path
          d="M12 1.5 22 5.2v8.3c0 6.1-4.1 11.3-10 13-5.9-1.7-10-6.9-10-13V5.2L12 1.5Z"
          stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
        />
        <path
          d="m7.5 13.6 3.2 3.2 6-6.4"
          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
      {label}
    </span>
  );
}

/**
 * Federation credentials, straight from the profile's `credentials` column.
 * The column is a Postgres enum array an admin controls, so there is no
 * sanitising to do here — the vocabulary is the guarantee.
 */
export function Credentials({ items }) {
  if (!items?.length) return null;
  return (
    <>
      {items.map((c) => <Badge key={c} tone="credential">{c}</Badge>)}
    </>
  );
}

export function Meta({ children, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.85rem] text-meta ${className}`}>
      {children}
    </div>
  );
}

export function Empty({ children }) {
  return (
    <div className="rounded-[8px] border border-dashed border-edge bg-raised/50 px-6 py-12 text-center text-[0.97rem] text-meta">
      {children}
    </div>
  );
}

/** Back link, styled like the site's small uppercase nav text. */
export function BackLink({ href, children, Component }) {
  const El = Component || 'a';
  return (
    <El
      href={href}
      className="inline-flex items-center gap-2 font-display text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-meta transition hover:text-brand"
    >
      <span aria-hidden>←</span>
      {children}
    </El>
  );
}

/* ── buttons and forms, matching .btn / input styling ─────────────────── */

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-[8px] border border-transparent bg-brand px-[1.7rem] py-[0.85rem] font-display text-[0.92rem] font-bold uppercase tracking-[0.12em] text-white transition duration-200 hover:-translate-y-[2px] hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand-light disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0';

export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-[8px] border border-edge bg-transparent px-[1.7rem] py-[0.85rem] font-display text-[0.92rem] font-bold uppercase tracking-[0.12em] text-ink transition duration-200 hover:-translate-y-[2px] hover:border-brand hover:text-brand-light focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand-light disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0';

export const btnSmall = 'px-[1.1rem] py-[0.55rem] text-[0.8rem]';

export const fieldLabel =
  'mb-2 block font-display text-[0.78rem] font-semibold uppercase tracking-[0.2em] text-brand';

export const field =
  'w-full rounded-[8px] border border-edge bg-surface px-4 py-3 text-[1rem] text-ink placeholder:text-fine focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15';

export const checkline =
  'inline-flex cursor-pointer select-none items-center gap-2 text-[0.88rem] text-body hover:text-ink';

export function FormMessage({ error, ok }) {
  if (!error && !ok) return null;
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={`mt-3 text-[0.88rem] ${error ? 'text-danger' : 'text-brand-deep'}`}
    >
      {error || ok}
    </p>
  );
}

/* ── signed-out pages ─────────────────────────────────────────────────── */

/**
 * The shell for /login and /onboarding: the site's light ground, a centred
 * white card on the band, the crest above it. These are the first screens
 * anyone sees, so they carry the brand rather than looking like a form.
 */
export function AuthPage({ children, wide = false }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-page px-5 py-14 font-body text-[17px] leading-relaxed text-ink antialiased sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 0%, rgba(47,95,168,0.10), transparent 65%)',
        }}
      />
      <div className={`relative z-10 w-full ${wide ? 'max-w-[680px]' : 'max-w-[480px]'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ncbo-crest.webp"
          alt="NCBO"
          width={64}
          height={64}
          className="mx-auto mb-7 h-16 w-16"
        />
        <div className="rounded-[8px] border border-edge bg-surface p-7 shadow-brand sm:p-10">
          {children}
        </div>
      </div>
    </main>
  );
}

/** Centred eyebrow + display headline, for the auth cards. */
export function AuthHeading({ eyebrow, children }) {
  return (
    <>
      {eyebrow && (
        <p className="flex items-center justify-center gap-3 font-display text-[0.78rem] font-semibold uppercase tracking-[0.3em] text-brand">
          <span aria-hidden className="h-px w-[26px] bg-brand" />
          {eyebrow}
        </p>
      )}
      <h1 className="mt-5 text-center font-display text-[clamp(1.9rem,5vw,2.7rem)] font-extrabold uppercase leading-[0.94] text-ink">
        {children}
      </h1>
    </>
  );
}

export const fineprint = 'text-[0.86rem] leading-relaxed text-meta';

/**
 * Tailwind's preflight is deliberately not loaded (see globals.css), so a bare
 * <button> keeps the browser's grey box and border. Anything that should look
 * like text or an icon has to say so.
 */
export const buttonReset = 'cursor-pointer appearance-none border-0 bg-transparent p-0';

/**
 * Instagram and TikTok, as icon links.
 *
 * The database stores a handle, never a URL, and the href is built here — so
 * a profile can point at those two platforms and nowhere else. Each link
 * carries the handle in its accessible name, because an icon on its own tells
 * a screen reader nothing about whose account it opens.
 */
const SOCIALS = {
  instagram: {
    label: 'Instagram',
    href: (h) => `https://instagram.com/${h}`,
    path: 'M7 2.5h10A4.5 4.5 0 0 1 21.5 7v10a4.5 4.5 0 0 1-4.5 4.5H7A4.5 4.5 0 0 1 2.5 17V7A4.5 4.5 0 0 1 7 2.5Zm5 5.2a4.3 4.3 0 1 0 0 8.6 4.3 4.3 0 0 0 0-8.6Zm5.4-1.3h.01',
  },
  tiktok: {
    label: 'TikTok',
    href: (h) => `https://tiktok.com/@${h}`,
    path: 'M14.2 2.5v12.2a3.6 3.6 0 1 1-3-3.55M14.2 5.4c.7 1.6 2.2 2.7 4.3 2.9',
  },
};

export function SocialLinks({ instagram, tiktok, className = '' }) {
  const items = [['instagram', instagram], ['tiktok', tiktok]].filter(([, h]) => h);
  if (!items.length) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {items.map(([key, handle]) => {
        const s = SOCIALS[key];
        return (
          <a
            key={key}
            href={s.href(handle)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={`${s.label}: @${handle}`}
            className="grid h-9 w-9 place-items-center rounded-full border border-edge bg-surface text-meta transition hover:border-brand hover:text-brand"
          >
            <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d={s.path} />
            </svg>
          </a>
        );
      })}
    </div>
  );
}

/**
 * The destructive action, in the same visual language as the rest — the
 * danger colour is the site's `--color-danger`, not a new red.
 */
export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-[8px] border border-danger bg-danger px-[1.7rem] py-[0.85rem] font-display text-[0.92rem] font-bold uppercase tracking-[0.12em] text-white transition duration-200 hover:-translate-y-[2px] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0';

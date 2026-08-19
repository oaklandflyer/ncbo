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
export function Section({ children, band = false, className = '' }) {
  return (
    <section className={`${band ? 'border-y border-edge bg-band' : ''} py-10 sm:py-14 ${className}`}>
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

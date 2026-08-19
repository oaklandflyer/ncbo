/**
 * Shared presentation for the hub. No data, no logic, no auth — these exist so
 * the home page, the Q&A board and the Topics board are visibly the same
 * product rather than three pages that happen to share a palette.
 *
 * Tailwind utilities, on the brand tokens defined in globals.css.
 */

/** The page shell: one column, generous gutters, honest max width. */
export function Page({ children }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
      {children}
    </main>
  );
}

/** Eyebrow · headline · standfirst, with a hairline under it. */
export function PageHeader({ eyebrow, title, children, actions }) {
  return (
    <header className="mb-8 border-b border-line/70 pb-7 sm:mb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-3 flex items-center gap-3 font-display text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-steel">
              <span aria-hidden className="h-px w-6 bg-steel" />
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-3xl font-extrabold uppercase leading-[0.95] tracking-tight text-ink sm:text-4xl">
            {title}
          </h1>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children && (
        <p className="mt-4 max-w-2xl text-[0.97rem] leading-relaxed text-silver">{children}</p>
      )}
    </header>
  );
}

/** A section heading inside a page. */
export function SectionTitle({ children, count }) {
  return (
    <h2 className="mb-4 flex items-baseline gap-3 font-display text-lg font-bold uppercase tracking-[0.14em] text-ink">
      {children}
      {count != null && (
        <span className="font-body text-sm font-normal normal-case tracking-normal text-muted">
          {count}
        </span>
      )}
    </h2>
  );
}

const CARD = 'rounded-xl border border-line bg-navy-1 p-5 sm:p-6';

/** A static panel. */
export function Card({ children, className = '' }) {
  return <div className={`${CARD} ${className}`}>{children}</div>;
}

/**
 * A card that is a link. The whole tile is the target — a small link inside a
 * big box is a mobile accuracy problem.
 */
export function CardLink({ href, children, className = '', Component }) {
  const El = Component || 'a';
  return (
    <El
      href={href}
      className={`${CARD} group block transition duration-150 hover:-translate-y-0.5 hover:border-steel/70 hover:bg-navy-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel ${className}`}
    >
      {children}
    </El>
  );
}

/** Says nothing is here, without looking like something failed. */
export function Empty({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-navy-1/50 px-5 py-10 text-center text-[0.95rem] text-muted">
      {children}
    </div>
  );
}

const TONES = {
  open: 'border-steel/45 bg-steel/12 text-steel-light',
  done: 'border-line bg-navy-2 text-silver-dim',
  role: 'border-steel-deep/50 bg-steel-deep/20 text-steel-light',
  quiet: 'border-line bg-navy-2/70 text-muted',
};

/** Small status chip. */
export function Pill({ tone = 'quiet', children }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 font-display text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${TONES[tone] || TONES.quiet}`}
    >
      {children}
    </span>
  );
}

/** A row of small grey facts: author · school · time. */
export function Meta({ children, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] text-muted ${className}`}>
      {children}
    </div>
  );
}

/** Form feedback. Errors are announced; successes are not shouted. */
export function FormMessage({ error, ok }) {
  if (!error && !ok) return null;
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={`mt-3 text-[0.86rem] ${error ? 'text-danger' : 'text-steel-light'}`}
    >
      {error || ok}
    </p>
  );
}

/** Shared composer chrome: a labelled textarea over an action bar. */
export const composerShell =
  'rounded-xl border border-line bg-navy-1 p-5 sm:p-6';
export const composerLabel =
  'mb-2 block font-display text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-steel';
export const composerField =
  'w-full resize-y rounded-lg border border-line bg-navy-deep/60 px-4 py-3 text-[0.97rem] text-ink placeholder:text-muted-2 focus:border-steel focus:outline-none focus:ring-1 focus:ring-steel/40';
export const composerBar =
  'mt-3 flex flex-wrap items-center justify-between gap-3';
export const checkline =
  'inline-flex cursor-pointer select-none items-center gap-2 text-[0.86rem] text-silver-dim hover:text-silver';
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-steel px-4 py-2 font-display text-[0.8rem] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-steel-light disabled:cursor-not-allowed disabled:opacity-50';
export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 font-display text-[0.8rem] font-bold uppercase tracking-[0.12em] text-ink transition hover:border-steel hover:text-steel-light disabled:cursor-not-allowed disabled:opacity-50';
export const selectField =
  'rounded-lg border border-line bg-navy-deep/60 px-3 py-2 text-[0.9rem] text-ink focus:border-steel focus:outline-none';

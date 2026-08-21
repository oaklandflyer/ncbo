import { initials } from '@/lib/monogram';
import { resolveSize } from './sizes';

/**
 * Somebody's initials, standing in for an avatar the schema has nowhere to
 * store.
 *
 * Round rather than the club mark's rounded square, and that is the whole
 * visual distinction: a circle is a person, a square is an organisation. Same
 * size scale behind both, so a member row and a club row line up.
 *
 * `tone` exists because the three surfaces that draw this deliberately differ:
 * the directory sets people against the band, the popup against the brand
 * wash, and a profile page against a raised card. They are variants of one
 * component now rather than three components that happen to agree on the
 * letters.
 */
const TONES = {
  band: 'border border-edge bg-band text-brand-deep',
  wash: 'bg-brand-wash text-brand',
  raised: 'border border-edge bg-surface text-brand-deep shadow-brand-sm',
};

export default function Avatar({ name, size = 'sm', tone = 'band', className = '' }) {
  const { box, text } = resolveSize(size, 'Avatar');
  const palette = TONES[tone] || TONES.band;

  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-display font-bold tracking-[0.04em] ${box} ${text} ${palette} ${className}`}
    >
      {initials(name)}
    </span>
  );
}

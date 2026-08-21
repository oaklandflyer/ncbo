'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

/**
 * The admin's club switcher.
 *
 * An admin supports every chapter, so `/club/*` needs to know which one they
 * mean. The alternative — a parallel set of admin-only screens — is how two
 * versions of the roster page come to exist, and the one leads actually use is
 * never the one that gets fixed.
 *
 * The selection lives in the query string rather than a cookie so a link to a
 * specific chapter's queue is a link, and a support conversation can end with
 * a URL instead of "click the dropdown and pick Purdue".
 */
export default function ScopeSwitcher({ clubs, clubId }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(next) {
    const q = new URLSearchParams(params?.toString() || '');
    if (next) q.set('club', next); else q.delete('club');
    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <label className="block">
      <span className="block pb-1 font-display text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-meta">
        Viewing chapter
      </span>
      <select
        value={clubId || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[6px] border border-edge bg-surface px-3 py-2 text-[0.92rem] text-ink"
      >
        <option value="">Pick a chapter</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>{c.short_name || c.club_name}</option>
        ))}
      </select>
    </label>
  );
}

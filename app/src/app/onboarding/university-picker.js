'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { field, fieldLabel, fineprint } from '@/app/ui';

/**
 * A searchable list of universities, not a free-text box and not a club
 * picker.
 *
 * Two rules, both load-bearing:
 *
 *  1. **You cannot select a club.** You select a school, and the school
 *     resolves to its one club. A university has exactly one, so there is
 *     nothing for the user to disambiguate and no way for them to land in the
 *     wrong chapter at the right school.
 *
 *  2. **Free text is not offered.** It would give the organisation four
 *     spellings of Ohio State and no way to count them, which matters
 *     precisely because "how many students at schools we haven't reached"
 *     is the number that decides where NCBO expands next.
 *
 * A school with no chapter is a valid choice that says so, rather than a
 * dead end. Turning that person away at the form would throw away the
 * clearest expansion signal there is.
 */
export default function UniversityPicker({
  universities,
  name = 'university_id',
  defaultValue = '',
  onResolve,
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(
    () => universities.find((u) => u.id === defaultValue) || null,
  );
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return universities.slice(0, 8);
    return universities
      .filter((u) => `${u.name} ${u.short_name || ''} ${u.state || ''}`.toLowerCase().includes(q))
      /* Chapters first: most people typing here are at one of the six, and
         scrolling past four schools that cannot take them is friction for the
         majority to serve the minority. */
      .sort((a, b) => Number(b.has_chapter) - Number(a.has_chapter)
        || a.name.localeCompare(b.name))
      .slice(0, 10);
  }, [query, universities]);

  useEffect(() => {
    const onClick = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => setCursor(0), [query]);

  function choose(u) {
    setSelected(u);
    setQuery('');
    setOpen(false);
    /* The resolved chapter, handed up so the form can offer a referral search
       scoped to it. The club id goes no further than this: the form never
       submits one, and the server resolves the university to a club again on
       its own. */
    onResolve?.(u.has_chapter ? u : null);
  }

  function onKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, matches.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === 'Enter' && matches[cursor]) { e.preventDefault(); choose(matches[cursor]); }
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <label className={fieldLabel} htmlFor="university-search">Your university</label>

      {/* The value the form actually submits. The visible input is a search
          box and is never itself the answer, which is what stops a typo
          becoming a new school. */}
      <input type="hidden" name={name} value={selected?.id || ''} />

      <input
        id="university-search"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="university-options"
        aria-autocomplete="list"
        autoComplete="off"
        className={field}
        placeholder={selected ? selected.name : 'Start typing your school'}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {open && matches.length > 0 && (
        <ul
          id="university-options"
          role="listbox"
          className="absolute z-30 mt-1 max-h-[280px] w-full list-none overflow-auto rounded-[8px] border border-edge bg-surface shadow-[0_12px_36px_rgba(20,24,31,0.16)]"
        >
          {matches.map((u, i) => (
            <li key={u.id} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => choose(u)}
                className={`flex w-full items-center justify-between gap-3 border-0 px-4 py-3 text-left ${
                  i === cursor ? 'bg-band' : 'bg-transparent'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-display text-[0.95rem] font-semibold text-ink">
                    {u.short_name || u.name}
                  </span>
                  <span className="block truncate text-[0.82rem] text-meta">
                    {u.name}{u.state ? `, ${u.state}` : ''}
                  </span>
                </span>
                {u.has_chapter
                  ? <span className="shrink-0 font-display text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand">Chapter</span>
                  : <span className="shrink-0 font-display text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-fine">No chapter</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && query.trim() && matches.length === 0 && (
        <p className={`mt-2 ${fineprint}`}>
          No school matches that. Try the full name, like &ldquo;University of Pittsburgh&rdquo;.
        </p>
      )}

      {/* What they are joining, resolved from the school and shown before they
          submit. A person should never find out which chapter they applied to
          after the fact. */}
      {selected && (
        <div className="mt-3 rounded-[8px] border border-edge bg-band px-4 py-3">
          {selected.has_chapter ? (
            <>
              <p className="font-display text-[0.95rem] font-bold uppercase tracking-[0.02em] text-ink">
                Joining {selected.short_name || selected.name}
              </p>
              <p className={`mt-1 ${fineprint}`}>
                {selected.club_name}. Your club lead reviews new members, usually within a few days.
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-[0.95rem] font-bold uppercase tracking-[0.02em] text-ink">
                No chapter at {selected.short_name || selected.name} yet
              </p>
              <p className={`mt-1 ${fineprint}`}>
                You can still finish signing up. The calendar, the Q&amp;A board and the
                club directory are open to you, and we will tell you if a chapter starts
                at your school.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

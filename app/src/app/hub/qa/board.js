'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CardLink, Badge, Empty, Meta, VettedSeal, btnPrimary, field } from '@/app/ui';
import Vote from './vote';

/**
 * The board's controls and list.
 *
 * Search and the channel chips filter what is already on the page rather than
 * going back to the server: the feed is capped at 100 rows, so the whole set
 * is in hand, and a round trip per keystroke would be slower and worse
 * offline. If the cap ever lifts this needs to become a server query.
 *
 * The layout is phone-first — segmented control, one full-width action,
 * search, chips, then cards — and widens rather than rearranging above md.
 */
export default function Board({ questions, channels }) {
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return questions
      .filter((row) => {
        if (channel && row.channel_slug !== channel) return false;
        if (!q) return true;
        return `${row.body} ${row.author_name || ''} ${row.author_school || ''}`
          .toLowerCase().includes(q);
      })
      /* Most helpful first, newest as the tie-break — otherwise every
         unvoted question sits in whatever order Postgres returned. */
      .sort((a, b) => (b.helpful_count || 0) - (a.helpful_count || 0)
        || new Date(b.created_at) - new Date(a.created_at));
  }, [questions, query, channel]);

  return (
    <>
      {/* ── segmented control ─────────────────────────────────────────── */}
      {/* Two rooms, one control. It replaces the pair of full-width tiles the
          desktop home uses, which cost most of a phone screen to say the same
          thing. */}
      <div
        role="tablist"
        aria-label="Board"
        className="grid grid-cols-2 gap-1 rounded-[8px] border border-edge bg-band p-1"
      >
        <Link
          href="/hub/topics"
          role="tab"
          aria-selected={false}
          className="flex min-h-[44px] items-center justify-center rounded-[6px] font-display text-[0.82rem] font-bold uppercase tracking-[0.12em] text-meta transition hover:text-ink"
        >
          Discussion
        </Link>
        <span
          role="tab"
          aria-selected
          className="flex min-h-[44px] items-center justify-center rounded-[6px] bg-surface font-display text-[0.82rem] font-bold uppercase tracking-[0.12em] text-brand shadow-brand-sm"
        >
          Q&amp;A
        </span>
      </div>

      <a href="#ask" className={`${btnPrimary} mt-4 w-full`}>Ask a Question</a>

      <div className="mt-4">
        <label className="sr-only" htmlFor="board-search">Search questions</label>
        <input
          id="board-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions"
          className={`${field} min-h-[44px]`}
        />
      </div>

      {/* ── channel chips ─────────────────────────────────────────────── */}
      {/* Scrolls sideways rather than wrapping to three rows on a phone. The
          negative margin lets the row bleed to the screen edge so the last
          chip doesn't look clipped mid-gutter. */}
      {channels.length > 0 && (
        <div className="-mx-5 mt-4 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2">
            {[['', 'All'], ...channels.map((c) => [c.slug, c.name])].map(([slug, label]) => {
              const active = channel === slug;
              return (
                <button
                  key={slug || 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setChannel(slug)}
                  className={`cursor-pointer appearance-none min-h-[44px] whitespace-nowrap rounded-full border px-4 font-display text-[0.76rem] font-bold uppercase tracking-[0.1em] transition ${
                    active
                      ? 'border-brand bg-brand text-white'
                      : 'border-edge bg-surface text-meta hover:border-brand hover:text-brand'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-6 font-display text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-meta">
        Sorted by most helpful
      </p>

      {shown.length ? (
        <ul className="mt-3 grid list-none gap-4">
          {shown.map((q) => (
            <li key={q.id}>
              <CardLink href={`/hub/qa/${q.id}`} Component={Link}>
                {/* Clamped rather than sliced: the full text stays in the DOM
                    for search and screen readers. Sentence case on purpose —
                    the site shouts its headings, but shouting someone's
                    question back at them reads as an accusation. */}
                <p className="line-clamp-3 font-display text-[1.25rem] font-bold leading-[1.2] text-ink transition group-hover:text-brand sm:text-[1.35rem]">
                  {q.body}
                </p>

                {q.channel_name && (
                  <div className="mt-3">
                    <Badge tone="forming">{q.channel_name}</Badge>
                  </div>
                )}

                {/* Footer row: how many answers, and who settled it. The
                    prototype also shows a helpful count — nothing votes in
                    this schema, so there is no number to print. */}
                <Meta className="mt-4 border-t border-edge pt-3">
                  <Vote
                    questionId={q.id}
                    count={q.helpful_count || 0}
                    voted={!!q.voted_by_me}
                  />
                  <Badge tone={q.answered ? 'forming' : 'active'}>
                    {q.answered
                      ? `${q.answer_count} answer${q.answer_count === 1 ? '' : 's'}`
                      : 'Open'}
                  </Badge>
                  {q.answered && q.answered_by && (
                    <>
                      <span aria-hidden className="text-fine">·</span>
                      <span className="text-body">Answered by {q.answered_by}</span>
                      {q.answered_by_verified && <VettedSeal />}
                    </>
                  )}
                  {!q.answered && (
                    <>
                      <span aria-hidden className="text-fine">·</span>
                      <span className="text-body">{q.author_name}</span>
                    </>
                  )}
                </Meta>
              </CardLink>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3">
          <Empty>
            {questions.length
              ? 'Nothing matches that. Clear the search or pick another channel.'
              : 'No questions yet. Ask the first one.'}
          </Empty>
        </div>
      )}
    </>
  );
}

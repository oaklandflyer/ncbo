'use client';

import { useMemo, useState } from 'react';
import { Card, Badge, Empty, Meta, VettedSeal, Credentials, SocialLinks, AlumniBadge, field, buttonReset } from '@/app/ui';
import { UserChip } from '@/app/hub/profile-popup/popup';
import Avatar from '@/app/brand/avatar';
import { academicLine } from '@/lib/academicYear';

/**
 * The network, three ways: by club, by hometown region, and as a flat list of
 * people.
 *
 * Grouping happens here rather than in three queries because the directory
 * arrives as one narrow projection (`member_directory`) and regrouping 500
 * rows in the browser is instant, where three round trips are not. Past a few
 * thousand members this wants server-side grouping and pagination — noted in
 * the PR rather than pre-built.
 */

const VIEWS = [
  ['club', 'By Club'],
  ['region', 'By Hometown'],
  ['people', 'People'],
];

/**
 * One person. The vetted seal and the credential pills only appear when the
 * database says so — an unvetted coach gets neither, which is the whole point
 * of the seal meaning anything.
 */
function PersonCard({ person }) {
  return (
    <Card className="p-5 sm:p-5">
      <div className="flex items-start gap-4">
        <Avatar name={person.display_name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <UserChip
              userId={person.id}
              className="font-display text-[1.1rem] font-extrabold uppercase leading-none tracking-[0.02em] text-ink"
            >
              {person.display_name}
            </UserChip>
            {person.verified && <VettedSeal />}
            {person.is_alumni_effective && <AlumniBadge since={person.alumni_since} />}
          </div>

          <Meta className="mt-2">
            {person.division && <span className="text-body">{person.division}</span>}
            {person.division && person.home_region && (
              <span aria-hidden className="text-fine">·</span>
            )}
            {person.home_region && <span>{person.home_region}</span>}
            {academicLine(person) && (
              <>
                {(person.division || person.home_region) && (
                  <span aria-hidden className="text-fine">·</span>
                )}
                <span>{academicLine(person)}</span>
              </>
            )}
            {person.is_alumni_effective && (
              <>
                <span aria-hidden className="text-fine">·</span>
                <span className="text-dim">Graduate</span>
              </>
            )}
          </Meta>

          {person.credentials?.length > 0 && (
            <div className="mt-3"><Credentials items={person.credentials} /></div>
          )}

          <SocialLinks
            className="mt-3"
            instagram={person.instagram_handle}
            tiktok={person.tiktok_handle}
          />
        </div>
      </div>
    </Card>
  );
}

/**
 * The map block.
 *
 * Not a map: there are no coordinates in the schema, deliberately — regions
 * are named areas ("Greater Pittsburgh, PA") precisely so the app never holds
 * a member's position. What a real map would communicate here is where the
 * network is dense, and a proportional bar of the same regions says that
 * without pretending to a precision we don't have, or shipping a tile layer
 * to a phone on stadium wifi.
 */
function RegionMap({ groups, active, onPick }) {
  const total = groups.reduce((n, g) => n + g.people.length, 0) || 1;

  return (
    <div className="rounded-[8px] border border-edge bg-band p-5">
      <p className="font-display text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-brand">
        Where the network is
      </p>

      {/* One bar, segmented by region, each segment sized by headcount. */}
      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-raised">
        {groups.map((g, i) => (
          <span
            key={g.key}
            title={`${g.key} · ${g.people.length}`}
            className="h-full border-r border-band last:border-r-0 transition-opacity"
            style={{
              width: `${(g.people.length / total) * 100}%`,
              backgroundColor: i % 2 ? 'var(--color-brand-light)' : 'var(--color-brand)',
              opacity: active && active !== g.key ? 0.35 : 1,
            }}
          />
        ))}
      </div>

      <ul className="mt-4 flex list-none flex-wrap gap-2">
        {groups.map((g) => (
          <li key={g.key}>
            <button
              type="button"
              aria-pressed={active === g.key}
              onClick={() => onPick(active === g.key ? '' : g.key)}
              className={`cursor-pointer appearance-none min-h-[44px] rounded-full border px-4 text-left font-display text-[0.74rem] font-bold uppercase tracking-[0.08em] transition ${
                active === g.key
                  ? 'border-brand bg-brand text-white'
                  : 'border-edge bg-surface text-meta hover:border-brand hover:text-brand'
              }`}
            >
              {g.key}
              <span className={active === g.key ? 'text-white/70' : 'text-fine'}> · {g.people.length}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Directory({ members, clubs: roster = [] }) {
  const [view, setView] = useState('club');
  const [region, setRegion] = useState('');
  const [query, setQuery] = useState('');

  const group = (key, fallback) => {
    const map = new Map();
    members.forEach((m) => {
      const value = m[key] || fallback;
      if (!map.has(value)) map.set(value, []);
      map.get(value).push(m);
    });
    return [...map.entries()]
      .map(([k, people]) => ({ key: k, people }))
      .sort((a, b) => b.people.length - a.people.length || a.key.localeCompare(b.key));
  };

  const regions = useMemo(() => group('home_region', 'Unlisted Region'), [members]);

  /* Every official club, with its members attached — not the other way round.
     A club nobody has joined yet still belongs on this list; that is most of
     the roster today. Members whose club isn't on the roster (or who have
     none) fall into a trailing group rather than vanishing. */
  const clubs = useMemo(() => {
    const byName = new Map();
    members.forEach((m) => {
      const key = m.club_name || 'No club yet';
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(m);
    });

    const listed = roster.map((c) => ({
      key: c.club_name,
      people: byName.get(c.club_name) || [],
      club: c,
    }));

    const claimed = new Set(roster.map((c) => c.club_name));
    const unlisted = [...byName.entries()]
      .filter(([key]) => !claimed.has(key))
      .map(([key, people]) => ({ key, people, club: null }));

    return [...listed, ...unlisted].sort((a, b) => {
      /* Pipelines last — they are schools NCBO is talking to, not clubs
         somebody can join today. */
      const pipeline = (g) => (g.club?.status === 'Pipeline' ? 1 : 0);
      return pipeline(a) - pipeline(b)
        || b.people.length - a.people.length
        || a.key.localeCompare(b.key);
    });
  }, [members, roster]);

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => (!region || m.home_region === region))
      .filter((m) => !q || `${m.display_name} ${m.division || ''} ${m.home_region || ''} ${m.club_name || ''}`
        .toLowerCase().includes(q))
      /* Vetted coaches first — they are what someone opens this tab looking
         for — then alphabetically. */
      .sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0)
        || String(a.display_name).localeCompare(String(b.display_name)));
  }, [members, region, query]);

  return (
    <>
      <RegionMap groups={regions} active={region} onPick={setRegion} />

      {/* ── segmented control ─────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Directory view"
        className="mt-5 grid grid-cols-3 gap-1 rounded-[8px] border border-edge bg-band p-1"
      >
        {VIEWS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={`${buttonReset} flex min-h-[44px] w-full items-center justify-center whitespace-nowrap rounded-[6px] px-1 text-center font-display text-[0.72rem] font-bold uppercase tracking-[0.06em] transition sm:text-[0.78rem] sm:tracking-[0.1em] ${
              view === key
                ? 'bg-surface text-brand shadow-brand-sm'
                : 'text-meta hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'people' && (
        <div className="mt-4">
          <label className="sr-only" htmlFor="directory-search">Search the network</label>
          <input
            id="directory-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, division or club"
            className={`${field} min-h-[44px]`}
          />
        </div>
      )}

      <div className="mt-6">
        {view === 'people' && (
          people.length ? (
            <ul className="grid list-none gap-3 md:grid-cols-2">
              {people.map((m) => <li key={m.id}><PersonCard person={m} /></li>)}
            </ul>
          ) : (
            <Empty>
              {region || query
                ? 'Nobody matches that yet. Clear the search or pick another region.'
                : 'No members listed yet.'}
            </Empty>
          )
        )}

        {view !== 'people' && (
          <ul className="grid list-none gap-5">
            {(view === 'club' ? clubs : regions)
              .filter((g) => !region || view === 'club' || g.key === region)
              .map((g) => (
                <li key={g.key}>
                  <div className="mb-3 border-b border-edge pb-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-display text-[1.15rem] font-extrabold uppercase leading-none text-ink">
                        {g.key}
                      </h3>
                      <span className="flex flex-wrap items-center gap-2">
                        {g.club?.status === 'Pipeline' && <Badge tone="forming">Pipeline</Badge>}
                        {g.club?.status === 'Forming' && <Badge tone="forming">Forming</Badge>}
                        {g.club?.status === 'Active' && <Badge tone="active">Active</Badge>}
                        <Badge tone="forming">
                          {g.people.length} {g.people.length === 1 ? 'member' : 'members'}
                        </Badge>
                      </span>
                    </div>
                    {(g.club?.school_name || g.club?.leads?.length > 0) && (
                      <Meta className="mt-2">
                        {g.club?.school_name && <span>{g.club.school_name}</span>}
                        {g.club?.school_name && g.club?.leads?.length > 0 && (
                          <span aria-hidden className="text-fine">·</span>
                        )}
                        {g.club?.leads?.length > 0 && (
                          <span className="text-body">
                            Led by {g.club.leads.join(', ')}
                          </span>
                        )}
                      </Meta>
                    )}
                  </div>

                  {g.people.length > 0 ? (
                    <ul className="grid list-none gap-3 md:grid-cols-2">
                      {g.people.map((m) => <li key={m.id}><PersonCard person={m} /></li>)}
                    </ul>
                  ) : (
                    <Empty>
                      {g.club?.status === 'Pipeline'
                        ? 'A school NCBO is talking to. No club yet.'
                        : 'No members signed up here yet.'}
                    </Empty>
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>
    </>
  );
}

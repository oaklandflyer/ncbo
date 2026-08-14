# NCBO Member Hub — Plan

Status: **discovery complete, awaiting approval before implementation.**
Written 2026-08-14. Branch `claude/ncbo-member-hub-538t5n`.

---

## 1. What is actually in this repo

### Stack

| Thing | Finding |
|---|---|
| Framework | **None for the public site.** It is hand-written static HTML + vanilla JS, no build step, no `package.json` at the repo root. |
| Router | Filesystem. `index.html` is the whole public site; `about.html`, `clubs.html`, `faqs.html`, `start-a-club.html` are 16-line redirect stubs to `index.html#anchor`. |
| Styling | One hand-written stylesheet, `assets/styles.css` (721 lines) with a real CSS custom-property token set, plus `assets/app.css` (283 lines) for the member hub. Fonts are Barlow / Barlow Condensed loaded from Google Fonts CDN. |
| Build | None. `README.md`: "Everything is plain HTML/CSS/JS. No build step, no dependencies, no server." |
| Deploy | GitHub Pages from the repo root. `CNAME` = `thencbo.org`. `robots.txt` + `sitemap.xml` committed. |
| Package manager / Node | No root `package.json`. The `app/` subproject has `package-lock.json` → npm. Sandbox has Node v22.22.2 / npm 10.9.7. No `.nvmrc`, no engines field. |
| Tests | **None anywhere**, except `app/supabase/tests/run.sh` (pgTAP SQL policy tests that need a running Supabase). |
| CI | **None.** No `.github/` directory at all. |
| TypeScript | **None.** Zero `.ts` files in the repo. |

### Content model

`assets/data.js` is the single source of truth for the public site: a 420-line
`window.NCBO_DATA` object holding org info, nav, hero, clubs, board/leadership/
team/club-leads/advisory, FAQs, news, join steps and form links. `assets/site.js`
reads it and builds the nav, footer and every section at runtime. `admin/photos.html`
is an in-browser content manager that **rewrites `data.js` wholesale** — which is why
member-hub content is deliberately kept in a separate `assets/member-data.js`.

The file opens with an accuracy policy that matches your brief almost exactly:
don't publish unconfirmed names/numbers/dates, describe unbuilt things in
forward-looking language, NCBO is a nonprofit **in formation** (not a 501(c)(3)),
don't publish unmonitored email addresses. There are `clubsHeld`, `boardHeld`,
`advisoryHeld`, `voicesHeld` arrays holding entries that are deliberately
**not** published pending confirmation. I will keep working inside that policy and
extend it rather than replace it.

### A member hub already exists — two of them, in fact

Your brief says you don't believe there's a working member portal. There are two.

1. **`members.html`** (live, linked from the main nav as "Members"). Username +
   password sign-in done **entirely in the browser**: PBKDF2 via WebCrypto in
   `assets/js/auth.js`, against salts and hashes committed in `data/members.json`
   (2 accounts: `admin`, `member`). After sign-in it reveals a one-page hub —
   calendar, updates, resources, Q&A board, club directory — rendered from
   `assets/member-data.js`. `admin/index.html` + `admin/photos.html` are gated by
   `admin/gate.js`. `SECURITY-NOTES.md` is admirably honest that this is a
   speed bump, not a security boundary: the hash file is public, and everything
   the hub "protects" is shipped to the browser anyway.
2. **`app/`** — a real Next.js 15 / React 19 App Router project (JavaScript, not
   TypeScript) using **Supabase** for auth (magic link), Postgres and row-level
   security, intended for Vercel. It has migrations, an approval queue, four
   roles, topics and a Q&A board. **It cannot run without a Supabase account and
   two keys**, which your constraint #1 rules out. It is dead weight for this pass.

Also relevant: your public nav is *not* About / Find a Club / Start a Club / Team /
FAQs / Join. Those are sections of the one-page `index.html`. The actual nav is
**Home · Members · Join NCBO**.

### Design tokens — the prototype's dark navy is gone

`assets/styles.css` is a **light theme**: page ground `#F4F8FD`, cards `#FFFFFF`,
text `#0E1A2F`, accent steel blue `#2F5FA8`. The comment header says the token
*names* (`--navy`, `--white`) are historical leftovers from the dark build and now
read backwards, with semantic aliases (`--bg`, `--surface`, `--text`, `--text-soft`)
as the forward-looking API. Deep navy survives only as a scrim over hero/tile
photos. Barlow Condensed uppercase display type and the tagline
"Clubs. Competition. Community." are both still there.

So "match the existing site's tokens" and "match the dark navy prototype" now point
in opposite directions. **This is question 1 below.**

### Existing club data and the map

`NCBO_DATA.clubs` — six founding chapters, each `{ school, name, lead, status, img }`
and sometimes `note` / `state`:

| School | Club name | Lead | Status |
|---|---|---|---|
| University of Pittsburgh | Fitness and Bodybuilding Club | Rachel Hare | Active |
| Penn State University (University Park) | Bodybuilding & Fitness Club | Isabel Ward | Active |
| Purdue University | Purdue Bodybuilding Club | Vincent Panzica | Active |
| Florida State University | Bodybuilding and Fitness Club at FSU | Eli Korta | Active |
| University of Iowa | Bodybuilding Club at UIowa | Alex Swanson | Active |
| Slippery Rock University | Slippery Rock Fitness and Wellness Club | Sean Hanley | Active |

No lat/lng, no member counts, no Instagram handles, no founding dates. **I will not
invent any of them.** There is no enrollment figure anywhere in the repo.

`assets/usmap.js` already does most of what your brief asks the map to do: 185
lines, vendored state outline paths in a 960×600 viewBox, no network, no token, pins
placed by hand-placement → explicit x/y → state centroid fallback, `role="img"` with
an aria-label, keyboard-focusable pins. It is **not** an Albers projection and takes
viewBox coordinates rather than lat/lng, and there is no text-list fallback. I plan
to keep the vendored-SVG approach and replace the coordinate system (see §3.4).

---

## 2. Two constraint collisions I found before writing code

**(a) I cannot download IPEDS data from this sandbox.** The egress proxy allows the
npm registry but returns 403 CONNECT for `nces.ed.gov` (verified twice, both the
data-center page and a `HD2023.zip` URL). Web *search* works; direct web *fetch* of
arbitrary pages is also blocked. Consequences:

- `scripts/fetch-enrollment.ts` gets written and it fails loudly here, exactly as
  specified. **You** will be able to run it — your machine isn't behind this proxy.
- I will **not** hand-key enrollment numbers from search snippets and label them
  IPEDS. That would be precisely the invented-fact failure the brief forbids.
- Therefore `data/enrollment.json` ships **empty with a generated-by header**, and
  every club is "Unranked — enrollment data not loaded" until you run the script.
  Since the season hasn't started, the standings page is in its pre-season empty
  state anyway, so nothing user-facing is worse for it. It goes in `DEFERRED.md`.

**(b) Citation verification is degraded, not absent.** I can run web searches and
read result summaries, but I cannot open the NPC promoter page, the WNBF rulebook,
the USADA page or the journal articles directly. My rule for this pass: a claim
ships only if I can corroborate it across independent search results, and anything I
can't corroborate gets cut and listed in the closing summary as an unverified gap.
The Helms 2014 and Jäger 2017 figures in your brief and the REDs consequence list
are things I can state with the DOI attached; promoter-specific facts (fees, dates,
venues) I will simply not publish, per your instruction.

---

## 3. What I propose to build

### 3.0 Stack decision — Astro, in a new `web/` directory

The brief requires TypeScript strict, build-time schema validation, unit tests,
server-rendered indexable pages, Markdown content, build-time ICS generation and
generated PDFs. That is not achievable in the current no-build static site, and the
existing `app/` is unrunnable under constraint #1.

**Recommendation: Astro** (static output) in `web/`, because it gives, with no
external services: content collections whose **zod schemas fail the build** on bad
data; Markdown/MDX for the reference pages; prerendered HTML for every public page;
first-class TS strict; endpoints that emit `.ics` and other files at build time;
and near-zero client JS by default, which keeps the keyboard/contrast work simple.
Vitest for the scoring unit tests. Runtime dependencies: none. Everything after
`npm install` runs offline.

Alternatives considered: Next.js static export (heavier, and the `app/` precedent is
Supabase-coupled JS); Eleventy (weaker TS story); hand-rolled TS generator
(reinventing content collections). I'll switch if you prefer one.

**Deployment stays as-is in this pass.** Pages currently serves the repo root. I will
*not* silently repoint it. The plan is to build to `web/dist/` and document two ways
forward in `DEFERRED.md`: a GitHub Actions Pages workflow that publishes the Astro
build with the existing static files copied in via `web/public/` (clean
`/standings` URLs), or serving the hub under a `/hub/` subpath. Your call, later —
it needs a repo settings change, which is yours to make.

**PDF templates** get generated with `pdfkit` (pure JS, no headless browser, no
service) at build time. No external anything.

### 3.1 Order of work, as commits

Roughly one commit per numbered item, conventional commits.

1. `chore: scaffold web/ astro + typescript strict + vitest` — tooling, tsconfig,
   npm scripts (`dev`, `build`, `test`, `check`, `fetch:enrollment`), no content.
2. `feat(tokens): design token layer + core components` — port the existing token
   set, add the components the brief names: rank hero, stat tile, badge
   (`SANCTIONED` / `NCBO CHAPTER` / `VERIFIED` / `YOUR CLUB`), progress-bar-with-
   cut-line, event card, club card, citation. Contrast-checked (see §3.6).
3. `feat(scoring): shrinkage-adjusted per-capita scoring module` + `test(scoring)` —
   `lib/scoring/`, fully unit-tested, **before** any UI consumes it.
4. `feat(schema): zod schemas for clubs, events, members, standings` — build fails
   on invalid data; privacy defaults encoded here (§3.5).
5. `feat(data): port the six founding chapters to data/clubs/` — from `data.js`
   verbatim, nothing added.
6. `feat(standings): /standings, /standings/[conference], /how-standing-works` —
   pre-season empty state; sample data behind `NCBO_DEMO_DATA=1` with the
   non-dismissible banner.
7. `feat(events): data/events/, /events, /events/[slug], build-time ICS`.
8. `feat(clubs): /clubs, /clubs/[slug], inline SVG map + list fallback`.
9. `feat(resources): competing, prep, health, club-operations` + citation rendering
   + generated PDF templates. This is the research-heavy commit; likely split.
10. `feat(auth): types, role model, route-protection middleware, dev-only file
    session provider` — hard-refuses in production builds.
11. `docs: PLAN, AUTH, PRIVACY, CONTENT-POLICY, SOURCES, DEFERRED`.
12. `scripts: fetch-enrollment.ts` (+ empty committed `data/enrollment.json`).

### 3.2 Scoring — the formula, as specified

```
raw_rate    = points / (enrollment / 1000)
league_mean = Σpoints / Σ(enrollment / 1000)
adjusted    = (points + K * league_mean) / (enrollment / 1000 + K)
```

Exported config constants, each documented in-module and on the explainer page:
`K = 2` (shrinkage, in per-1,000-enrolled units, flagged as needing empirical
tuning once there's a season), `MIN_ROSTER = 10` (below → "Unranked — building
roster", never ranked), `DENOMINATOR = 'undergraduate_enrollment'` (a judgment call,
stated as one). Both raw and adjusted rate render in the table, with the shrinkage
tooltip. Rank movement renders only when there are ≥2 real snapshots to move
against.

Unit tests cover, at minimum: the worked example from the formula; a 12-person club
with a spike (the small-denominator case that broke the old formula) shrinking
toward the mean; a club below `MIN_ROSTER` being excluded from ranking but still
listed; a league with zero clubs and with one club; `K = 0` reducing exactly to
`raw_rate`; enrollment missing or zero not producing `Infinity`/`NaN`; ranking
stability and tie handling.

### 3.3 Standings honesty rules

Production build: no number anywhere is presentable as a real standing. Sample data
lives only in `data/samples/`, loads only when `NCBO_DEMO_DATA=1`, and renders under
a persistent, non-dismissible `SAMPLE DATA — NOT REAL STANDINGS` banner. The loader
throws if it is ever reached in a production build, and there's a test asserting
that.

### 3.4 Map

Vendored `us-atlas` TopoJSON (public domain, from npm at install time, committed
into the repo), Albers USA projection computed **at build time** into a static
inline SVG — no client-side projection library, no runtime network, no token. Clubs
plot from `lat`/`lng` in their data file. Pins are real links to `/clubs/[slug]`,
keyboard-reachable in DOM order, with a visible focus ring, and the map is preceded
by a plain text list of every club so it is never the only route to a club page.
**Club lat/lng are campus coordinates I can source and cite, not invented** — if I
can't source one, that club renders in the list and not on the map, and it goes in
the summary as a gap.

### 3.5 Privacy defaults

Encoded in the schema, not the UI: `visibility` defaults to `'private'` on member
profiles; `email` and precise location have no public visibility state at all —
they're modelled so they *cannot* be marked public. A test asserts that parsing an
empty member object yields private defaults, so a future UI can't invert them by
omission. Reasoning goes in `docs/PRIVACY.md`. The prototype's public roster with
name / school / age / division does not get built.

### 3.6 Accessibility

WCAG 2.1 AA contrast checked mechanically, not by eye: a small script over the token
pairs actually used, failing the build (or at least `npm run check`) on any
foreground/background combination under 4.5:1 (3:1 for large display type). Real
focus states on every interactive element, keyboard-navigable map with list
fallback, `prefers-reduced-motion` respected, semantic headings, per-page
titles/descriptions/OG tags.

### 3.7 Content policy enforcement

`docs/CONTENT-POLICY.md` carries your hard exclusions verbatim. I'll also add a
`npm run check:content` grep-based guard over the content directory for the
prohibited categories (dehydration / water loading / diuretic / SARM dosing / "goal
weight" calculator language), so a future edit trips a build check rather than
relying on memory. The prep page states the Helms position on dehydration —
"can be dangerous, and may not improve appearance" — and stops there, as instructed.

No generic "Verified Knowledge" badge. If any credential displays at all, it shows
the specific credential (RD, CSCS, MD) and nothing more. Note that the three
coaching advisors in `data.js` have **no credentials recorded anywhere in the repo**,
so no credential UI will have real data to render — I'll build the seam and leave it
empty rather than fill it.

---

## 4. What I am explicitly *not* doing in this pass

- Not touching `members.html`, `assets/js/auth.js`, `data/members.json`, `admin/`,
  or `assets/data.js` content. The existing site keeps working exactly as it does.
- Not deleting or rewriting `app/` (the Supabase project). It stays where it is; I'll
  document in `AUTH.md` that it and the new auth seam are two answers to the same
  question, and that one of them requires an account you've ruled out.
- Not shipping a login button on the public site. Per the brief.
- Not repointing GitHub Pages.
- Not inventing enrollment figures, member counts, conferences with real members,
  event history, coach credentials, or standings.

---

## 5. Open questions — please answer these before I start

1. **Theme.** The live site is a light theme; your brief describes a dark navy
   prototype. Match the live light tokens, or build the hub dark to match the
   prototype (and accept that the hub and the marketing site look different)?
2. **Stack.** Astro as recommended, or would you rather I use Next.js so it lines
   up with the existing `app/`?
3. **Conferences.** `/standings/[conference]` needs a conference concept, and none
   exists in the repo. The six chapters are in PA (×2), IN, FL, IA. Do you want me
   to model conferences as an empty, configurable structure (`data/conferences/`
   with none defined yet, page renders "no conferences defined"), or invent nothing
   at all and have the route 404 until you define them? I lean toward the former.

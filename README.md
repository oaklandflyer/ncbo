# NCBO Website

Site for the National Collegiate Bodybuilding Organization, in NCBO's brand —
navy `#0A1228`, steel blue `#5B86C4`, silver `#C9CDD1`, Barlow Condensed
headings. No shop.

**The public site is one page.** `index.html` carries About, Find a Club, Start
a Club, the team, FAQs, and how membership works, with a sticky jump bar to move
between them — built that way so it reads top-to-bottom on a phone. The nav is
just **Home** and **Members**, with **Join NCBO** in the top right.

---

## The one rule: edit `assets/data.js`, not the HTML

Almost everything you'll want to change — text, clubs, team members, pricing
tiers, FAQs, news posts, links — lives in **`assets/data.js`**. The pages read
from that file and build themselves. You rarely need to touch the HTML.

Open `assets/data.js` in any text editor. It's commented and grouped by section.
Change the text between the quotes, save, refresh the page.

---

## Files

| File | What it is |
|------|------------|
| `index.html` | The whole public site: hero, about, clubs, start a club, team, FAQs, join |
| `join.html` | Become a Member — the detail page behind the nav CTA |
| `contact.html` | Contact info + form |
| `news.html` | News & Updates |
| `members.html` | Member hub — Supabase magic-link sign-in + member area |
| `clubs.html`, `start-a-club.html`, `about.html`, `faqs.html` | Redirect stubs → the matching `index.html#` section (old links keep working) |
| `assets/data.js` | **All site content. Edit this.** |
| `assets/member-data.js` | **All member-hub content.** Loaded only once the hub renders. |
| `assets/supabase-config.js` | Your Supabase project URL and public anon key. **Fill this in.** |
| `assets/ncbo-auth-core.js` | The gate's rules, with no DOM or network attached — unit-tested |
| `assets/ncbo-auth.js` | Sign-in: magic link, session, and which panel is on screen |
| `assets/ncbo-review.js` | `review.html`: the queue of accounts waiting for an admin |
| `review.html` | Admin page — approve or hold pending accounts |
| `admin/index.html`, `admin/photos.html` | Admin pages (admin accounts only) |
| `admin/gate.js` | The gate on every admin page |
| `test/core.test.js`, `test/guards.sh` | The test suite — `node`/`bash`, no dependencies |
| `SECURITY-NOTES.md` | **What this sign-in protects and what it doesn't. Read it.** |
| `assets/app.js` / `app.css` | Member hub: calendar, updates, resources, Q&A, directory |
| `assets/usmap.js` | Reusable US club map (state outlines + campus pins) |
| `assets/styles.css` | Design system (colors, layout). Edit only for look changes. |
| `assets/site.js` | Builds the shared nav/footer and renders the data. Don't edit unless adding features. |
| `assets/ncbo-logo.webp` / `.png` | Logo |
| `assets/img/` | Drop your photos here — see `assets/img/PHOTO-GUIDE.md` |

The nav and footer are defined **once** in `assets/site.js`, so a link change
there updates every page at once.

---

## Adding photos

Every image has a labeled placeholder until you add the real file. Save your
image at the path listed in **`assets/img/PHOTO-GUIDE.md`** and it appears
automatically — no code change. Until then the styled placeholder keeps the
layout from looking broken.

---

## Before you launch — replace these placeholders

In `assets/data.js`:

1. **Contact email** (line ~20) — currently `hello@ncbo.org`.
2. **Instagram URL + handle** (lines ~21–22) — currently `instagram.com/ncbo` / `@ncbo`.
3. **Member-voice quotes** (the `voices` block) — three quotes are placeholder
   copy with generic attributions. Swap in real member quotes + photos.
4. **Form links** (the `forms` block) — `becomeMember`, `startClub`, and
   `contact` are set to `"#"`. Paste in your real Google Form URLs. The `board`
   form is already wired to your live link.

Search the file for `<--` and `PLACEHOLDER` to jump straight to each one.

---

## Publishing on GitHub Pages

1. Put all these files (keep the `assets/` folder structure) in your repo.
2. Settings → Pages → deploy from your branch root.
3. Done — `index.html` is the entry point.

Everything is plain HTML/CSS/JS. No build step, no dependencies, no server.

---

## Two member surfaces — which is which

| | `members.html` | `app/` |
|---|---|---|
| What | Static page, Supabase magic-link sign-in | Full app: accounts, roles, topics, moderation |
| Runs on | GitHub Pages, this repo | Next.js on a host of its own |
| Data | The same Supabase project | The same Supabase project |
| Security | Row-level security in Postgres | Row-level security in Postgres |

Both now sit on top of the same Supabase project and the same migrations in
`app/supabase/migrations/`, so an account works in either. `members.html` is the
one that is live; `app/` is the larger application being built alongside it.

---

## The member hub (`members.html`)

Members sign in with a link emailed to them — no password to set, and nothing
committed to this repository. Everything after sign-in is one scrolling page —
calendar, updates, resources, the Q&A board, and the club directory — with a
jump bar at the top.

**Setup, once:** apply the migrations and fill your project's URL and **anon**
(public) key into `assets/supabase-config.js` — the whole procedure, including
the redirect allowlist that silently breaks magic links if it's skipped, is in
[`docs/SUPABASE-SETUP.md`](docs/SUPABASE-SETUP.md). Both values are public by design and safe to commit; the `service_role`
key is not and must never go in this repository. Until they are filled in, the
hub shows a "not connected yet" panel and attempts no sign-in.

**Editing content:** the hub's content lives in `assets/member-data.js` —
announcements, calendar, resource links, channels, and seeded Q&A. It's kept out
of `data.js` on purpose, because the admin content manager rewrites `data.js`
wholesale and would wipe it.

**Accounts:** anyone can ask for a sign-in link, and the database decides what
happens next (`public.handle_new_user()` in `app/supabase/migrations/`):

| Address | Result |
|---|---|
| `.edu` at a school in `public.schools` | Approved on the spot |
| On the `allowed_emails` staff list | Approved on the spot |
| Anything else | **Pending** — an admin decides on `review.html` |

A pending account can sign in and see that it is pending. It cannot read the
board, and that is enforced by row-level security in Postgres, not by this page.

**Admin pages:** `review.html` is the approval queue. `admin/index.html` and
`admin/photos.html` are the content manager; `admin/gate.js` hides them before
anything renders and only reveals them for an approved admin. Saving from the
content manager still needs your own GitHub token — sign-in decides who sees the
tool, the token decides who can change the site.

**Tests:** `node test/core.test.js` covers the gate's rules, and
`bash test/guards.sh` checks the repository invariants — the load order at the
end of `members.html`, the cache-busting query strings, and that no password
file has come back. Both run in CI on every push and pull request
(`.github/workflows/tests.yml`). `guards.sh` warns, without failing, while
`supabase-config.js` still holds its placeholders.

**What the sign-in is and isn't:** what protects member data is row-level
security in the database — every table is closed by default and each policy
names who may read or write it. This page decides what to *draw*; Postgres
decides what may be *read*. What is still true of a static site: anything
committed here (including `assets/member-data.js`) is public to anyone who
requests the file directly, so member-only *content* in this repository is still
"members only, please" rather than protected.
**Read `SECURITY-NOTES.md` before deciding what to put behind it.**

The Q&A ask box saves drafts to the member's own browser only; set `ask.form`
in `member-data.js` to a Google Form link to give them a real way to send
questions in.

---

## Clubs, the map, and club leads

Adding a club in the admin (Clubs tab) now feeds three places from the one
entry:

1. **The club cards** under Find a Club, as before.
2. **The map.** Pick the club's state and a pin appears immediately, at the
   middle of that state. For a pin on the actual campus, press **Place on map**
   and click the spot — that stores exact coordinates on the record and fills
   in the state for you. The five founding chapters keep their hand-placed pins
   in `assets/usmap.js` and ignore these fields.
3. **Club leads**, a block in the Team section of the home page. Whatever you
   type in "Lead / contact" appears there with the school underneath. Leave it
   blank and nobody is listed — the club card offers a contact link instead, so
   we never publish a name we can't source.

**Lead photos and extra leads live on the Team tab**, under *Club leads*. The
Clubs tab holds one name per club and has no upload; the Team panel is a full
roster — add as many people per club as you like, each with its own photo
upload, same as Leadership and Advisory. A button there pulls in everyone
already named on the Clubs tab so you don't retype them, and the two lists are
merged by name, so a person in both appears once. A lead with no photo renders
as an initials monogram.

---

## Who's who, and the order they appear in

The Team section of the home page runs top-down in governance order. Each
block is driven by one array in `assets/data.js`, and every block except the
executive board stays hidden, heading included, while its array is empty.

| Block | Array | What it is |
|-------|-------|------------|
| Board of directors | `board` | Independent directors who oversee the CEO. Being recruited, so the block is hidden today. |
| Executive board | `leadership` | The CEO and the directors running day to day operations. |
| Team | `teamMembers` | People reporting into an executive board director. |
| Club leads | `clubLeads` + `clubs[].lead` | The students running each campus chapter. |
| Coaching advisors | `advisory` | Coaches who advise the campus clubs on training and posing. **Not governance**, and the copy has to keep saying so. |

A director carries a board office in `role` (President, Treasurer, Secretary,
Director) and their outside job in `title`. The office is the line people read
first. `boardHeld` stages a director who isn't confirmed in writing yet;
nothing renders it, and the admin's **Publish** button is what moves someone
across.

---

## Note on structure

This is a **multi-file** build because that's what a girlgains-style multi-page
site needs — a departure from the single-`index.html` approach used elsewhere.
Each page is a thin shell; the shared brain is in `assets/`.

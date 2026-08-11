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
| `members.html` | Member hub — username/password sign-in + member area |
| `clubs.html`, `start-a-club.html`, `about.html`, `faqs.html` | Redirect stubs → the matching `index.html#` section (old links keep working) |
| `assets/data.js` | **All site content. Edit this.** |
| `assets/member-data.js` | **All member-hub content.** Loaded only after sign-in. |
| `assets/js/auth.js` | Sign-in: PBKDF2 via the browser's WebCrypto, sessions, admin check |
| `data/members.json` | The accounts — salts and hashes, never plaintext |
| `admin/index.html`, `admin/photos.html` | Admin pages (admin accounts only) |
| `admin/gate.js` | The gate on every admin page |
| `tools/make-member.py` | Add, list and remove accounts |
| `SECURITY-NOTES.md` | **What this sign-in protects and what it doesn't. Read it.** |
| `assets/app.js` / `app.css` | Member hub: sign-in form, calendar, updates, resources, Q&A, directory |
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
| What | Static page, per-person username + password | Real app: accounts, roles, database |
| Runs on | GitHub Pages, this repo | Next.js + Supabase, deployed separately |
| Security | Hashes checked in the browser — the file is public | Row-level security in Postgres |

`members.html` is live now and documented below. `app/` is the real
application being built alongside it — see `app/README.md` for setup. Once the
app covers what the static page does, the static page can retire.

---

## The member hub (`members.html`)

Members sign in with a username and password to get to the season hub.
Everything after that is one scrolling page — calendar, updates, resources, the
Q&A board (channel chips + expandable answers), and the club directory — with a
jump bar at the top. No tabs and no side rails, so it works the same on a phone
as on a laptop.

**Editing it:** the hub's content lives in `assets/member-data.js` —
announcements, calendar, resource links, channels, and seeded Q&A. It's kept out
of `data.js` on purpose, because the admin content manager rewrites `data.js`
wholesale and would wipe it.

**Accounts:** everyone has their own login. Add, list and remove them with

```bash
python3 tools/make-member.py --user jdoe --name "J Doe" --role Curator --kind admin
python3 tools/make-member.py --list
python3 tools/make-member.py --remove jdoe
```

Passwords are stored as PBKDF2-SHA256 hashes (210,000 iterations, random salt
per user) in `data/members.json` and checked in the browser with WebCrypto. No
third-party identity provider, no auth SDK, no CDN script. Commit and push
`data/members.json` for a change to go live.

The repo ships with a starter `admin` and `member` account whose passwords are
written down in `SECURITY-NOTES.md` — which means they're public. Replace them
before the site is doing anything real.

**Admin pages:** `admin/index.html` and `admin/photos.html` require an account
with `kind: admin`. `admin/gate.js` hides the page before anything renders and
only reveals it for an admin session; a member sees an "admins only" screen and
a signed-out visitor is sent to the sign-in page. Saving from the content
manager still needs your own GitHub token — the sign-in decides who sees the
tool, the token decides who can change the site.

**What the sign-in is and isn't:** this is a static site, so `data/members.json`
is downloadable by anyone and the hashes can be attacked offline. PBKDF2 makes
that slow, which is enough for "members only, please" material — schedules,
resources, internal links, Q&A — and not enough for secrets, credentials, or
personal data about members. Real access control means putting the site behind
something that authenticates before serving the page (Cloudflare Access,
Netlify password protection); that's a hosting change, not a code change.
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
   we never publish a name we can't source. A lead with no photo path renders
   as an initials monogram.

---

## Note on structure

This is a **multi-file** build because that's what a girlgains-style multi-page
site needs — a departure from the single-`index.html` approach used elsewhere.
Each page is a thin shell; the shared brain is in `assets/`.

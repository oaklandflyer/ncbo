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
| `members.html` | Member hub — access-code gate + member area |
| `clubs.html`, `start-a-club.html`, `about.html`, `faqs.html` | Redirect stubs → the matching `index.html#` section (old links keep working) |
| `assets/data.js` | **All site content. Edit this.** |
| `assets/member-data.js` | **All member-hub content, including the access code.** |
| `assets/app.js` / `app.css` | Member hub: gate, calendar, updates, resources, Q&A, directory |
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
| What | Static page, shared access code | Real app: accounts, roles, database |
| Runs on | GitHub Pages, this repo | Next.js + Supabase, deployed separately |
| Security | Convenience lock (code is readable in the JS) | Row-level security in Postgres |

`members.html` is live now and documented below. `app/` is the real
application being built alongside it — see `app/README.md` for setup. Once the
app covers what the static page does, the static page can retire.

---

## The member hub (`members.html`)

Members enter an access code to get to the season hub. Everything after that is
one scrolling page — calendar, updates, resources, the Q&A board (channel chips
+ expandable answers), and the club directory — with a jump bar at the top. No
tabs and no side rails, so it works the same on a phone as on a laptop.

**Editing it:** everything lives in `assets/member-data.js` — the access code,
announcements, calendar, resource links, channels, and seeded Q&A. It's kept out
of `data.js` on purpose, because the admin content manager rewrites `data.js`
wholesale and would wipe it.

**Rotating the code:** change `access.codes` in `assets/member-data.js`. Members
who ticked "keep me signed in" are signed out automatically once the old code
stops matching. You can list more than one code if you want a club-lead code
alongside the member one.

**What the gate is and isn't:** this is a static site with no server, so the
code is a convenience lock, not authentication — anyone who opens dev tools can
read it out of the file. Treat what's behind it like a printed members-only
handout: fine for schedules, resources, and Q&A; not for personal contact info,
payment details, or anything you'd be upset to see forwarded. If you need a real
login later, that means adding a backend (or a host like Netlify with password
protection).

The Q&A ask box saves drafts to the member's own browser only; set
`ask.form` in `member-data.js` to a Google Form link to give them a real way to
send questions in.

---

## Note on structure

This is a **multi-file** build because that's what a girlgains-style multi-page
site needs — a departure from the single-`index.html` approach used elsewhere.
Each page is a thin shell; the shared brain is in `assets/`.

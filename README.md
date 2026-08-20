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
| `clubs.html`, `start-a-club.html`, `about.html`, `faqs.html` | Redirect stubs → the matching `index.html#` section (old links keep working) |
| `assets/data.js` | **All site content. Edit this.** |
| `admin/` | Website content manager at `/admin/`, behind a passphrase. See `admin/README.md` |
| `app/` | **The member hub — Next.js + Supabase.** Everything behind sign-in. |
| `SECURITY-NOTES.md` | **What protects the member area, and what doesn't. Read it.** |
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

## Two halves of this repository

| | The public site | `app/` |
|---|---|---|
| What | Marketing pages: home, join, contact, news | The member hub, behind sign-in |
| Built with | Hand-written HTML + `assets/site.js`, no build step | Next.js 15 + React 19 |
| Runs on | GitHub Pages, from this repo, at thencbo.org | Deployed separately |
| Data | `assets/data.js` | Supabase Postgres |
| Access control | None — it is a public website | Row-level security in Postgres |

The static member hub that used to live at `members.html` is gone. It was a
prototype, and everything it did — sign-in, the approval queue, the board — is
now the Next.js app. See `app/README.md` and `docs/SUPABASE-SETUP.md`.

> **The public nav links to the hub at `https://hub.thencbo.org/login`.** It is
> defined once in `assets/data.js` (`nav`) and rendered onto every page by
> `assets/site.js`, with a matching entry in the footer's Explore column — no
> page has its own nav markup, so that one entry is the whole change.

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

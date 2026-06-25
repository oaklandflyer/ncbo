# NCBO Website

Multi-page site for the National Collegiate Bodybuilding Organization.
Structure modeled on girlgains.co (community-first, multi-page) wrapped in NCBO's
own brand — navy `#0A1228`, steel blue `#5B86C4`, silver `#C9CDD1`, Barlow
Condensed headings. No shop.

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
| `index.html` | Home |
| `join.html` | Become a Member |
| `clubs.html` | Find a Club |
| `start-a-club.html` | Start a Club (with application form) |
| `about.html` | Who We Are — mission, model, leadership, advisory |
| `faqs.html` | FAQ accordion |
| `contact.html` | Contact info + form |
| `news.html` | News & Updates |
| `assets/data.js` | **All site content. Edit this.** |
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

## Note on structure

This is a **multi-file** build because that's what a girlgains-style multi-page
site needs — a departure from the single-`index.html` approach used elsewhere.
Each page is a thin shell; the shared brain is in `assets/`.

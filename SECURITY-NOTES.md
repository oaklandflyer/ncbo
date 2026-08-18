# Security notes — what the NCBO sign-in is, and what it isn't

Read this before you decide what to put in the member area.

## What changed

The member area used to be a username and password checked **in the browser**,
against PBKDF2 hashes committed to this repository as `data/members.json`. That
file was public, like every other file on a static site, so the hashes could be
attacked offline by anyone who downloaded it.

It is gone. Sign-in is now a magic link handled by **Supabase**, and the thing
that decides what a member may read is **row-level security in Postgres**. The
password file, the hashes, and `tools/make-member.py` have been deleted from the
working tree and purged from this repository's history.

If you cloned or forked this repo before that change, your copy still contains
the old hashes. Delete it and re-clone.

## What actually protects what

| Layer | What it decides | Where |
|---|---|---|
| Row-level security | What a signed-in account may **read or write** | `app/supabase/migrations/` |
| `handle_new_user()` | Whether a new account is approved or pending | same |
| `assets/ncbo-auth.js` | Which panel is **drawn** on `members.html` | this repo |
| `admin/gate.js` | Whether the admin pages are revealed | this repo |

Only the first two are security. The other two are presentation: hiding a panel
is not access control, because anyone can call the Supabase API directly with
their own session token. Every table in the schema has RLS enabled and no table
is readable or writable except through an explicit policy — that is the part
that holds.

## The honest limit that remains

This site is still static files on GitHub Pages, so **every file committed to
this repository is served to anyone who asks for it**, including:

- `assets/member-data.js` — the member hub's content
- `admin/index.html`, `admin/photos.html`, `review.html` — the admin pages
- `assets/supabase-config.js` — the project URL and anon key

The anon key being public is fine and intended: it identifies the project, not
the person, and grants nothing on its own. The **`service_role` key is the
opposite** — it bypasses RLS entirely. It must never appear in this repository,
in a page, or in a browser. `test/guards.sh` checks for it.

What this means for content:

**Fine committed here:** meeting notes, internal links, the season calendar,
resource drafts, club operations documents.

**Not fine committed here:** anything you'd be upset to see forwarded — member
contact details, addresses, dues or payment information, health or body-
composition data, judging keys, credentials or API tokens for anything.

Anything genuinely private belongs in a Supabase table behind a policy, not in
`assets/member-data.js`.

## Accounts, approval, and roles

Anyone may request a sign-in link. What happens next is decided by the database,
in `public.handle_new_user()`:

| Address | Result |
|---|---|
| `.edu` at a school in `public.schools` | **Approved** — the address proves the affiliation |
| On the `allowed_emails` staff list | **Approved** — pre-vetted advisors and exec |
| Any other `.edu` | **Pending** — a real student at a school with no club yet |
| Anything else | **Pending** — an admin decides |

Pending accounts can sign in and see their own status. They cannot read the
board. An admin clears the queue on `review.html`.

Roles are `member` → `club_lead` → `advisor` → `admin`, least to most
privileged. The order of `ROLES` in `assets/ncbo-auth-core.js` mirrors the
`public.user_role` enum and is **load-bearing**: `roleAtLeast()` compares by
index, so inserting a role in the middle silently changes who can reach what.

## Admin pages

`admin/gate.js` is the first script in the `<head>` of every admin page. It
hides the body before anything renders, loads the Supabase stack, reads the
session and that account's `profiles` row, and removes the hiding style only for
an **approved admin**. Anything else — no session, a member session, a script
failing to load, a query throwing — leaves the body hidden behind an overlay. It
fails closed.

Per the section above, the admin HTML is still a static file anyone can fetch and
read. **The thing that protects the live site is the GitHub personal access
token**, which each admin enters on the page and which is never stored in this
repo. Keep tokens fine-grained, scoped to this one repository,
`Contents: Read and write` and nothing else.

## Deliberate details, so nobody "simplifies" them away

- **Sign-in never says whether an address has an account.** The same
  "check your inbox" panel comes back either way. Anything else is an
  enumeration oracle.
- **A missing `profiles` row is treated as pending, never approved.**
  `viewFor()` and `canReadHub()` both fail towards the least revealing panel.
- **An unrecognised status is pending, not approved.** `normalizeStatus()`
  refuses to guess.
- **Member content is not fetched until the hub actually renders.**
  `assets/member-data.js` is loaded on demand by `buildHub()`, so a browser
  sitting on the sign-in screen never requests it. That is bandwidth and tidiness,
  not protection — the file is public either way.
- **Sign-out clears the old gate's storage keys** (`ncbo-session-v1`,
  `ncbo-member-access`), so a device left "signed in" under either previous
  scheme doesn't keep a stale record of who used it.
- **`assets/ncbo-auth-core.js` has no DOM, no network and no SDK**, so every
  rule above is unit-tested by `node test/core.test.js` without a browser.

## Rotating access

- **Remove someone:** set their `profiles.status` to `suspended` on
  `review.html`. Their next request is refused by policy.
- **Rotate the project keys:** Supabase dashboard → Project Settings → API, then
  update `assets/supabase-config.js` and bump the `?v=` cache-busting date on the
  script tags.
- **A leaked `service_role` key** is an emergency: rotate it in the dashboard
  immediately. It is not repairable by editing this repository.

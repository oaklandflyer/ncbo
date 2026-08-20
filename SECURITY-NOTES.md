# Security notes — what protects the NCBO member area

> **This file has no history before 2026-08-18.** Earlier revisions documented
> two starter accounts *and printed their passwords in plaintext*, so the whole
> path was purged from every branch with `git filter-repo`. What follows is the
> current text, re-added as a new file. Nothing here is a credential.

Read this before you decide what to put in the member area.

## What changed

The member area used to be a username and password checked **in the browser**,
against PBKDF2 hashes committed to this repository. That file was public, like
every other file on a static site, so the hashes could be attacked offline by
anyone who downloaded it.

It is gone. The member hub is the Next.js app in `app/`, sign-in is a magic
link handled by **Supabase**, and what decides what a member may read is
**row-level security in Postgres**. The password file, the hashes, the
account-minting script and the starter passwords have been deleted and purged
from every branch's history.

**If you cloned or forked this repo before 2026-08-18, your copy still contains
all of it.** Delete the clone and take a fresh one — a rewrite upstream does
not reach into copies. The same is true of the pull-request refs GitHub keeps:
they hold pre-rewrite commits until GitHub Support garbage-collects them.

## What actually protects what

| Layer | What it decides | Where |
|---|---|---|
| Row-level security | What a signed-in account may **read or write** | `app/supabase/migrations/` |
| `handle_new_user()` | Whether a new account is approved or pending | same |
| `guard_profile_privileges()` | Who may change a role, a status, or the 18+ attestation | same |
| `app/src/app/hub/layout.js` | Which screen a signed-in account is **shown** | `app/` |

Only the first two are security. The other two are presentation: hiding a panel
is not access control, because anyone can call the Supabase API directly with
their own session token. Every table in the schema has RLS enabled and no table
is readable or writable except through an explicit policy — that is the part
that holds.

## The honest limit that remains

This site is still static files on GitHub Pages, so **every file committed to
this repository is served to anyone who asks for it**, including:

- `assets/data.js` — everything on the public marketing site
- every page the Pages build publishes

`admin/` is excluded from that build, so the content manager is not served at
all. It is still readable in this public repository — that is the point of the
next section: its URL was never what protected anything.

The anon key being public is fine and intended: it identifies the project, not
the person, and grants nothing on its own. The **`service_role` key is the
opposite** — it bypasses RLS entirely. It must never appear in this repository,
in a page, or in a browser.

What this means for content:

**Fine committed here:** meeting notes, internal links, the season calendar,
resource drafts, club operations documents.

**Not fine committed here:** anything you'd be upset to see forwarded — member
contact details, addresses, dues or payment information, health or body-
composition data, judging keys, credentials or API tokens for anything.

Nothing member-only is served from this repository any more — the member hub is
the Next.js app in `app/`, and everything it shows comes from Supabase through a
policy. Keep it that way: content committed here is public content.

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
board. An admin clears the queue at `/hub/admin`.

**Declined is not suspended.** `rejected` means an admin read the application
and said no; `suspended` means an approved member's access was stopped. They get
different screens, and `admin_actions` records which decision was made, by whom,
and what the status was before it.

**Club leads review their own school.** A `club_lead` may approve or decline a
*pending* account whose `school_id` matches theirs, and log that decision.
They cannot reach another school, change any role, suspend an approved member,
or revisit a decision. A lead with no school assigned reviews nobody. This is
`leads_school_of()` in the policies and the privilege guard, not a hidden
button — `/hub/admin` refuses a lead the roles table even if they navigate to
it directly.

**The audit log is append-only.** `admin_actions` has policies for insert and
select and none for update or delete, so with RLS on, an admin cannot edit or
erase a decision through the API — including their own.

Roles are `member` → `club_lead` → `advisor` → `admin`, least to most
privileged, matching the `public.user_role` enum. The order is **load-bearing**
wherever it is compared by index — inserting a role in the middle silently
changes who can reach what.

## Admin pages

The content manager under `admin/` is **not published**: `_config.yml` excludes
it from the Pages build, and it is meant to be run from a local checkout
(`python3 -m http.server`, then `localhost:8000/admin/`). It has no sign-in,
because a login on a static page that anyone can download is theatre. Anything else — no session, a member session, a script
failing to load, a query throwing — leaves the body hidden behind an overlay. It
fails closed.

**The thing that protects the live site is the GitHub personal access token**,
which the editor enters on the page and which is never stored in this repo.
Without a token holding write access to this repository, the tool can display
the site's content and change nothing. Keep tokens fine-grained, scoped to this one repository,
`Contents: Read and write` and nothing else.

## Deliberate details, so nobody "simplifies" them away

- **Sign-in never says whether an address has an account.** The same
  "check your inbox" message comes back either way. Anything else is an
  enumeration oracle.
- **A missing `profiles` row is treated as pending, never approved**, and the
  hub page fails closed on a null profile rather than trusting the layout to
  have redirected — layouts and pages render in parallel.
- **An unrecognised status is not approved.** The layout matches `pending`,
  `rejected` and `suspended` explicitly and treats anything else as unapproved.
- **The 18+ attestation can only be made by the member themselves.** The
  privilege guard checks that before the admin bypass, so not even an admin can
  tick it for someone else — a legal statement made by the wrong person is worth
  nothing.
- **Onboarding runs before the approval queue**, so an admin decides about a
  person with a name and a school year rather than an email address.
- **`display_name` is never manufactured from an email address.** Guessing
  "a.swanson24" from an address and printing it on a roster is worse than
  asking.

## Rotating access

- **Remove someone:** suspend them at `/hub/admin`. Their next request is
  refused by policy, and the decision lands in `admin_actions`.
- **Rotate the project keys:** Supabase dashboard → Project Settings → API, then
  update the app's `NEXT_PUBLIC_SUPABASE_*` environment variables. Nothing static
  in this repository holds them any more.
- **A leaked `service_role` key** is an emergency: rotate it in the dashboard
  immediately. It is not repairable by editing this repository.

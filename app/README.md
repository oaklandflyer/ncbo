# NCBO Member App

The real member application — accounts, roles, and a database. Separate from
the marketing site in the repo root, which stays a static GitHub Pages build.

**Stack:** Next.js (App Router) · Supabase (Postgres + Auth + row-level
security) · deployed on Vercel. All three have free tiers that fit an
organisation this size.

**What's built so far:** magic-link sign-in, the membership model, a
university picker that resolves to one chapter, the club lead's approval
queue, the reusable profile popup, the four verification paths, the
competition calendar, national rankings, three persona-driven Home layouts,
the Topics channels, the Q&A board, and the resource vault.

---

## The one thing to understand

**Permissions live in the database, not in this app.** Every table has
row-level security, and the policies in
`supabase/migrations/` are what decide who can read and write
what. The React code hides buttons people can't use, but that's courtesy —
anyone can call the Supabase API directly with their own session token, so if
a rule isn't in a policy, it isn't enforced.

Two consequences worth keeping in mind when you edit things:

- **Never put the `service_role` key in this app.** That key bypasses RLS
  entirely. It belongs in the Supabase dashboard and nowhere else. This app
  only ever uses the anon key, which is safe to ship to browsers precisely
  because RLS constrains it.
- **Run the policy tests after touching a policy** (`npm run db:test`). A
  broken policy fails silently — the app keeps working and just shows people
  more than it should. See `supabase/tests/`.
- **Schema changes go through `npm run db:push`, not the dashboard editor.**
  The CLI keeps a ledger of what's applied; pasting SQL by hand doesn't, and
  a migration skipped that way can install a function that only fails later.
  See `supabase/README.md`.

---

## Setup

### 1. Create the Supabase project

At [supabase.com](https://supabase.com), create a project. From
**Settings → API**, copy the project URL and the `anon` public key.

### 2. Run the migrations

Through the CLI, never the dashboard SQL editor — see `supabase/README.md`
for why that distinction earned its own section.

```sh
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npm run db:push
```

### 3. Configure auth

**Authentication → Providers → Email**: enable it, and turn *off* "Confirm
email" only if you want faster testing — leave it on for production. Sign-in
is by magic link, so there are no passwords to manage.

**Authentication → URL Configuration**: set the Site URL to your deployed
origin, and add `https://your-domain/auth/callback` to Redirect URLs (plus
`http://localhost:3000/auth/callback` while developing).

### 4. Make yourself an admin

You need a profile row before you can be promoted, and the trigger creates one
on signup. You don't need the app running for this — **Authentication → Users
→ Add user** fires the same trigger.

Add a user with whatever address you want as the founding admin. Every account
comes out live now, so it genuinely does not matter which address you use.

Then, in the SQL Editor:

```sql
insert into public.org_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@yourschool.edu';
```

That is the whole of it: `profiles.role` is derived from this table and the
trigger will bring it into line. Setting `profiles.role` by hand would work
until the next membership change overwrote it.

The SQL Editor can do this because the privilege guard allows trusted
server-side contexts — that's the bootstrap path, since there's no admin yet
to authorise it. From then on, use **Admin → Members & roles** in the app.

(This one is fine to run in the dashboard: it's a one-off data change to a
single row, not a schema change, so it doesn't belong in a migration.)

### 5. Run it

```sh
cp .env.example .env.local   # fill in URL + anon key
npm install
npm run dev
```

### 6. Push notification keys

```sh
npm run push:keys
```

Prints a VAPID pair and where each half goes. Nothing is written to disk: the
private key signs pushes on behalf of the whole organisation, and a generated
key that lands in a file is a key that gets committed. Put both in
`.env.local`, and both in Vercel.

The pair is permanent in practice. A subscription is bound to the public key
it was created with, so regenerating invalidates every row in
`push_subscriptions` and every member has to turn the toggle back on.

### 7. Deploy

Import the repo into Vercel with **Root Directory set to `app`**. Add the
variables from `.env.example` as environment variables, with
`NEXT_PUBLIC_SITE_URL` set to the production origin. Point
`app.thencbo.org` at it and add that origin to Supabase's redirect URLs.

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` is read at build time, so add it before the
deploy that should have working notifications — an existing deployment will
not pick it up. Without it the toggle renders disabled and says so, rather
than failing when somebody taps it.

---

## Roles

### Who can have an account

Anyone, with any address, and the account is live immediately.

That is a reversal, and it is worth saying why. The app used to require a
`.edu`, on the reasoning that a `pitt.edu` address proves somebody is at Pitt
better than a human scanning a queue can. The reasoning was sound and the
premise was wrong: students do not read the inbox their school gave them and
will not keep a password on it, so the requirement turned away the people it
was meant to admit while stopping nobody who can guess an address format.

So the address went back to being a way to send somebody a link, and proving
somebody is a student moved to a person who would know.

### Two different questions

| Question | Where it lives | Who answers it |
|---|---|---|
| May this person sign in? | `profiles.status` | Nobody. Signup answers it |
| Is this person a student at this chapter? | `club_memberships` | That chapter's club lead |
| Are they current on dues? | `membership_dues` | Their club lead, per term |
| Do they run part of NCBO? | `org_roles` | An admin |

Keeping these apart is what makes the rest work. A member whose dues lapse
loses the gated surfaces without needing to be re-verified. A coaching advisor
holds an org role and appears on no chapter's roster. An admin who is also a
student at Iowa appears on Iowa's roster as a member, because of the
membership and not the org role.

### What verification gates, and what it does not

Open to anyone with an account: browsing the board, the competition calendar,
reading Q&A, discovering clubs. Gating those would cost more members than it
protects, and the whole point of a national organisation is that a stranger at
a school with no chapter can look around.

Gated behind a verified membership: appearing on a chapter roster, posting in
chapter-private spaces, the member dues rate, and competition registration.

### The four ways to get verified

In the order they are meant to carry load:

1. **A club lead vouches for you.** The default path, and the one the club
   queue is built around. Everything signup collects is on one card, including
   the group-chat handle, which is there so a lead can match a name to a face.
2. **Three verified members of your chapter vouch for you.** Auto-approves,
   and tells the lead rather than asking them. A stronger signal than one
   person skimming a list, and free.
3. **A one-time code to a school email.** Optional and never required. Any
   subdomain counts, because schools are inconsistent about them. The address
   never becomes a login and is never written to `auth.users`.
4. **A student ID photo.** Uploaded at signup if the person wants to, reviewed
   by the lead inside the approval card.

`club_memberships.verification_method` records which one was used, so the
claim that lead vouching carries the load can be checked against what people
actually do.

### The approval queue belongs to club leads

Applications go to the lead at that chapter, not to an admin. An admin can
open any queue for support and is deliberately not notified about any of them:
being the fallback approver is what let the old queue back up in exactly the
weeks it mattered.

Leads get one digest a day rather than a push per application. Anything
sitting more than 72 hours escalates to the co-lead, then to Club Relations.
A club that is down to one approver is warned about it, because leadership
turns over in May and December and a chapter with zero approvers cannot admit
anybody.

### Staying signed in

Sign-in is a magic link, but that's a one-time cost per device, not per visit
— Supabase issues a refresh token, so people stay signed in until they
explicitly sign out.

### What each role can do

Club roles come from a membership; org roles come from `org_roles`. The two
are never substituted for each other.

| Role | Where | Can |
|---|---|---|
| `member` | membership | Read everything open, post, ask questions, edit their own profile |
| `co_lead` | membership | Work their own chapter's queue and roster |
| `club_lead` | membership | The same, plus name co-leads. Appointed by an admin |
| `coaching_advisor` | org role | Answer questions and moderate posts |
| `exec_board`, `board_of_directors` | org role | See where NCBO should expand next |
| `admin` | org role | Everything, plus roles, accounts and reference data |

`profiles.role` still exists and every policy written before the membership
model still reads it, but nobody writes it: it is derived from the two tables
above and kept in step by trigger.

## Privacy

Email addresses are never copied into `profiles`. They stay in `auth.users`,
which clients cannot read at all; a member's own address comes from their
session. This is why the admin page shows no emails — look one up in the
Supabase dashboard if you need it.

Anonymous posts are anonymised **in Postgres**, not in the browser. Members
read the board through the `post_feed` / `question_feed` views, which replace
the author with `'Anonymous'` before the row leaves the database; the base
tables aren't readable by ordinary members at all. Moderators can still see
authorship on the base tables, because moderation needs it — worth telling
members that, rather than implying anonymity is absolute.

## If members suddenly cannot sign in

The first thing to check is whether the database is behind the app.

**Deploying updates the app; it does not run migrations.** Merging to `main`
ships new code to Vercel within a minute or two, and the schema that code
expects is still whatever was last pushed with `npm run db:push`. When the two
drift, every profile query fails, and the symptom is that sign-in appears to be
broken: the magic link works, the session is created, and the member is bounced
straight back to the sign-in page.

```sh
cd app
npm run db:status   # what's applied locally vs remotely
npm run db:push     # apply anything missing
```

The app now says this on screen instead of redirecting, and logs the underlying
error (`[ncbo] profile query failed`) to the server log. If the error mentions a
column or a relationship, it is this.

The other common cause is a **paused Supabase project**: the free tier pauses
after about a week without traffic. Un-pause it from the dashboard.

## Known limits

- **Supabase free tier pauses a project after about a week without traffic.**
  For a seasonal club app that likely means a manual un-pause each autumn.
- **Vercel's free Hobby tier is licensed for non-commercial use.** If NCBO
  starts charging dues, check the current terms — Cloudflare Pages and Netlify
  are free alternatives without that clause.
- Channel replies (`posts.parent_id`) exist in the schema but have no UI yet.
- Per-channel post counts on `/hub/topics` are one query per channel. Fine at
  six channels; replace with a grouped view before it's sixty.

## Rankings, and why they are scored the way they are

The rankings are the only thing in this app that no single chapter could build
for itself, which is why they were built before another forum surface.

**A result becomes points through one function**, `placement_points()`. First
is 100, second 85, third 72, then 61, 52, 44; seventh and below is 30, and
competing without recording a placement is 20. The curve is steep at the top
because the gap between first and second is real, and flat at the bottom
because the gap between eighth and ninth is noise. That is then scaled by the
show's level (regional 1.25, national 1.6), by class size up to 1.5, and by
35 percent for an overall title.

**Results are self-reported and confirmed by somebody else.** A member enters
their own placement; their club lead or the exec board confirms it. Waiting for
a central admin to transcribe everything means the table is permanently a month
stale, and people who check once and see last season stop checking. An
unconfirmed result scores zero and appears nowhere, which is what stops the
leaderboard being self-service. Nobody confirms their own.

**A chapter scores its best five members, not its total.** Summing everybody
would measure recruitment and call it competitiveness: Pitt would win by
existing. `competition_entries.club_id` is stamped from the entrant's active
membership at entry time, so a graduating senior's results stay with the
chapter they actually competed for.

The whole model is one function and two views, so changing it is one diff and
one review.

## The Q&A starter library

The board ships with 30 answered questions, seeded by
`20260823000019_qa_starter_library.sql`. They exist because the Home layout for
"already lifting, new to bodybuilding" leads with Q&A, and an empty board
answers "what is this for" with "nothing".

**They are attributed to an editorial account, not to a named advisor.** The
coaching advisors' names are the reason a member trusts what that board says,
and seeding answers under one of them would put words in a real person's mouth.
Every seeded answer carries a `[starter]` marker, so once the advisors write
their own the whole set clears in one statement:

```sql
delete from public.answers where body like '%[starter]%';
```

Treat these as drafts for the advisors to adopt, rewrite, or delete.

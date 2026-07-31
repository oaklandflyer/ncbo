# NCBO Member App

The real member application — accounts, roles, and a database. Separate from
the marketing site in the repo root, which stays a static GitHub Pages build.

**Stack:** Next.js (App Router) · Supabase (Postgres + Auth + row-level
security) · deployed on Vercel. All three have free tiers that fit an
organisation this size.

**What's built so far:** magic-link sign-in with an approval queue, the four
roles, a club home, the Topics channels, and the Q&A board. Events, standings,
check-in, tokens, and the club-lead surfaces are not built yet.

---

## The one thing to understand

**Permissions live in the database, not in this app.** Every table has
row-level security, and the policies in
`supabase/migrations/0001_init.sql` are what decide who can read and write
what. The React code hides buttons people can't use, but that's courtesy —
anyone can call the Supabase API directly with their own session token, so if
a rule isn't in a policy, it isn't enforced.

Two consequences worth keeping in mind when you edit things:

- **Never put the `service_role` key in this app.** That key bypasses RLS
  entirely. It belongs in the Supabase dashboard and nowhere else. This app
  only ever uses the anon key, which is safe to ship to browsers precisely
  because RLS constrains it.
- **Run the policy tests after touching a policy.** A broken policy fails
  silently — the app keeps working and just shows people more than it should.
  See `supabase/tests/`.

---

## Setup

### 1. Create the Supabase project

At [supabase.com](https://supabase.com), create a project. From
**Settings → API**, copy the project URL and the `anon` public key.

### 2. Run the migration

**SQL Editor → New query**, run each file in `supabase/migrations/` in
order: `0001_init.sql`, `0002_allowed_emails.sql`, `0003_approvals.sql`.
Together they create the schema and policies, seed the six channels plus the
founding schools and clubs, and add the staff allowlist and approval queue.

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

Add a user with whatever address you want as the founding admin — a `.edu` at
a seeded school will come out approved, anything else comes out pending. It
doesn't matter which, because the next step overrides both.

Then, in the SQL Editor:

```sql
update public.profiles
   set role = 'admin', status = 'approved', approved_at = now()
 where id = (select id from auth.users where email = 'you@yourschool.edu');
```

The SQL Editor can do this because the privilege guard allows trusted
server-side contexts — that's the bootstrap path, since there's no admin yet
to authorise it. From then on, use **Admin → Members & roles** in the app.

### 5. Run it

```sh
cp .env.example .env.local   # fill in URL + anon key
npm install
npm run dev
```

### 6. Deploy

Import the repo into Vercel with **Root Directory set to `app`**. Add the
three variables from `.env.example` as environment variables, with
`NEXT_PUBLIC_SITE_URL` set to the production origin. Point
`app.thencbo.org` at it and add that origin to Supabase's redirect URLs.

---

## Roles

### Who can have an account

Anyone can sign up. What varies is whether the account goes live immediately
or waits for you:

| Address | What happens |
|---|---|
| `.edu` at a school NCBO already runs | **Approved instantly**, linked to that school |
| On the `allowed_emails` list | **Approved instantly** — pre-vetted staff |
| Anything else | **Pending** until an admin approves it |

The reasoning: a `pitt.edu` address has already proved the person is at Pitt,
better than a human scanning a queue can. Making an admin approve every
student would be manual work duplicating a check the database does for free —
and the queue would back up exactly during recruiting season. So the queue
holds only the accounts that genuinely need judgment: advisors, exec team,
graduates, and students at schools not yet in NCBO.

Pending accounts can sign in and see their own status. They cannot read the
board — enforced by policy, not by the UI. Approve them at
**Admin → Waiting for approval**.

`allowed_emails` is now optional: it's a shortcut for staff you already know
are coming, so they skip the queue. Without it they simply land in the queue
like anyone else.

### Staying signed in

Sign-in is a magic link, but that's a one-time cost per device, not per visit
— Supabase issues a refresh token, so people stay signed in until they
explicitly sign out.

| Role | Can |
|---|---|
| `member` | Read everything, post to channels, ask questions, edit their own profile |
| `club_lead` | Everything a member can, plus edit their own club's record |
| `advisor` | Everything a member can, plus **answer questions** and moderate posts |
| `admin` | Everything, plus assign roles and clubs, and edit reference data |

New signups are `member`. Only an admin can change a role, approve an account,
or reassign a club — all enforced by the `guard_profile_privileges` trigger,
so they hold even if someone calls the API directly. Without that trigger, "a
member may edit their own profile" would let a pending account approve itself.

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

## Known limits

- **Supabase free tier pauses a project after about a week without traffic.**
  For a seasonal club app that likely means a manual un-pause each autumn.
- **Vercel's free Hobby tier is licensed for non-commercial use.** If NCBO
  starts charging dues, check the current terms — Cloudflare Pages and Netlify
  are free alternatives without that clause.
- Channel replies (`posts.parent_id`) exist in the schema but have no UI yet.
- Per-channel post counts on `/hub/topics` are one query per channel. Fine at
  six channels; replace with a grouped view before it's sixty.

# NCBO Member App

The real member application — accounts, roles, and a database. Separate from
the marketing site in the repo root, which stays a static GitHub Pages build.

**Stack:** Next.js (App Router) · Supabase (Postgres + Auth + row-level
security) · deployed on Vercel. All three have free tiers that fit an
organisation this size.

**What's built so far:** sign-in with a `.edu` address, the four roles, the
Topics channels, and the Q&A board. Events, standings, check-in, tokens, and
the club-lead surfaces are not built yet.

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
order — `0001_init.sql` first, then `0002_allowed_emails.sql`. Together they
create the schema and policies, seed the six channels plus the founding
schools and clubs, and add the staff allowlist.

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

**If you have a `.edu` address**, add a user with it and skip to the SQL below.

**If you don't** — you've graduated, or you're an advisor from the industry —
allowlist yourself first, in the SQL Editor:

```sql
insert into public.allowed_emails (email, note)
values ('you@gmail.com', 'Founder');
```

Then add the user. Do the same for every advisor and exec-team member who
isn't a current student: allowlist the address, then they can sign in. Being
on the list only grants entry — everyone still arrives as `member`, and an
admin promotes them.

Now promote yourself, in the SQL Editor:

```sql
update public.profiles set role = 'admin'
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

Members sign in with a `.edu` address — that's what ties them to a school and
a club, and it's enforced by a trigger, not by the UI.

Everyone else — advisory board, exec team, anyone who has graduated — needs
their address added to `allowed_emails` first, by an admin. That list is
admin-only to read as well as write; it's a staff roster, and members have no
reason to see it. Allowlisted accounts get no school affiliation, because
they aren't students.

| Role | Can |
|---|---|
| `member` | Read everything, post to channels, ask questions, edit their own profile |
| `club_lead` | Everything a member can, plus edit their own club's record |
| `advisor` | Everything a member can, plus **answer questions** and moderate posts |
| `admin` | Everything, plus assign roles and clubs, and edit reference data |

New signups are `member`. Only an admin can change a role — enforced by the
`guard_profile_privileges` trigger, so it holds even if someone calls the API
directly.

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

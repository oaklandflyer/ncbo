# Supabase setup — connecting the member hub

What someone with the Supabase dashboard open has to do, in order, to take the
member hub (`app/`) from nothing to a working sign-in.

Everything here is dashboard and SQL work plus **two values** put into the
app's environment. No application code changes.

---

## 1. Create the project

Supabase dashboard → **New project**. Pick a region near the members (US East
for this org). Note the database password somewhere safe — it is not the same
thing as the keys below and is not needed by this site.

## 2. Apply the migrations, in order

**SQL Editor** → paste and run each file, oldest first:

1. `20260731000001_init.sql`
2. `20260731000002_allowed_emails.sql`
3. `20260731000003_approvals.sql`
4. `20260818000004_onboarding.sql`
5. `20260818000005_rejected_status.sql`
6. `20260818000006_admin_actions.sql`

All under `app/supabase/migrations/`. Order matters — each of 0002, 0003 and
0004 rewrites `handle_new_user()`, and 0006 uses the enum value 0005 adds.
`npm run db:push` from `app/` applies them in order for you.

What you get: the schema, row-level security on every table, the six founding
schools with their email domains already seeded, their clubs, and the six
channels. Because the schools are seeded, a `.edu` address at Pitt, Penn State,
Slippery Rock, Purdue, Iowa or FSU is **approved automatically** — nothing to
configure for that.

Check it landed: `select domain from public.schools;` should return six rows.

## 3. Auth settings

**Authentication → Providers → Email**: enabled. This project uses magic links
(`signInWithOtp`), so no password settings matter.

**Authentication → URL Configuration** — this is the step that silently breaks
sign-in if it is skipped. The sign-in link comes back to `/auth/callback`, and
Supabase refuses any redirect not on the allowlist:

- **Site URL:** the app's deployed URL
- **Redirect URLs:**
  - `<app URL>/auth/callback`
  - `http://localhost:3000/auth/callback` (development only)

A link that opens and bounces straight back to a signed-out page is almost
always a missing entry here.

## 4. Email delivery

The built-in Supabase SMTP is rate-limited to a handful of messages per hour and
is explicitly not for production. It is fine for testing the flow today; before
members are told to sign in, set up **custom SMTP** under
**Project Settings → Auth → SMTP Settings**, with a domain that has SPF/DKIM
configured — otherwise the links land in spam.

If testers see a rate-limit message, that is the built-in limit, not a bug.

## 5. Fill in the two public values

**Project Settings → API**, then set the app's environment (`app/.env.local`
locally, and the same two on the host):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon / publishable key>
```

The static content manager under `admin/` needs the same two values in the
constants at the top of `admin/gate.js`.

Both are public by design and safe to commit — the anon key grants nothing on
its own, because RLS decides everything. **Never use the `service_role` key here**; it bypasses RLS entirely and has no
business in anything a browser loads.

## 6. Make yourself the first admin

Chicken and egg: `handle_new_user()` creates every account as `member`, and only
an admin can promote anyone. The way through is the SQL Editor, which runs with
no `auth.uid()` — the privilege guard's first branch allows that deliberately,
because there is no admin yet to authorise it.

1. Sign in once at `/login` with your own address, so the account exists.
2. SQL Editor:

```sql
update public.profiles
   set role = 'admin', status = 'approved', approved_at = now()
 where id = (select id from auth.users where email = 'you@example.com');
```

3. Reload `/hub`. The **Admin** link appears in the header, and the approval
   queue is yours.

## 7. Staff who have no school email

Advisors, exec and graduates are approved on the spot **only if their address is
on the allowlist before they sign up**:

```sql
insert into public.allowed_emails (email, note)
values ('coach@example.com', 'Advisory board — posing');
```

Anyone not on that list and not at a seeded school signs up fine and waits in
the queue at `/hub/admin`. That is the intended path, not a failure.

---

## Checking it works

| Try this | Expect |
|---|---|
| A chapter `.edu` address | link → signed in → onboarding form → hub |
| A personal address | link → onboarding form → "Waiting on approval" |
| That account, after Approve at `/hub/admin` | hub opens on next load |
| That account, after Decline | "Application declined." |
| An approved member, after Suspend | "This account is on hold." |
| `/hub/admin` as a non-admin | no Admin link, and the page returns nothing |
| `admin/index.html` as a non-admin | body stays hidden behind the overlay |

If a signed-in member sees "Waiting on approval" when they should not, check
their row: `select role, status from public.profiles;` — the panel is drawn
straight from `status`.

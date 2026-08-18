# Supabase setup — connecting the member hub

What someone with the Supabase dashboard open has to do, in order, to take
`members.html` from "not connected yet" to a working sign-in.

Everything here is dashboard and SQL work plus **two values** pasted into
`assets/supabase-config.js`. No other file in this repository changes.

---

## 1. Create the project

Supabase dashboard → **New project**. Pick a region near the members (US East
for this org). Note the database password somewhere safe — it is not the same
thing as the keys below and is not needed by this site.

## 2. Apply the migrations, in order

**SQL Editor** → paste and run each file, oldest first:

1. `app/supabase/migrations/20260731000001_init.sql`
2. `app/supabase/migrations/20260731000002_allowed_emails.sql`
3. `app/supabase/migrations/20260731000003_approvals.sql`

Order matters — 0002 and 0003 each rewrite `handle_new_user()` and the read
policies that 0001 created.

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
sign-in if it is skipped. `ncbo-auth.js` asks for a link back to the page it was
requested from, and Supabase refuses any redirect not on the allowlist:

- **Site URL:** `https://thencbo.org`
- **Redirect URLs:** add both pages, plus localhost if anyone develops locally:
  - `https://thencbo.org/members.html`
  - `https://thencbo.org/review.html`
  - `http://localhost:*/**` (development only — remove it if you would rather not
    have localhost on the list)

A link that opens and bounces straight back to a signed-out page is almost
always a missing entry here.

## 4. Email delivery

The built-in Supabase SMTP is rate-limited to a handful of messages per hour and
is explicitly not for production. It is fine for testing the flow today; before
members are told to sign in, set up **custom SMTP** under
**Project Settings → Auth → SMTP Settings**, with a domain that has SPF/DKIM
configured — otherwise the links land in spam.

`ncbo-auth-core.js` already turns Supabase's rate-limit error into
"That is a lot of links in a short time. Wait a minute, then try again." If
testers see that, it is the built-in limit, not a bug.

## 5. Fill in the two public values

**Project Settings → API**, then edit `assets/supabase-config.js`:

```js
url:     'https://<your-project-ref>.supabase.co',
anonKey: '<the anon / publishable key>'
```

Both are public by design and safe to commit — the anon key grants nothing on
its own, because RLS decides everything. **Never paste the `service_role` key
here**; it bypasses RLS entirely. `test/guards.sh` fails the build if a key of
that shape ever reaches a file the browser loads.

While you are in there, bump the `?v=` date on the script and stylesheet tags
across the HTML files so nobody gets a cached copy of the old config. Running
`bash test/guards.sh` afterwards should report no warnings at all — the two
placeholder warnings are how you know the values are still unset.

## 6. Make yourself the first admin

Chicken and egg: `handle_new_user()` creates every account as `member`, and only
an admin can promote anyone. The way through is the SQL Editor, which runs with
no `auth.uid()` — the privilege guard's first branch allows that deliberately,
because there is no admin yet to authorise it.

1. Sign in once at `members.html` with your own address, so the account exists.
2. SQL Editor:

```sql
update public.profiles
   set role = 'admin', status = 'approved', approved_at = now()
 where id = (select id from auth.users where email = 'you@example.com');
```

3. Reload `members.html`. The hub opens and a **Member review** link appears in
   the header; `review.html` is now yours.

## 7. Staff who have no school email

Advisors, exec and graduates are approved on the spot **only if their address is
on the allowlist before they sign up**:

```sql
insert into public.allowed_emails (email, note)
values ('coach@example.com', 'Advisory board — posing');
```

Anyone not on that list and not at a seeded school signs up fine and waits in
the queue on `review.html`. That is the intended path, not a failure.

---

## Checking it works

| Try this | Expect |
|---|---|
| `members.html` before step 5 | "Member sign-in isn't live yet" panel |
| A chapter `.edu` address | link → signed in → hub opens |
| A personal address | link → signed in → "Waiting on approval" |
| That account, after Approve on `review.html` | hub opens on next load |
| `review.html` as a non-admin | "This page is for NCBO admins" |
| `admin/index.html` as a non-admin | body stays hidden behind the overlay |

If a signed-in member sees "Waiting on approval" when they should not, check
their row: `select role, status from public.profiles;` — the panel is drawn
straight from `status`.

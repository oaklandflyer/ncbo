# NCBO V1 audit: answers from the source

Investigation only. No application code and no migrations were written in the session
that produced this document.

**Read this first: `docs/NCBO-AUDIT-V1.md` does not exist.** It is not in this
repository, it is not in the git history of any branch, and it was not supplied to the
session that wrote this file. Every answer below therefore comes from the source and
from a real database, and none of it is checked against the audit's own text. Where I
say "the audit's premise", I am going from how the follow-up prompts describe it, not
from having read it. Treat those particular remarks as provisional; treat the facts
they are attached to as verified.

## How these answers were produced

Reading migrations and inferring the resulting schema is how you get a confident wrong
answer, because thirteen migrations rewrite each other. So every schema claim here comes
from introspecting a real Postgres 17 cluster with all 25 migrations applied in order,
using the project's own harness (`app/supabase/tests/run.sh`). Application claims are
quoted from source with file and line.

Two consequences worth knowing:

- The seed data in the migrations is what this database contains. Where a number below
  describes rows rather than structure, it is the seeded state, which may differ from
  production. Those are marked.
- The local harness has no `storage` schema (Supabase provides it, Postgres does not),
  so anything storage-side is noted as unverifiable here.

---

## 1. Does `clubs.school_id` exist, or is the university a denormalised text column?

**Neither, exactly. Both columns exist, and the one the application uses is not the one
the question names.**

`app/supabase/migrations/20260822000015_universities_and_memberships.sql`

| column | type | nullable | notes |
| --- | --- | --- | --- |
| `clubs.university_id` | `uuid` | **NOT NULL** | the live one |
| `clubs.school_id` | `uuid` | nullable | legacy, from `20260731000001_init.sql:41` |

The university is a proper foreign key, not denormalised text. But there are two of
them. `university_id` carries the 1:1 constraint:

```sql
-- 20260822000015_universities_and_memberships.sql:209
create unique index if not exists clubs_university_key on public.clubs (university_id);
```

`school_id` is the pre-rename column, kept for the compatibility view that migration
0015 created alongside the `schools` → `universities` rename. Nothing in `src/` reads
`clubs.school_id`.

**The trap.** `club_directory` exposes a field *called* `school_id` that is not this
column:

```sql
-- 20260822000016_club_queue_and_rosters.sql:538-539
  u.id    as school_id,
  u.id    as university_id,
```

Both are the *university* id. Any SQL that joins `club_directory.school_id` to
`clubs.school_id` will silently return nothing.

---

## 2. Where is the post-auth onboarding step that writes `profiles.school_id`?

**No such component exists, and one must not be written. `profiles.school_id` is a
derived mirror, not an input.**

The onboarding form is `app/src/app/onboarding/` (`page.js`, `form.js`,
`university-picker.js`, `actions.js`). Its action never writes `school_id`:

```js
// app/src/app/onboarding/actions.js:76-88
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: fullName, display_name: displayName, class_year: classYear,
      lifting_experience: experience, major, experience_phase: phase || null,
      is_adult: true,
    })
    .eq('id', user.id);
```

It submits a `university_id` and resolves the club server-side:

```js
// app/src/app/onboarding/actions.js:94-101
  const { data: chapter } = await supabase
    .from('university_picker')
    .select('club_id, has_chapter')
    .eq('id', universityId)
    .maybeSingle();
```

`profiles.school_id` and `profiles.club_id` are written by exactly one thing:

```sql
-- 20260822000015_universities_and_memberships.sql:681-694
create or replace function public.sync_profile_mirror(target uuid)
...
  update public.profiles p
     set role      = public.derived_role(target),
         club_id   = public.derived_club(target),
         school_id = public.derived_university(target)
```

and a direct write by anyone but an admin is refused:

```sql
-- 20260822000015_universities_and_memberships.sql:668-670
  if new.school_id is distinct from old.school_id then
    raise exception 'Only an admin can reassign a school.' using errcode = 'insufficient_privilege';
```

`derived_university()` reads the member's active membership. So the causal direction is
**membership → school_id**, never the reverse.

> **This inverts Phase 2's premise.** A trigger that routes `profiles.school_id` to a
> `club_id` would be reading a column that is itself computed from the club, and it
> would fight `sync_profile_mirror` on every write. The routing it is meant to add
> already exists at `onboarding/actions.js:94-115`. See §8.

The only other writer of `school_id` in the app is the admin edit surface, which is the
"admin-editable override" Phase 2 asks to preserve, and it already works:
`app/src/app/hub/admin/users/actions.js:43`.

---

## 3. What represents the "waiting" state on `/admin/clubs`?

**`club_memberships.status = 'pending'`.** Not `profiles.approved_at`, and not
`profiles.status`.

```js
// app/src/app/(shell)/admin/clubs/page.js:48
  {c.pending_count > 0 && ` · ${c.pending_count} waiting`}
```

```sql
-- 20260822000016_club_queue_and_rosters.sql:547-548
  (select count(*) from public.club_memberships m
    where m.club_id = c.id and m.status = 'pending') as pending_count,
```

Enum values, from `pg_enum`:

- **`membership_status`** — `pending | active | denied | lapsed | alumni`
- `account_status` (on `profiles.status`) — `pending | approved | suspended | rejected | removed`
- `membership_role` — `member | club_lead | co_lead`
- `user_role` (on `profiles.role`) — `member | club_lead | advisor | admin`
- `org_role` — `admin | exec_board | coaching_advisor | board_of_directors`
- `verification_method` — `club_lead | referral | school_email | student_id | legacy_import`

**Two distinct pending states exist and they are not the same thing.** A profile can be
`account_status = 'approved'` (may use the app) while its membership is
`membership_status = 'pending'` (not yet on a roster). The "waiting" count is the second
one. Any trigger or form that conflates them will be wrong for exactly the population it
matters for.

`profiles.approved_at` does exist (`timestamptz`) but does not drive this number.

---

## 4. Does `/rankings/athletes` share the club mark component with `/rankings/clubs`?

**Yes. Same module, two exports.**

```js
// app/src/app/(shell)/rankings/athletes/page.js:7,57
import ClubLogo from '@/app/brand/club-logo';
  {l.chapter && <ClubLogo club={l} size={20} />}
```

```js
// app/src/app/(shell)/rankings/clubs/page.js:6,54
import { ClubLogoResponsive } from '@/app/brand/club-logo';
  <ClubLogoResponsive club={c} />
```

`ClubLogoResponsive` (`club-logo.js:78-86`) is a wrapper that renders `ClubLogo` twice at
two sizes. Both paths go through the same default export, so a fix to `ClubLogo` reaches
both boards.

**Relevant to Prompt A:** the athlete board renders **one** element; only the Chapter Cup
renders the duplicated `md:hidden` / `hidden md:inline-flex` pair, and it does so inside
`ClubLogoResponsive` rather than at the call site. Collapsing it is a one-component
change, and `ClubLogoResponsive` should disappear entirely rather than be rewritten.

---

## 5. Is the club-initials fallback implemented?

**Yes, and it is unit-tested.** The copy is accurate.

```js
// app/src/app/brand/club-logo.js:36-37, 53-67
  if (src) { ... returns an <img> ... }
  return (
    <span ... >{monogram(club)}</span>
  );
```

`monogram` is `app/src/lib/monogram.js:19-28`; it returns `'NC'` rather than an empty
string for a club with no usable name. `app/test/monogram.test.js` covers six cases
including null, `{}`, whitespace and a bare hyphen.

The branch never ran in preview because both ranked clubs have logos. It is reachable
today by any club without one, which in the seeded database is all nine.

---

## 6. Every foreign key to `profiles` or `auth.users`, with current `ON DELETE`

From `pg_constraint`, all 25 migrations applied. **32 constraints.**

### To `auth.users` (1)

| child | column | `ON DELETE` |
| --- | --- | --- |
| `profiles` | `id` | **CASCADE** |

### To `profiles` — `ON DELETE CASCADE` (13). These rows are destroyed with the user.

| child | column |
| --- | --- |
| `answer_votes` | `user_id` |
| `answers` | `author_id` |
| `club_memberships` | `user_id` |
| `competition_entries` | `profile_id` |
| `competition_handlers` | `handler_profile_id` |
| `membership_vouches` | `voucher_id` |
| `org_roles` | `user_id` |
| `posts` | `author_id` |
| `question_votes` | `user_id` |
| `questions` | `author_id` |
| `school_email_codes` | `user_id` |
| `signup_interest` | `user_id` |

### To `profiles` — `ON DELETE SET NULL` (19). These survive, with the reference nulled.

| child | column |
| --- | --- |
| `admin_actions` | `actor_id`, `target_id` |
| `answers` | `deleted_by` |
| `club_leads` | `profile_id` |
| `club_memberships` | `decided_by_user_id`, `referred_by_user_id`, `verified_by_user_id` |
| `competition_entries` | `confirmed_by` |
| `competitions` | `created_by` |
| `membership_dues` | `recorded_by` |
| `membership_notes` | `author_id` |
| `org_roles` | `granted_by` |
| `profiles` | `approved_by`, `deleted_by`, `verified_by` (self-referential) |
| `questions` | `deleted_by`, `moderated_by` |
| `resources` | `created_by` |
| `site_settings` | `updated_by` |

### What this means for the hard-delete design

- **`auth.users` → `profiles` is CASCADE, and `profiles` fans out to 13 more CASCADEs.**
  A single `admin.auth.admin.deleteUser()` therefore destroys questions, answers, votes,
  entries, handler credits, memberships, org roles, posts, email codes and signup
  interest, with no further code. That is the whole cascade, already wired.
- **`admin_actions` already survives** (`actor_id` and `target_id` are both SET NULL), so
  the existing audit table does not need the no-FK treatment. A *new* `admin_audit_log`
  should still be a bare `uuid` with no FK, since SET NULL loses which user was deleted.
- **`competition_entries.profile_id` is CASCADE today.** Deleting an athlete removes
  their verified results, which changes Chapter Cup standings retroactively. This is the
  item flagged for stakeholder sign-off, and it is real.
- **`competition_handlers.handler_profile_id` is CASCADE too** — easy to miss, and it
  carries the 2-point handler component of the Cup.
- **Author snapshots are needed on four tables, not two:** `questions`, `answers`,
  `posts`, and `competition_entries` all lose their author identity entirely.
- **`storage.objects` could not be checked here** — the local harness has no `storage`
  schema. Real Supabase has an `owner` / `owner_id` column on `storage.objects`; its FK
  behaviour must be confirmed against the live project before the purge step is designed.
  The buckets holding user-attributable content are `club-logos`, `brand_assets`, and
  whatever `club_memberships.student_id_photo_path` points at.

---

## 7. Is `class_year` `text` or `varchar(20)`?

**`text`. No length limit in the database.**

```
column_name | data_type | character_maximum_length
class_year  | text      | (null)
```

The admin input's `maxlength="20"` is a client-side attribute only. Nothing enforces it
server-side, so any existing row may exceed 20 characters and any migration that assumes
otherwise will need to handle that.

**Also relevant to Phase 1, and easy to miss:** `profiles` has **no** `grad_year` column,
but `club_memberships` **already has one**, `integer`, nullable, populated at onboarding:

```js
// app/src/app/onboarding/actions.js:110
        grad_year: Number(gradYear),
```

So a graduation year is already collected and stored per membership. Phase 1 needs to
decide whether it is adding a second one on `profiles` or promoting the existing one,
and the backfill source may be `club_memberships.grad_year` rather than a relative
standing parsed out of `class_year`. That would make a large share of the backfill exact
rather than inferred.

---

## 8. Migrations, and whether a test database is available

**Applied with the Supabase CLI, by hand. Nothing is automatic.**

```json
// app/package.json:10-13
"db:status": "supabase migration list",
"db:new":    "supabase migration new",
"db:push":   "supabase db push",
"db:test":   "./supabase/tests/run.sh",
```

- Migrations live in `app/supabase/migrations/`, timestamp-prefixed, 25 files, applied in
  filename order.
- `app/supabase/config.toml` links the repo to project `bjfxgwjnkfjrgrpqubab`,
  `major_version = 17`.
- **Vercel does not apply migrations.** The deploy runs `next build` only. A merged PR
  containing a migration changes nothing in production until somebody runs `npm run
  db:push`. This is why the club-logo migration from PR #44 is merged but not live.

**A test database is available, and it is good.** `app/supabase/tests/run.sh` starts a
throwaway Postgres cluster, applies a Supabase shim (`00_supabase_shim.sql`) that fakes
`auth.users`, `auth.uid()` and the `anon` / `authenticated` roles, replicates Supabase's
blanket table grants, applies all 25 migrations, then runs four policy suites. CI runs it
on every push (`.github/workflows/tests.yml`, job `database`).

Two limits to plan around:

1. **No `storage` schema.** Every bucket and storage policy block is wrapped in a
   `to_regclass('storage.buckets') is null` guard and skips locally. Storage-side
   behaviour cannot be tested here at all.
2. **Seed data, not production data.** The harness contains what the migrations seed:
   134 universities, 9 clubs, no real members. Backfill row counts measured here mean
   nothing about production. A Supabase database branch, or a restored dump, is required
   for the "apply to a copy of production data" step. **I could not confirm that either
   exists** — that is a question for whoever holds the Supabase dashboard.

`initdb` refuses to run as root, so in a root container the harness needs
`su postgres -s /bin/bash -c ./supabase/tests/run.sh` and a world-readable checkout.

---

## Seeded-state figures, for the "zero approvers" concern

Measured, not estimated. **Seeded state — production will differ.**

| | count |
| --- | --- |
| universities (all active) | 134 |
| clubs | 9 |
| clubs with `status = 'Active'`, `active = true` | 7 |
| clubs with `status = 'Pipeline'`, `active = false` | 2 |
| clubs with at least one approver | **0 of 9** |

```sql
-- 20260822000016_club_queue_and_rosters.sql:301-315
create or replace function public.club_approver_count(target_club uuid) ...
      select m.user_id from public.club_memberships m
       where m.club_id = target_club and m.status = 'active'
         and m.role in ('club_lead', 'co_lead')
      union
      select l.profile_id from public.club_leads l
       where l.club_id = target_club and l.profile_id is not null
```

An approver is a *linked* lead. The seed inserts `club_leads` rows by display name and
logs `no profile matched for Luke Rudolph, Rachel Hare, ...`, leaving `profile_id` null,
which is why the seeded count is zero everywhere. In production the count rises as those
people sign up and get linked. **So "seven of nine clubs have zero approvers" is not a
figure this repository can produce; it must have been read off production.** The concern
it raises is sound either way, but the number should be re-measured before it goes in a
PR description.

`has_chapter` in `university_picker` is `c.id is not null and coalesce(c.active, false)`
(`20260822000015:1405`), so the two Pipeline clubs read as *no chapter* and route to
`signup_interest`. That already matches the behaviour Phase 2 asks for, but by accident
of `active = false` rather than by naming the Pipeline case, so a Pipeline school
currently gets the "no chapter here yet" path rather than a chapter-specific waitlist.

---

## Which parts of the proposed SQL need to change

I cannot answer this section as asked, because the audit is not in the repository and I
have not read its SQL. What follows is what the findings above imply for the phases as
the prompts describe them. Re-check each against the audit once it exists.

**Phase 2 needs rethinking before it is written, not adjusting.** Its premise is a
trigger routing `profiles.school_id` to a `club_id`. `school_id` is an output of
membership (§2), so such a trigger would be circular and would contend with
`sync_profile_mirror`. Meanwhile the routing itself already exists in
`onboarding/actions.js`, and already distinguishes chapter from no-chapter. What is
actually missing is narrower and mostly UI: a searchable combobox over the 134 schools,
and an explicit Pipeline branch. If the audit's §2.4 trigger says otherwise, the audit is
describing a system this repository does not have.

**Phase 1's backfill probably has a better source than it thinks.**
`club_memberships.grad_year` already holds an integer graduation year collected at
onboarding (§7). Backfilling `profiles.grad_year` from that is exact, and
`grad_year_inferred` should be `true` only for rows with no membership row to draw on.
That likely shrinks the "confirm this year" queue by most of its volume. `class_year` is
`text`, not `varchar(20)`, so no length assumption holds.

**Phase 3's cascade inventory needs widening.** Four tables need author snapshots, not
two (`questions`, `answers`, `posts`, `competition_entries`), and
`competition_handlers.handler_profile_id` is a CASCADE that also carries Chapter Cup
points. `admin_actions` already survives a delete via SET NULL, so the existing audit
trail is not at risk; a new `admin_audit_log` still needs a bare `uuid`. The
`storage.objects` ownership FK is unverified and must be checked against the live project
before the purge step is designed.

**One thing that blocks Phase 3 regardless of the audit:** nothing in this repository
uses a service-role key, by explicit design, and there is no admin client anywhere.
`admin.auth.admin.deleteUser()` requires one. That is a new trust boundary in a codebase
that has deliberately never had one, and it deserves its own decision rather than
arriving inside a feature PR.

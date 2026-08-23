# Policy tests

These exercise the row-level security policies against a throwaway local
Postgres — not against your real Supabase project. Run them after any change
to `migrations/`, because a mistake in a policy is silent: the app keeps
working and simply shows people things they shouldn't see.

`00_supabase_shim.sql` stands in for the pieces of Supabase the migration
depends on (`auth.users`, `auth.uid()`, the `anon` / `authenticated` roles).
`auth.uid()` here reads a GUC so a test can act as any user via
`set test.uid = '<uuid>'`.

## Running them

Needs Postgres 16 locally.

```sh
./run.sh
```

`run.sh` applies every migration to a throwaway database and then runs each
`NN_*.sql` in order. There is no assertion harness: read the output. A test
whose title starts with **MUST FAIL** passes by printing a loud `ERROR` — those
are the operations the schema has to refuse. Everything else passes by printing
a row.

One category needs saying out loud, because it looks like a failure and is not:
an `UPDATE` or `INSERT` that no policy matches is **filtered to zero rows**, not
raised on. `UPDATE 0` followed by an unchanged row is a pass. A refusal only
raises when a trigger raises it.

## What's covered

### 01_rls.sql

Roles, anonymity, moderation, and the account-level policies. Seventy tests.
Four of them changed meaning in `20260822000015`, when signup reopened to any
address and the account-level approval queue stopped deciding anything:

| # | Now checks |
|---|---|
| 1 | **Any** address can sign up, and gets a live account with no chapter |
| 2 | A `.edu` signup is provisioned exactly like any other, with no school resolved |
| 17, 18 | A recognised school domain buys no chapter access; an unrecognised one is treated identically |
| 20, 21, 22, 23 | An unaffiliated user reads the open surfaces and can ask a question, and is on nobody's roster |
| 33 | The account-level queue no longer decides anything. The queue that does is in `02` |
| 61 | `profiles.email` is refused outright. It was not, before `0015` — see below |

### 02_membership.sql

The membership model: 1:1 universities and clubs, the club-scoped approval
queue, the roster audit, dues, and the referral fast-track. Thirty-six tests.

The two groups worth reading first are the ones the brief singles out as the
places a bug leaks data across chapters:

| # | Behaviour |
|---|---|
| 1, 2 | A university has exactly one club, and one person has one membership per university |
| 4–9 | **Club scoping.** A Pitt lead sees only Pitt's queue, is refused Purdue's, cannot decide a Purdue application through the RPC or by writing the row, and approving records who verified and how |
| 10–14 | The group-chat handle is refused to a member; nobody approves or verifies themselves; an applicant may correct their own answers while pending |
| 15–19 | **The roster audit.** An org admin and a coaching advisor with no student membership are on zero rosters and in no headcount; an admin who *is* a student appears as a member |
| 20, 21 | Verified and dues-paid are independent, and dues are not readable by a clubmate |
| 22–25b | Referral fast-track: discovery, two vouches is not three, a stranger's vouch is refused, the third auto-approves and tells the lead |
| 26–30 | A lead names co-leads but not leads, not at another chapter, and cannot step themselves down; the single-approver warning |
| 31, 32 | Escalation past 72 hours fires once; the digest is one row per club per day |
| 33–35 | The profile popup's projection carries no email, no dues, no handle, no legal name |

### 03_competitions.sql

The calendar, the scoring model, the rankings, and the Q&A starter library.
Eighteen tests.

| # | Behaviour |
|---|---|
| 1 | The scoring curve: steep at the top, flat at the bottom, and competing without a placement still scores |
| 2 | An entry's chapter is stamped from the entrant's membership, never from the request |
| 3, 5, 6 | **Nobody confirms their own result**, another chapter's lead cannot confirm it, and the entrant's own lead can |
| 4, 7 | A pending result scores nothing and is on no leaderboard; a confirmed one scores |
| 8 | A confirmed result's numbers are fixed |
| 9 | **A chapter scores its best five**, not its total |
| 10, 11 | The calendar is open to an account with no chapter; somebody else's pending result is not |
| 12 | Competition history on the profile popup is confirmed results only |
| 13, 14 | An ordinary member cannot add a show; a club lead can |
| 15–18 | The Q&A starter library is 30 answered questions, attributed to the Coaching Desk rather than a named advisor, and clearable in one statement |

### 12_approval_surface.sql

The two ways somebody gets into a chapter, after the release where neither
worked. Fourteen tests.

| # | Behaviour |
|---|---|
| 1 | The queue carries `claimed_lead`, so "I run this chapter" reaches the reviewer |
| 2–5 | Where the pending applications are, and the nav count, both scoped to what the caller may act on: an admin sees every chapter, a lead sees theirs, a member sees none |
| 6, 7 | `admin_place_member()` is admin-only — a member cannot place themselves, and a club lead cannot place somebody even at their own club |
| 8–11 | The bug, end to end: a pending applicant shows in the directory as **"No club yet"**, an admin places them, and the directory, the membership and the `profiles` mirror all agree afterwards |
| 12 | A chapter that had no approver has one, so its queue stops being unworkable |
| 13 | No club means `lapsed` and off the roster — never a deleted row, which would erase the decision |
| 14 | The lead's own path through `decide_membership()` is unchanged, and it too ends the "No club yet" state |

### 13_push_subscriptions.sql

Web push subscriptions, which are owner-scoped: a subscription is the means of
sending somebody a notification. Ten tests.

| # | Behaviour |
|---|---|
| 1, 2 | One row per browser — a phone and a laptop are two — and re-registering the same browser refreshes that row rather than adding a second |
| 3–5 | Another member reads none of them, cannot register a device against somebody else's account, and deletes nothing that is not theirs |
| 6 | A shared browser moves to whoever turned it on last. Without `save_push_subscription()` the second person's insert hits the first person's row, RLS correctly refuses, and that device never rings for anybody again |
| 7 | An admin reads every subscription, for support |
| 8–10 | Turning it off deletes the row; subscribing signed out is refused; a deleted account takes its devices with it |

## The harness mirrors Supabase's grants

`run.sh` issues Supabase's own blanket grants and default privileges before
applying migrations. Without them the throwaway database was *more* restrictive
than production, which hid privilege bugs rather than catching them: a column
production could not read looked fine here, because nothing could read anything
here until `01_rls.sql` granted it.

Tests `0a`, `0b` and `0c` in `01_rls.sql` run before that file grants anything,
so they see the ACL state the migrations actually produced. Move them below the
grants and they can never fail, because the harness repairs the thing they
exist to catch.

## A trap worth knowing about

`restrict_columns()` in `20260822000015` takes away `authenticated`'s
table-level `SELECT` and hands back an explicit column list. That is the only
mechanism that actually hides a column: a bare `revoke select (col)` is a
**no-op** against a table-level grant, which is why `profiles.email` was
readable by every signed-in member from `0014` until `0015`, and why the test
meant to catch it passed for an unrelated reason.

Two consequences:

- `select *` on `profiles` or `club_memberships` as `authenticated` is now
  `permission denied`. Name the columns. PostgREST does this already; the two
  `select('*', { head: true })` counts in the app did not, and were changed.
- Both test files re-apply `restrict_columns()` after their blanket
  `grant all on all tables`, which stands in for Supabase's own. Without that
  line the grant hands the columns straight back and the tests check
  themselves rather than the schema.

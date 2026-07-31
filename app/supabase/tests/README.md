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

Expected: tests 1, 3, 4, 6, 8, 10, 16, 20, 22 fail loudly (that IS the pass —
those are the operations that must be refused); the rest succeed. Read the
output; there's no assertion harness.

## What's covered

| # | Behaviour |
|---|-----------|
| 1 | A non-.edu address cannot become a user |
| 2 | A .edu signup provisions a profile and resolves its school (including subdomains) |
| 3 | A member cannot promote themselves |
| 4 | A member cannot reassign their own club |
| 5 | A member can edit their own display name |
| 6 | A member cannot edit anyone else's profile |
| 7 | A member can post, named or anonymously |
| 8 | A member cannot post as someone else |
| 9 | The feed nulls the author of an anonymous post |
| 10 | A member cannot answer a question |
| 11 | An advisor can answer |
| 12 | An admin can change a role |
| 13 | Members cannot read raw `posts` — only the anonymised view |
| 14 | An allowlisted non-.edu address can sign up, with no school, as `member` |
| 15 | A non-.edu address not on the list signs up **pending** |
| 16 | A member can neither read nor write the allowlist |
| 17 | A .edu at a known school is approved automatically |
| 18 | A .edu at an unknown school lands in the queue |
| 19 | A pre-vetted staff address is approved on the spot |
| 20 | A pending user cannot approve themselves |
| 21 | A pending user cannot read the board, but can see their own row |
| 22 | A pending user cannot post |
| 23 | An admin can approve, and the board then opens up |

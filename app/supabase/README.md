# Database

Schema, policies, and migrations for the member app.

## How migrations are tracked

Migrations go through the Supabase CLI, which keeps a ledger in
`supabase_migrations.schema_migrations` on the remote database. That ledger is
the point: before it existed, `0002` was skipped by hand and nothing noticed.

That failure is worth understanding, because it's the quiet kind. `0003`
redefines `handle_new_user` to query `allowed_emails` — a table `0002`
creates. plpgsql does not resolve table names until the function *runs*, so
applying `0003` without `0002` succeeds without a warning and installs a
function that throws on every signup. The database looks healthy right up
until the first person tries to join.

So: don't paste SQL into the dashboard editor. Use the CLI, and let it refuse
to apply things twice or out of order.

## Everyday use

```sh
npm run db:status        # what's applied locally vs remotely
npm run db:new some_name # create a new timestamped migration
npm run db:push          # apply pending migrations to the linked project
npm run db:test          # run the policy tests against a throwaway Postgres
```

Migration filenames must keep the CLI's `YYYYMMDDHHMMSS_name.sql` shape —
`npm run db:new` handles that. The version is the numeric prefix, and it's
what the ledger records.

Always `npm run db:test` before `npm run db:push`. A broken policy fails
silently: the app keeps rendering and simply shows people more than it should.

## One-time setup, per machine

```sh
npx supabase login                                  # opens a browser
npx supabase link --project-ref bjfxgwjnkfjrgrpqubab # prompts for the DB password
```

The access token lands in your keychain and the database password is prompted
for, not stored in the repo. `project_id` in `config.toml` is not a secret —
it's in every API request the app already makes.

## The three existing migrations are already applied

They were applied by hand through the dashboard before the CLI was wired up,
so the remote ledger doesn't know about them. Record them as applied —
**don't re-run them**:

```sh
npx supabase migration repair --status applied 20260731000001
npx supabase migration repair --status applied 20260731000002
npx supabase migration repair --status applied 20260731000003
```

Then confirm the ledger agrees with the repo:

```sh
npm run db:status
```

All three should read as applied both locally and remotely. From that point
`db:push` is the only way schema changes reach the database.

## Files

| Path | What |
|---|---|
| `migrations/20260731000001_init.sql` | Tables, RLS, feed views, seed data |
| `migrations/20260731000002_allowed_emails.sql` | Staff allowlist |
| `migrations/20260731000003_approvals.sql` | Approval queue, `is_approved()` |
| `tests/` | 23 policy tests — see `tests/README.md` |
| `config.toml` | CLI config (project ref, local Postgres version) |

-- Minimal stand-in for the parts of Supabase the migration depends on.
create role anon;
create role authenticated;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb
);
-- Real auth.uid() reads the JWT sub claim; here it reads a GUC we set per test.
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

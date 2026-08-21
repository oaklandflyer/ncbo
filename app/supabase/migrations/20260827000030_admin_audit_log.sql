-- ============================================================================
-- The record of destructive admin actions.
--
-- One rule shapes this whole table: **no foreign keys to profiles.**
--
-- An audit row exists to say "this account was destroyed, by this person, at
-- this time". A foreign key to `profiles` gives it exactly two options when
-- the account it names is deleted, and both destroy the record:
--
--   ON DELETE CASCADE   the audit row is deleted along with the user, so the
--                       log is empty precisely for the events it exists for
--   ON DELETE SET NULL  the row survives naming nobody, which is not an audit
--                       trail, it is a row saying something happened once
--
-- So the ids are plain `uuid` and the identifying details are snapshotted as
-- text at write time. The same argument applies to the actor, not just the
-- target: an admin who later deletes their own account must not erase who
-- performed the deletions.
--
-- Append-only by policy: no update, no delete, for anybody. An audit log that
-- can be edited by the people it audits is decoration.
-- ============================================================================
create table if not exists public.admin_audit_log (
  id             uuid primary key default gen_random_uuid(),

  /* Plain uuid. No REFERENCES. See above; this is the entire point. */
  actor_user_id  uuid,
  actor_email    text,
  actor_display  text,

  target_user_id uuid,
  target_email   text,
  target_display text,

  action         text not null,
  detail         jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

comment on table public.admin_audit_log is
  'Destructive admin actions. No foreign keys to profiles by design: an FK would either cascade the audit row away with the user it names, or null it into meaninglessness. Ids are plain uuid and identities are snapshotted as text.';
comment on column public.admin_audit_log.target_user_id is
  'Plain uuid, deliberately not a foreign key. The row must outlive the account it names.';
comment on column public.admin_audit_log.detail is
  'What was destroyed and what was kept, as counted at the time. The counts are the evidence: they cannot be recomputed once the rows are gone.';

create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_user_id);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists admin_audit_log_read on public.admin_audit_log;
create policy admin_audit_log_read on public.admin_audit_log
  for select to authenticated using (public.is_admin());

/* No insert policy for `authenticated`, and none is missing. Rows are written
   by the delete action through the service-role client, which is not subject
   to RLS. Offering an insert policy would let anybody who can reach PostgREST
   write their own audit entries, which is worse than having no log. */

drop policy if exists admin_audit_log_no_update on public.admin_audit_log;
drop policy if exists admin_audit_log_no_delete on public.admin_audit_log;
/* Append-only. Stated as policies that permit nothing rather than left
   implicit, so a later migration that adds a broad policy has to step over
   something visible. */
create policy admin_audit_log_no_update on public.admin_audit_log
  for update to authenticated using (false) with check (false);
create policy admin_audit_log_no_delete on public.admin_audit_log
  for delete to authenticated using (false);

revoke all on public.admin_audit_log from anon;
grant select on public.admin_audit_log to authenticated;

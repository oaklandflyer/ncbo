-- ============================================================================
-- Audit log for admin decisions
--
-- Who approved this person, who declined that one, and when. Until now that
-- was recoverable only from `approved_by`, which the next decision overwrites
-- and a decline erased entirely.
--
-- Three properties this table is built for:
--
--  1. **Append-only.** There are policies for insert and select and none for
--     update or delete, so with RLS on, nobody — including an admin — can edit
--     or erase an entry through the API. A log an admin can quietly rewrite
--     does not answer the question it exists to answer.
--
--  2. **It outlives its subjects.** Both foreign keys are `on delete set
--     null`, so deleting a profile blanks the reference but leaves the record
--     of the decision standing.
--
--  3. **The actor is the session, not the form.** `actor_id` is checked
--     against auth.uid() by the insert policy, so an entry cannot be written
--     in someone else's name.
-- ============================================================================

create table public.admin_actions (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references public.profiles(id) on delete set null,
  target_id       uuid references public.profiles(id) on delete set null,
  action          text not null check (action in ('approved', 'rejected', 'suspended', 'reinstated')),
  previous_status public.account_status,
  note            text check (note is null or length(note) <= 500),
  created_at      timestamptz not null default now()
);

create index on public.admin_actions (target_id, created_at desc);
create index on public.admin_actions (created_at desc);

comment on table public.admin_actions is
  'Append-only record of admin decisions on member accounts. No update or delete policy exists, on purpose.';

alter table public.admin_actions enable row level security;

-- Admins read the log. Ordinary members do not: it names other people and the
-- decisions made about them.
create policy admin_actions_read on public.admin_actions
  for select to authenticated
  using (public.is_admin());

-- An admin may write an entry, in their own name, about someone else.
create policy admin_actions_insert on public.admin_actions
  for insert to authenticated
  with check (public.is_admin() and actor_id = auth.uid());

-- Deliberately no update or delete policy. With RLS enabled that means the
-- rows cannot be changed or removed through the API at all.

-- ── decline means rejected ──────────────────────────────────────────────────
-- Accounts turned away before 'rejected' existed were marked suspended, and
-- the two are indistinguishable in the data. They are left as they are rather
-- than guessed at: relabelling them would be inventing a decision nobody made.
-- New declines are recorded correctly from here.

-- ============================================================================
-- Question moderation, and the two credential fields the directory will need.
--
-- Moderation that only filters in the app is not moderation: `question_feed`
-- is a SECURITY DEFINER view, so it bypasses RLS on `questions` entirely and
-- hands every approved member every row. Filtering in the page component would
-- leave the API returning unapproved questions to anyone who asks for them.
-- The gate therefore lives here, in the view and in a write guard.
--
-- Shape follows `account_status` from 20260731000003: an enum with the same
-- three words, a moderated_at/moderated_by pair mirroring approved_at/by, and
-- a trigger that stops the subject of a decision from making it themselves.
-- ============================================================================

-- Every step here is guarded so the file can be applied twice — by `db push`
-- and then again by hand in the SQL editor, or re-run after failing partway —
-- without erroring out or, worse, half-applying. An unguarded `create type`
-- aborts the whole transaction on the second run.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'question_status') then
    create type public.question_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- The backfill sits inside the same guard as the column, so it runs exactly
-- once — on the run that adds the column. Left outside, a second application
-- would silently approve whatever was legitimately pending in the queue.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'questions' and column_name = 'status'
  ) then
    alter table public.questions
      add column status       public.question_status not null default 'pending',
      add column moderated_at timestamptz,
      add column moderated_by uuid references public.profiles(id) on delete set null;

    -- Everything asked before this migration was already on the board.
    -- Leaving it to default would retroactively unpublish the whole history:
    -- real members would watch their own questions vanish, which is a worse
    -- first impression of moderation than an empty queue.
    update public.questions set status = 'approved', moderated_at = now();
  end if;
end $$;

create index if not exists questions_status_created_idx
  on public.questions (status, created_at desc);

-- ── write guard ─────────────────────────────────────────────────────────────
-- `questions_update` allows the author to edit their own row, which without
-- this would include stamping it approved. Only a moderator decides, and a
-- moderator never decides by editing the body in the same statement.
create or replace function public.guard_question_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- No auth.uid() is a trusted server-side context: a migration, or the SQL
  -- editor. Ordinary requests cannot reach here unauthenticated — the UPDATE
  -- policy already requires author or moderator.
  if auth.uid() is null then
    return new;
  end if;

  if new.status is distinct from old.status and not public.is_moderator() then
    raise exception 'Only an advisor or admin can approve or reject a question.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_question_status_trg on public.questions;
create trigger guard_question_status_trg
  before update on public.questions
  for each row execute function public.guard_question_status();

-- ── the read boundary ───────────────────────────────────────────────────────
-- The base-table policy (`questions_read_own`, from the initial schema) is
-- already narrow: author or moderator. That is the path the app uses for "my
-- questions", and it is what lets an author see their own pending row without
-- the row reaching anybody else.
--
-- The feed is the public surface, so the feed is where approval is required.
-- A moderator needs the pending ones to work the queue, and gets them here
-- rather than through a second view.
-- Dropped rather than replaced: `create or replace view` cannot insert a
-- column into the middle of the projection, and `status` belongs beside the
-- other question facts rather than tacked on the end.
drop view if exists public.question_feed;

create view public.question_feed as
select
  q.id, q.channel_id, q.body, q.anonymous, q.answered, q.status, q.created_at,
  case when q.anonymous then null else q.author_id end            as author_id,
  case when q.anonymous then 'Anonymous' else pr.display_name end as author_name,
  case when q.anonymous then null else s.name end                 as author_school
  , (select count(*) from public.answers a where a.question_id = q.id) as answer_count
from public.questions q
join public.profiles pr on pr.id = q.author_id
left join public.schools s on s.id = pr.school_id
where public.is_approved()
  and (q.status = 'approved' or public.is_moderator());

grant select on public.question_feed to authenticated;

-- ============================================================================
-- Coach credentials.
--
-- Both fields are admin-only to write (see the guard below). A self-applied
-- "NCBO Vetted" seal is worth less than no seal, and a self-typed credential
-- pill is worse than either — it renders a claim in the same visual language
-- the organisation uses to vouch for someone.
--
-- The credential list is an enum rather than free text for the same reason:
-- an array of arbitrary strings rendered as official-looking pills is a
-- trust problem waiting to happen. Adding a federation is a migration, which
-- is the right amount of friction.
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'credential') then
    create type public.credential as enum (
      'IFBB Pro', 'NPC', 'OCB', 'OCB Wellness', 'WNBF', 'NANBF',
      'NASM CPT', 'ISSA CPT', 'NSCA CSCS', 'Precision Nutrition L1'
    );
  end if;
end $$;

alter table public.profiles
  add column if not exists verified     boolean not null default false,
  add column if not exists verified_at  timestamptz,
  add column if not exists verified_by  uuid references public.profiles(id) on delete set null,
  add column if not exists credentials  public.credential[] not null default '{}';

create index if not exists profiles_verified_idx on public.profiles (verified) where verified;

-- ── privilege guard, extended ───────────────────────────────────────────────
-- Same function as 20260818000007, with the two new columns added to the list
-- a member cannot set on themselves. Restated in full because that is how
-- every previous migration here has amended it.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  reviewing boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Before the admin bypass: nobody attests to being 18 for another person.
  if new.is_adult is distinct from old.is_adult and new.id <> auth.uid() then
    raise exception 'Only the member themselves can make the 18+ attestation.'
      using errcode = 'insufficient_privilege';
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Vetting is the organisation vouching for somebody. Nobody vouches for
  -- themselves, and a club lead reviewing a signup does not hand out seals.
  if new.verified is distinct from old.verified then
    raise exception 'Only an admin can mark a profile as NCBO vetted.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.credentials is distinct from old.credentials then
    raise exception 'Only an admin can change federation credentials.'
      using errcode = 'insufficient_privilege';
  end if;

  reviewing := public.leads_school_of(new.id)
           and new.id <> auth.uid()
           and old.status = 'pending'
           and new.status in ('approved', 'rejected')
           and new.school_id is not distinct from old.school_id
           and new.role is not distinct from old.role
           and new.club_id is not distinct from old.club_id;

  if new.role is distinct from old.role then
    raise exception 'Only an admin can change a role.' using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status and not reviewing then
    if public.my_role() = 'club_lead' then
      raise exception 'A club lead can only approve or decline a pending account at their own school.'
        using errcode = 'insufficient_privilege';
    end if;
    raise exception 'Only an admin can approve or suspend an account.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.club_id is distinct from old.club_id or new.school_id is distinct from old.school_id then
    raise exception 'Only an admin can reassign a club or school.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- An answer carries enough of its question's context to leak it. If the
-- question isn't on the board, neither is anything written under it.
create or replace view public.answer_feed as
select a.id, a.question_id, a.body, a.created_at, a.author_id,
       pr.display_name as author_name, pr.role as author_role,
       pr.verified as author_verified, pr.credentials as author_credentials
from public.answers a
join public.profiles pr on pr.id = a.author_id
join public.questions q on q.id = a.question_id
where public.is_approved()
  and (q.status = 'approved' or public.is_moderator() or a.author_id = auth.uid());

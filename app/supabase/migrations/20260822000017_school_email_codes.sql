-- ============================================================================
-- The optional school-email code.
--
-- Third in the priority order from 2.4, and never required. The point of the
-- whole reframe is that a school address is not an identity: students do not
-- read that inbox and will not keep a password on it. So this path exists for
-- the people who happen to find it convenient, and for nobody else.
--
-- Three properties it must have, and each one is a line below:
--
--  1. **It never becomes a login.** The address is written to
--     `school_email_codes`, never to `auth.users` and never to
--     `profiles.email`. Nothing in the sign-in path reads this table.
--
--  2. **Any subdomain counts.** Schools are inconsistent: Pitt hands out
--     `@pitt.edu`, plenty of others hand out `@students.school.edu` or
--     `@mail.school.edu`. A rule that only accepted the apex domain would
--     reject real students at real schools, which is the failure mode this
--     whole migration exists to stop repeating.
--
--  3. **A code is a secret with a short life.** Stored as a SHA-256 digest so
--     the table is not a list of live codes, capped at five attempts, and
--     expired after fifteen minutes.
-- ============================================================================
-- `digest()` lives in pgcrypto. Supabase enables it; a bare local Postgres
-- may not, and an unguarded reference would fail the whole migration run.
do $$
begin
  create extension if not exists pgcrypto with schema extensions;
exception when others then
  begin
    create extension if not exists pgcrypto;
  exception when others then
    raise notice 'pgcrypto unavailable — the school-email code path will not work here';
  end;
end $$;

create table if not exists public.school_email_codes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  membership_id uuid references public.club_memberships(id) on delete cascade,
  email         text not null,
  code_hash     text not null,
  attempts      int  not null default 0,
  consumed_at   timestamptz,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists school_email_codes_user_idx
  on public.school_email_codes (user_id, created_at desc);

comment on table public.school_email_codes is
  'One-time codes for the optional school-email verification path. Never a login credential: nothing in the auth path reads this.';

alter table public.school_email_codes enable row level security;

drop policy if exists school_email_codes_read on public.school_email_codes;

-- Your own rows, and not the hash. Writes go through the two functions below,
-- so there is no insert or update policy at all.
create policy school_email_codes_read on public.school_email_codes for select to authenticated
  using (user_id = auth.uid());

grant select on public.school_email_codes to authenticated;

select public.restrict_columns('public.school_email_codes', array['code_hash']);

/* Does this address belong to the university the membership is at?
   Subdomains count, in both directions: `pitt.edu` matches `pitt.edu` and
   `students.pitt.edu` alike. */
create or replace function public.email_matches_university(addr text, uni uuid)
returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.universities u
     where u.id = uni
       and u.domain is not null
       and (lower(split_part(addr, '@', 2)) = lower(u.domain)
         or lower(split_part(addr, '@', 2)) like '%.' || lower(u.domain))
  )
$$;

/**
 * Issue a code. Returns it, so the caller can hand it to whatever sends mail.
 *
 * No mail provider in this pass, by instruction. The server action logs the
 * code rather than sending it, and the seam is exactly here: when a provider
 * is added, it takes this return value and this function stops returning it.
 */
create or replace function public.issue_school_email_code(addr text)
returns text
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare
  membership uuid;
  uni        uuid;
  code       text;
  recent     int;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = 'insufficient_privilege';
  end if;

  addr := lower(trim(addr));
  if addr !~ '^[^@\s]+@([a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}$' then
    raise exception 'That does not look like an email address.' using errcode = 'check_violation';
  end if;

  select m.id, m.university_id into membership, uni
    from public.club_memberships m
   where m.user_id = auth.uid()
     and m.status in ('pending', 'active')
   order by (m.status = 'pending') desc
   limit 1;

  if membership is null then
    raise exception 'Apply to a chapter first.' using errcode = 'no_data_found';
  end if;

  if not public.email_matches_university(addr, uni) then
    raise exception 'That address is not at the school you applied to.'
      using errcode = 'check_violation';
  end if;

  -- Three codes in ten minutes is somebody probing, not somebody who mistyped.
  select count(*) into recent from public.school_email_codes c
   where c.user_id = auth.uid() and c.created_at > now() - interval '10 minutes';
  if recent >= 3 then
    raise exception 'Too many codes requested. Wait ten minutes.' using errcode = 'check_violation';
  end if;

  code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  insert into public.school_email_codes (user_id, membership_id, email, code_hash, expires_at)
  values (auth.uid(), membership, addr,
          encode(digest(code, 'sha256'), 'hex'),
          now() + interval '15 minutes');

  return code;
end;
$$;

/** Redeem one. Marks the membership verified by `school_email`. */
create or replace function public.redeem_school_email_code(code text)
returns boolean
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare
  row_id     uuid;
  membership uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = 'insufficient_privilege';
  end if;

  update public.school_email_codes c
     set attempts = c.attempts + 1
   where c.user_id = auth.uid()
     and c.consumed_at is null
     and c.expires_at > now()
     and c.attempts < 5
   returning c.id, c.membership_id into row_id, membership;

  if row_id is null then
    return false;
  end if;

  perform 1 from public.school_email_codes c
   where c.id = row_id
     and c.code_hash = encode(digest(code, 'sha256'), 'hex');

  if not found then
    return false;
  end if;

  update public.school_email_codes set consumed_at = now() where id = row_id;

  /* Verified, but NOT approved: the status stays whatever the lead decides.
     A code proves the address, and the address proves the school. It does not
     prove the person is in the club, which is what a membership is. */
  update public.club_memberships m
     set verified_at         = coalesce(m.verified_at, now()),
         verification_method = coalesce(m.verification_method, 'school_email')
   where m.id = membership;

  return true;
end;
$$;

revoke execute on function public.issue_school_email_code(text) from anon;
revoke execute on function public.redeem_school_email_code(text) from anon;
grant execute on function public.issue_school_email_code(text) to authenticated;
grant execute on function public.redeem_school_email_code(text) to authenticated;


-- ============================================================================
-- The membership guard learns about redeemed codes.
--
-- `guard_membership_privileges` refuses `verified_at` and
-- `verification_method` to the member themselves, under "Nobody verifies
-- themselves", and it is right to. Redeeming a code is the one exception, and
-- it is an exception with a receipt: the update is allowed only when a
-- consumed code row for this membership and this user already exists, which
-- only `redeem_school_email_code()` can create.
--
-- So this is a narrowing, not a bypass. A member can still not type their own
-- verification in; they can only record one the database already witnessed.
-- And it stays deliberately weaker than a lead's vouch: the status is
-- untouched, so the person is verified as a student at that school and is
-- still not a member of the chapter until a lead says so.
--
-- Restated in full, as every migration that has touched a guard has done:
-- `create or replace` replaces the whole body.
-- ============================================================================
create or replace function public.guard_membership_privileges()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  lead_here boolean;
  is_self   boolean;
  redeemed  boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  lead_here := public.leads_club(new.club_id) and public.leads_club(old.club_id);
  is_self   := new.user_id = auth.uid();

  if new.user_id is distinct from old.user_id or new.club_id is distinct from old.club_id then
    raise exception 'A membership cannot be moved between people or clubs.'
      using errcode = 'insufficient_privilege';
  end if;

  if lead_here then
    if new.role is distinct from old.role and new.role = 'club_lead' then
      raise exception 'Only an admin can appoint a club lead.' using errcode = 'insufficient_privilege';
    end if;

    if new.verified_by_user_id is distinct from old.verified_by_user_id
       and new.verified_by_user_id is distinct from auth.uid() then
      raise exception 'A verification is recorded in the name of whoever made it.'
        using errcode = 'insufficient_privilege';
    end if;

    return new;
  end if;

  if is_self then
    if new.status is distinct from old.status then
      raise exception 'A club lead decides on an application, not the applicant.'
        using errcode = 'insufficient_privilege';
    end if;
    if new.role is distinct from old.role then
      raise exception 'Only a club lead or an admin can change a club role.'
        using errcode = 'insufficient_privilege';
    end if;

    -- The receipt: a code this person actually redeemed, for this membership.
    redeemed := new.verification_method = 'school_email'
            and exists (
              select 1 from public.school_email_codes c
               where c.membership_id = new.id
                 and c.user_id = auth.uid()
                 and c.consumed_at is not null
            );

    if not redeemed
       and (new.verified_at            is distinct from old.verified_at
         or new.verified_by_user_id    is distinct from old.verified_by_user_id
         or new.verification_method    is distinct from old.verification_method) then
      raise exception 'Nobody verifies themselves.' using errcode = 'insufficient_privilege';
    end if;

    -- Even with a receipt, the vouch is not recorded in anybody's name: no
    -- human vouched, and writing one in would be a forged signature.
    if new.verified_by_user_id is distinct from old.verified_by_user_id then
      raise exception 'A school-email code is not a vouch from a person.'
        using errcode = 'insufficient_privilege';
    end if;

    if new.decided_at is distinct from old.decided_at
       or new.decided_by_user_id is distinct from old.decided_by_user_id then
      raise exception 'The decision record is not the applicant''s to write.'
        using errcode = 'insufficient_privilege';
    end if;
    if old.status <> 'pending'
       and (new.legal_name        is distinct from old.legal_name
         or new.group_chat_handle is distinct from old.group_chat_handle) then
      raise exception 'Verification details are fixed once a decision has been made.'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  raise exception 'You do not lead that club.' using errcode = 'insufficient_privilege';
end;
$$;

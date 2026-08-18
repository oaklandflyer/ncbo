-- ============================================================================
-- Onboarding
--
-- Signup gives us an email address and nothing else. Everything a club needs
-- to know about a member — who they actually are, what year they're in, what
-- they're studying, how long they've been training — is collected once, on
-- /onboarding, before the hub opens.
--
-- Two rules shape this migration:
--
--  1. **No invented names.** 0001 filled `display_name` with the local part of
--     the email address, so `a.swanson24@pitt.edu` became "a.swanson24" and
--     every roster read like a mailing list. That fallback is removed here.
--     A profile now arrives with no name at all, and the app makes the member
--     supply one before it lets them in.
--
--  2. **The attestation is a record, not a checkbox.** `is_adult` is the
--     member's own statement that they are 18 or over. It defaults to false —
--     never true — so an unanswered row is a "no", and the app treats an
--     account without it as not yet onboarded.
-- ============================================================================

alter table public.profiles
  add column full_name          text,
  add column class_year         text,
  add column lifting_experience text,
  add column major              text,
  add column is_adult           boolean not null default false;

comment on column public.profiles.full_name is
  'The member''s real name, given by them at onboarding. display_name is what shows on the board.';
comment on column public.profiles.is_adult is
  'The member''s own 18+ attestation, made at onboarding. Never set on their behalf.';

-- ── display_name: no more email-prefix guessing ─────────────────────────────
-- It was `not null default 'Member'`, with the signup trigger substituting the
-- email prefix. Both go: the column now holds either a name a person chose or
-- nothing at all, and "nothing" is what sends them to onboarding.
alter table public.profiles
  alter column display_name drop default,
  alter column display_name drop not null;

-- Existing rows whose name was manufactured from their address are cleared, so
-- they get asked properly on next sign-in rather than keeping a name they
-- never chose. A name that doesn't look like an email local part is left
-- alone — someone chose it.
update public.profiles p
   set display_name = null
  from auth.users u
 where u.id = p.id
   and p.display_name is not null
   and lower(p.display_name) = lower(split_part(u.email, '@', 1));

-- ── signup, without the fallback ────────────────────────────────────────────
-- Identical to 0003 except for the display_name expression: metadata if the
-- signup carried a name, otherwise null. Approval still works exactly as
-- before — being onboarded and being approved are separate questions, and a
-- .edu at a known school is still approved on the spot.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  addr   text := lower(trim(new.email));
  dom    text;
  school uuid;
  staff  boolean;
  state  public.account_status := 'pending';
begin
  select exists (select 1 from public.allowed_emails where email = addr) into staff;

  if not staff then
    dom := split_part(addr, '@', 2);

    if dom ~ '^([a-z0-9-]+\.)*[a-z0-9-]+\.edu$' then
      select id into school from public.schools where domain = dom;
      if school is null then
        select id into school from public.schools
         where dom like '%.' || domain
         order by length(domain) desc limit 1;
      end if;

      if school is not null then
        state := 'approved';
      end if;
    end if;
  else
    state := 'approved';
  end if;

  insert into public.profiles (id, display_name, school_id, status, approved_at)
  values (new.id,
          nullif(new.raw_user_meta_data ->> 'display_name', ''),
          school,
          state,
          case when state = 'approved' then now() end);
  return new;
end;
$$;

-- ── is this account onboarded? ──────────────────────────────────────────────
-- One definition, in the database, so the layout guard, the middleware and any
-- future admin view all agree on what "finished onboarding" means. The app
-- reads the columns directly; this exists so policies and reports can ask.
create or replace function public.is_onboarded(p public.profiles)
returns boolean
language sql immutable
as $$
  select p.is_adult
     and coalesce(btrim(p.full_name), '')          <> ''
     and coalesce(btrim(p.display_name), '')       <> ''
     and coalesce(btrim(p.class_year), '')         <> ''
     and coalesce(btrim(p.lifting_experience), '') <> ''
     and coalesce(btrim(p.major), '')              <> ''
$$;

-- ── the privilege guard, extended ───────────────────────────────────────────
-- Onboarding fields are the member's own to write — that is the point of the
-- form. The one thing that must not be forgeable is the attestation being set
-- by anyone other than the member themselves, so an admin editing someone
-- else's row cannot flip is_adult on their behalf.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Checked before the admin bypass below: an admin may approve, suspend and
  -- reassign anyone, but nobody attests to being 18 on another person's behalf.
  if new.is_adult is distinct from old.is_adult and new.id <> auth.uid() then
    raise exception 'Only the member themselves can make the 18+ attestation.'
      using errcode = 'insufficient_privilege';
  end if;

  if public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'Only an admin can change a role.' using errcode = 'insufficient_privilege';
  end if;
  if new.status is distinct from old.status then
    raise exception 'Only an admin can approve or suspend an account.' using errcode = 'insufficient_privilege';
  end if;
  if new.club_id is distinct from old.club_id or new.school_id is distinct from old.school_id then
    raise exception 'Only an admin can reassign a club or school.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

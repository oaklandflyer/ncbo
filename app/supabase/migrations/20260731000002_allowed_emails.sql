-- ============================================================================
-- Staff accounts for people without a .edu address.
--
-- 0001 required every account to be a .edu address, which is right for
-- members — it's what ties someone to a school and a club. It is wrong for
-- everyone else. NCBO's advisory board is working IFBB and OCB pros, and the
-- exec team includes people who have graduated; none of them have a school
-- email, and they are precisely the people who need to answer questions.
--
-- So: keep .edu as the rule for members, and add a narrow, admin-managed
-- allowlist for staff. An address must be entered here BEFORE that person
-- signs up. Allowlisted accounts get no school affiliation (they aren't
-- students) and still arrive as `member` — an admin promotes them afterwards,
-- exactly as before. Being on the list grants entry, never privilege.
-- ============================================================================

create table public.allowed_emails (
  email      text primary key,
  note       text,                     -- 'Advisory board — posing', etc.
  created_at timestamptz not null default now()
);

-- Normalise on the way in so a stray capital can't create a bypass-shaped gap
-- between what an admin typed and what the trigger compares against.
create or replace function public.normalise_allowed_email()
returns trigger language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

create trigger normalise_allowed_email_trg
  before insert or update on public.allowed_emails
  for each row execute function public.normalise_allowed_email();

alter table public.allowed_emails enable row level security;

-- Deliberately admin-only, including SELECT: this list is a roster of the
-- organisation's staff, and ordinary members have no reason to read it.
create policy allowed_emails_admin on public.allowed_emails
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── the signup trigger, revised ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  addr   text := lower(trim(new.email));
  dom    text;
  school uuid;
  staff  boolean;
begin
  select exists (select 1 from public.allowed_emails where email = addr) into staff;

  if not staff and addr !~ '^[^@]+@([a-z0-9-]+\.)*[a-z0-9-]+\.edu$' then
    raise exception 'NCBO membership requires a .edu school email address.'
      using errcode = 'check_violation';
  end if;

  -- Staff accounts carry no school affiliation; they aren't students.
  if not staff then
    dom := split_part(addr, '@', 2);
    select id into school from public.schools where domain = dom;
    if school is null then
      select id into school from public.schools
       where dom like '%.' || domain
       order by length(domain) desc limit 1;
    end if;
  end if;

  insert into public.profiles (id, display_name, school_id)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(addr, '@', 1)),
          school);
  return new;
end;
$$;

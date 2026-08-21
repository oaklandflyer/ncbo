-- ============================================================================
-- Alumni status, admin editing, the brand-asset CMS.
--
-- Guarded throughout, applies twice cleanly, same as 0008–0011.
-- ============================================================================

-- ── 1. alumni ───────────────────────────────────────────────────────────────
-- A boolean, not a fifth `account_status`. Graduating does not change whether
-- an account is live — an alumnus is an approved member who has left school —
-- and folding it into the status enum would make "approved" and "alumni"
-- mutually exclusive, which would drop every graduate out of the directory
-- the moment they were marked.
alter table public.profiles
  add column if not exists is_alumni    boolean not null default false,
  add column if not exists alumni_since date;

create index if not exists profiles_alumni_idx on public.profiles (is_alumni) where is_alumni;

-- ── 2. who may write to a profile ───────────────────────────────────────────
-- The policy decides who may touch the row at all; the guard below decides
-- which columns. Widened to include moderators, as asked — an advisor can now
-- correct a member's details — while the privileged columns stay where they
-- were.
drop policy if exists profiles_update on public.profiles;

create policy profiles_update on public.profiles for update to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.is_moderator()
    or public.leads_school_of(id)
  )
  with check (
    id = auth.uid()
    or public.is_admin()
    or public.is_moderator()
    or public.leads_school_of(id)
  );

-- ── 3. the guard, extended for alumni ───────────────────────────────────────
-- Restated in full — `create or replace` replaces the whole body, and every
-- previous migration here has amended it the same way.
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

  -- Graduating is the member's own fact about their own life. They may set it,
  -- and so may the people who run their club or the organisation — a club lead
  -- clearing out a roster in June should not need an admin.
  if new.is_alumni is distinct from old.is_alumni
     and not (
       new.id = auth.uid()
       or public.is_admin()
       or public.is_moderator()
       or public.leads_school_of(new.id)
     ) then
    raise exception 'Only the member, their club lead, or an admin can change alumni status.'
      using errcode = 'insufficient_privilege';
  end if;

  if public.is_admin() then
    return new;
  end if;

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

  -- Removing an account is an admin action. A club lead may decide on a
  -- pending application at their own school and nothing more; an advisor
  -- moderates content, not membership.
  if new.status is distinct from old.status and not reviewing then
    if public.my_role() = 'club_lead' then
      raise exception 'A club lead can only approve or decline a pending account at their own school.'
        using errcode = 'insufficient_privilege';
    end if;
    raise exception 'Only an admin can approve, suspend or remove an account.'
      using errcode = 'insufficient_privilege';
  end if;

  -- A club lead moves nobody between schools; they may take a member off
  -- their own club's roster, which is a club change, not a school change.
  if new.school_id is distinct from old.school_id then
    raise exception 'Only an admin can reassign a school.' using errcode = 'insufficient_privilege';
  end if;

  if new.club_id is distinct from old.club_id
     and not (public.leads_school_of(new.id) and new.club_id is null) then
    raise exception 'Only an admin can assign a club.' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ── 4. the directory carries alumni, and drops removed accounts ─────────────
-- `status = 'approved'` was already the filter, so a removed account leaves
-- every directory the moment its status changes. Alumni are appended.
create or replace view public.member_directory
with (security_invoker = true) as
select
  p.id,
  p.display_name,
  p.role,
  p.division,
  p.home_region,
  p.verified,
  p.credentials,
  p.club_id,
  c.name   as club_name,
  p.school_id,
  s.name   as school_name,
  s.state  as school_state,
  p.instagram_handle,
  p.tiktok_handle,
  p.is_alumni,
  p.alumni_since
from public.profiles p
left join public.clubs c   on c.id = p.club_id
left join public.schools s on s.id = p.school_id
where p.status = 'approved';

grant select on public.member_directory to authenticated;

-- ── 5. site settings — the CMS's one row ────────────────────────────────────
-- A single row holding the paths of whatever the admins have uploaded. The
-- images themselves live in Storage; this table holds where to find them, so
-- swapping a logo is one UPDATE and no deploy.
create table if not exists public.site_settings (
  id         boolean primary key default true check (id),   -- exactly one row
  logo_path  text,
  hero_path  text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.site_settings (id) values (true) on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists site_settings_read  on public.site_settings;
drop policy if exists site_settings_write on public.site_settings;

create policy site_settings_read on public.site_settings for select to authenticated
  using (true);

create policy site_settings_write on public.site_settings for all to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

-- ── 6. the brand_assets bucket ──────────────────────────────────────────────
-- Wrapped in a guard because `storage` is a Supabase schema, not a Postgres
-- one: the throwaway database CI runs the policy suite against has no such
-- schema, and an unguarded reference would fail every migration run.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema absent (local test database) — skipping bucket setup';
    return;
  end if;

  -- Public read: a logo is on every page, including the signed-out one, and
  -- signing each request would cost a round trip per render for an image
  -- whose whole job is to be seen.
  insert into storage.buckets (id, name, public)
  values ('brand_assets', 'brand_assets', true)
  on conflict (id) do update set public = true;

  execute 'drop policy if exists brand_assets_read on storage.objects';
  execute 'drop policy if exists brand_assets_write on storage.objects';

  execute $p$
    create policy brand_assets_read on storage.objects for select to public
      using (bucket_id = 'brand_assets')
  $p$;

  -- Writes are moderators only, and only into this bucket — the same gate as
  -- the resource vault, for the same reason: this is the organisation's own
  -- brand, and anyone who can replace the logo can deface the app.
  execute $p$
    create policy brand_assets_write on storage.objects for all to authenticated
      using (bucket_id = 'brand_assets' and public.is_moderator())
      with check (bucket_id = 'brand_assets' and public.is_moderator())
  $p$;
end $$;

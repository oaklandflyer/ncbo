-- ============================================================================
-- Hometown suggestions: the regions members have already entered.
--
-- `profiles.home_region` is a free-text box and always has been, and beta
-- produced exactly what a free-text box produces. One member is from
-- "Pittsburgh, PA", the next from "pitt", a third from "Greater Pittsburgh".
-- The Network directory groups by this column, so those three are three
-- regions with one person each instead of one region with three, and the "By
-- Hometown" view — the whole point of which is finding somebody to train with
-- over the summer — quietly stops working.
--
-- The fix is to offer what is already there before somebody types something
-- new. That needs a read of the distinct values, and it cannot be a plain
-- select from the app:
--
--   `profiles_read` requires `is_approved()`, and the form that most needs
--   these suggestions is onboarding — where the member may well be pending,
--   because approval is what onboarding leads to. A pending account selecting
--   from `profiles` gets zero rows and an empty datalist, which is the one
--   outcome worse than no feature: it teaches people the box has no
--   suggestions and to stop looking.
--
-- So: SECURITY DEFINER, with a fixed projection of one column.
--
-- What that hands out is a list of region *strings* and nothing else. No ids,
-- no names, no counts, nothing joining a region to a person. It is strictly
-- less than the Network directory already shows every approved member, and it
-- is the minimum the form needs to stop creating duplicates. `authenticated`
-- only — `anon` is revoked below, because a public list of where NCBO's
-- members are from is not something a signed-out stranger should be able to
-- enumerate.
-- ============================================================================

create or replace function public.get_home_regions()
returns table (home_region text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct p.home_region
    from public.profiles p
   where p.home_region is not null
     and btrim(p.home_region) <> ''
     /* Not from deleted rows, and not from the placeholder that migration
        0009 backfilled onto every profile that had no region at all.
        Suggesting "Unlisted Region" to somebody being asked where they are
        from would be the duplicate problem again, wearing a hat. */
     and p.deleted_at is null
     and p.home_region <> 'Unlisted Region'
   order by 1;
$$;

comment on function public.get_home_regions() is
  'Distinct hometown regions already on file, for the Hometown combobox in onboarding and profile edit. SECURITY DEFINER because onboarding runs before approval and profiles_read requires is_approved(); the projection is one text column, with no link from any region back to a person.';

revoke execute on function public.get_home_regions() from anon;
grant execute on function public.get_home_regions() to authenticated;

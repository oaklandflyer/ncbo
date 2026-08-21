-- ============================================================================
-- Three chapter states, named.
--
-- `university_picker.has_chapter` is a boolean, and a boolean can only answer
-- two of the three questions signup actually has to answer:
--
--   active    a real chapter, taking members. Apply, and a lead reviews it.
--   pipeline  a chapter that exists in the organisation's plans and is not yet
--             running. Nobody can review an application, so an application
--             would sit pending forever. Wait-list instead, and say so.
--   none      no chapter at this school. The signup is still worth having,
--             because "how many students at schools we have not reached" is
--             the number that decides where NCBO expands next.
--
-- Today the Pipeline clubs fall into `has_chapter = false` because they carry
-- `active = false`, so somebody at Arizona is told "no chapter here yet" when
-- there is in fact one forming. That is a worse answer than the truth and it
-- costs nothing to fix.
--
-- `has_chapter` is kept, unchanged, so nothing that reads it breaks.
-- ============================================================================
create or replace view public.university_picker
with (security_invoker = true) as
select
  u.id,
  u.name,
  coalesce(u.short_name, u.name) as short_name,
  u.state,
  c.id     as club_id,
  c.name   as club_name,
  c.status as club_status,
  (c.id is not null and coalesce(c.active, false)) as has_chapter,
  case
    when c.id is not null and coalesce(c.active, false) then 'active'
    when c.id is not null                               then 'pipeline'
    else 'none'
  end as chapter_state
from public.universities u
left join public.clubs c on c.university_id = u.id
where u.active;

grant select on public.university_picker to authenticated, anon;

comment on view public.university_picker is
  'What the signup combobox reads. One row per university, with its single club or nulls: the 1:1 relation is what makes this a left join and not a nested list. chapter_state names the three outcomes signup has to handle; has_chapter is the old boolean, kept so existing readers do not break.';

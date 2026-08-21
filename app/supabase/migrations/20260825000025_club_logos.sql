-- ============================================================================
-- Club logos.
--
-- Chapters have their own marks, and a leaderboard that lists six clubs as six
-- lines of text asks the reader to do the recognising. A logo does that work.
--
-- Two columns and a bucket:
--
--   logo_url          the public URL of the current logo, or null. Null is a
--                     valid, permanent state: a chapter with no mark is not a
--                     chapter with a broken one, and every surface falls back
--                     to a monogram rather than to a hole
--   logo_updated_at   when it last changed. It exists for cache keys, not for
--                     display: the share card is rendered and cached by URL,
--                     and without this a club that swaps its logo keeps
--                     serving the old one until the edge forgets it
--
-- The object path is `clubs/{club_id}/logo-{unix_ts}.png`. The timestamp is
-- deliberate. A fixed filename is the obvious design and the wrong one: the
-- storage CDN caches by path, so re-uploading to `logo.png` serves the
-- previous image to everybody who has already seen it, for as long as the edge
-- holds it. A new path each time is the only version of this that is correct
-- on the first request.
-- ============================================================================
alter table public.clubs
  add column if not exists logo_url        text,
  add column if not exists logo_updated_at timestamptz;

comment on column public.clubs.logo_url is
  'Public URL of the club logo in the club-logos bucket, or null. Null is normal and renders as a monogram.';
comment on column public.clubs.logo_updated_at is
  'When logo_url last changed. Used as a cache key for the rendered share card, not shown to anybody.';

/* The empty string is not a URL; it is a null that got through a form. */
alter table public.clubs drop constraint if exists clubs_logo_url_check;
alter table public.clubs
  add constraint clubs_logo_url_check
  check (logo_url is null or btrim(logo_url) <> '');

-- ---------------------------------------------------------------------------
-- Who may edit a club
-- ---------------------------------------------------------------------------
/* `clubs_update` still reads the pre-membership pair `my_role() = 'club_lead'
   and id = my_club()`. That predates `my_led_clubs()`, which is what every
   other lead-scoped policy and the whole application layer now ask.

   The two disagree in one case, and it is a real one: `club_leads` still names
   people who have no membership row at all, because it named them before
   signups existed. `my_led_clubs()` unions both sources; `my_role()` reads
   only the profile mirror, so a lead who exists solely in `club_leads` is not
   a lead as far as this policy is concerned. `getViewerContext` shows those
   people the lead surfaces, which means the app would offer them a form the
   database then refuses.

   It also drops the single-club assumption in `my_club()`: somebody leading
   two chapters may edit both, which is the answer `canManageClub` already
   gives. Not a widening of who may edit a club, then, but the policy catching
   up with the answer the rest of the system gives. */
drop policy if exists clubs_update on public.clubs;
create policy clubs_update on public.clubs for update to authenticated
  using       (public.is_admin() or id = any (public.my_led_clubs()))
  with check  (public.is_admin() or id = any (public.my_led_clubs()));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- Wrapped in a guard because `storage` is a Supabase schema, not a Postgres
-- one: the throwaway database CI runs the policy suite against has no such
-- schema, and an unguarded reference would fail every migration run.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema absent (local test database), skipping bucket setup';
    return;
  end if;

  /* Does the caller lead the club that owns this object path?

     Created in here rather than at the top level because its body names
     `storage.foldername`, and a `language sql` body is parsed at creation
     time: at the top level this statement alone would fail every migration
     run against the storage-less test database. SECURITY DEFINER so it can be
     called from inside a storage policy, and written against text so a
     malformed path is `false` rather than a cast error raised from inside
     RLS. */
  execute $p$
    create or replace function public.owns_club_logo_path(object_name text)
    returns boolean
    language sql stable security definer set search_path = public, storage
    as $fn$
      select coalesce(
        (storage.foldername(object_name))[1] = 'clubs'
        and (storage.foldername(object_name))[2] in (
          select c::text from unnest(public.my_led_clubs()) c
        ),
        false)
    $fn$
  $p$;

  /* Public read. A club logo appears on the rankings, in the app shell and
     inside a share card rendered at the edge by a process holding no session
     at all. Signing each of those would cost a round trip per render for an
     image whose entire job is to be looked at. */
  insert into storage.buckets (id, name, public)
  values ('club-logos', 'club-logos', true)
  on conflict (id) do update set public = true;

  execute 'drop policy if exists club_logos_read   on storage.objects';
  execute 'drop policy if exists club_logos_write  on storage.objects';
  execute 'drop policy if exists club_logos_modify on storage.objects';

  execute $p$
    create policy club_logos_read on storage.objects for select to public
      using (bucket_id = 'club-logos')
  $p$;

  /* `to authenticated` and nothing else. The app holds an anon key and only an
     anon key by design, so the role a signed-out request arrives as is `anon`,
     and `anon` is named by no policy here: it cannot insert, update or delete
     in this bucket under any path.

     A signed-in member is likewise held to their own clubs' folders. The
     Server Action re-verifies leadership before it ever reaches storage, but
     the action is the convenience and this is the guarantee: somebody posting
     a hand-built request straight at the storage API meets this instead. */
  execute $p$
    create policy club_logos_write on storage.objects for insert to authenticated
      with check (
        bucket_id = 'club-logos'
        and (public.is_admin() or public.owns_club_logo_path(name))
      )
  $p$;

  execute $p$
    create policy club_logos_modify on storage.objects for all to authenticated
      using (
        bucket_id = 'club-logos'
        and (public.is_admin() or public.owns_club_logo_path(name))
      )
      with check (
        bucket_id = 'club-logos'
        and (public.is_admin() or public.owns_club_logo_path(name))
      )
  $p$;
end $$;

-- ---------------------------------------------------------------------------
-- The three RPCs that draw a club now return its mark
-- ---------------------------------------------------------------------------
/* Each of these already joins `clubs`, so the logo costs a column and nothing
   else. Fetching it separately per row is the alternative, and it is an N+1
   against a leaderboard.

   `create or replace` cannot widen a RETURNS TABLE, so each is dropped first. */

drop function if exists public.get_athlete_rankings();
create function public.get_athlete_rankings()
returns table (
  profile_id   uuid,
  display_name text,
  club_id      uuid,
  club_name    text,
  chapter      text,
  club_logo    text,
  entries      int,
  best_placing text,
  points       int,
  rank         int
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_approved() then
    raise exception 'Sign in to see the rankings.' using errcode = 'insufficient_privilege';
  end if;

  return query
  with scored as (
    select e.profile_id,
           e.club_id,
           public.entry_points(e."placing", e.won_overall) as pts,
           e."placing" as pl
      from public.competition_entries e
     where e.status = 'approved'
  ),
  totals as (
    select s.profile_id,
           count(*)::int as entries,
           sum(s.pts)::int as points,
           /* Best finish, ordered as a person reads them rather than as text
              sorts them: '10th' would otherwise beat '2nd'. */
           min(case s.pl when '1st' then 1 when '2nd' then 2 when '3rd' then 3
                         when '4th' then 4 when '5th' then 5 else 99 end) as best_rank
      from scored s
     group by s.profile_id
  )
  select t.profile_id,
         p.display_name,
         am.club_id,
         c.name,
         coalesce(u.short_name, u.name),
         c.logo_url,
         t.entries,
         case t.best_rank when 1 then '1st' when 2 then '2nd' when 3 then '3rd'
                          when 4 then '4th' when 5 then '5th' else 'DNP' end,
         t.points,
         rank() over (order by t.points desc, t.entries asc)::int
    from totals t
    join public.profiles p on p.id = t.profile_id
    /* The athlete's chapter comes from an active membership, never from a
       profile column: an org-role holder is not on a chapter's board. */
    left join public.active_memberships am on am.user_id = t.profile_id
    left join public.clubs c        on c.id = am.club_id
    left join public.universities u on u.id = am.university_id
   where p.status = 'approved' and p.deleted_at is null
   order by rank() over (order by t.points desc, t.entries asc);
end;
$$;

revoke execute on function public.get_athlete_rankings() from anon;
grant execute on function public.get_athlete_rankings() to authenticated;

drop function if exists public.get_chapter_cup_standings();
create function public.get_chapter_cup_standings()
returns table (
  club_id        uuid,
  club_name      text,
  chapter        text,
  club_logo      text,
  roster_points  int,
  stage_points   int,
  handler_points int,
  qa_points      int,
  qa_uncapped    int,
  total_points   int,
  rank           int
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_approved() then
    raise exception 'Sign in to see the standings.' using errcode = 'insufficient_privilege';
  end if;

  return query
  with roster as (
    select m.club_id, count(*)::int * 1 as pts
      from public.club_memberships m
     where m.status = 'active'
     group by m.club_id
  ),
  stage as (
    select e.club_id, count(*)::int * 5 as pts
      from public.competition_entries e
     where e.status = 'approved' and e.club_id is not null
     group by e.club_id
  ),
  handler as (
    /* Scored against the handler's OWN club, and only when the entry they
       crewed for was approved. Tagging cannot manufacture points. */
    select am.club_id, count(*)::int * 2 as pts
      from public.competition_handlers h
      join public.competition_entries e on e.id = h.entry_id and e.status = 'approved'
      join public.active_memberships am on am.user_id = h.handler_profile_id
     group by am.club_id
  ),
  qa as (
    /* One vote per member per answer is the primary key on `answer_votes`;
       "not your own" is its insert policy. Both are already true by the time a
       row exists, so this only has to count. */
    select am.club_id, count(*)::int * 1 as pts
      from public.answer_votes v
      join public.answers a   on a.id = v.answer_id and a.deleted_at is null
      join public.questions q on q.id = a.question_id and q.status = 'approved'
      join public.active_memberships am on am.user_id = a.author_id
     group by am.club_id
  ),
  combined as (
    select c.id,
           c.name,
           coalesce(u.short_name, u.name) as chapter,
           c.logo_url                     as logo,
           coalesce(roster.pts, 0)  as roster_pts,
           coalesce(stage.pts, 0)   as stage_pts,
           coalesce(handler.pts, 0) as handler_pts,
           coalesce(qa.pts, 0)      as qa_raw
      from public.clubs c
      join public.universities u on u.id = c.university_id
      left join roster  on roster.club_id  = c.id
      left join stage   on stage.club_id   = c.id
      left join handler on handler.club_id = c.id
      left join qa      on qa.club_id      = c.id
  ),
  capped as (
    select combined.*,
           /* qa may be at most a quarter of the final total. Solving
                qa <= 0.25 × (base + qa)
              for qa gives qa <= base / 3, which is the form used here because
              it needs no reference to the total it is helping to compute. */
           least(qa_raw, floor((roster_pts + stage_pts + handler_pts) / 3.0)::int) as qa_pts
      from combined
  )
  select capped.id,
         capped.name,
         capped.chapter,
         capped.logo,
         capped.roster_pts,
         capped.stage_pts,
         capped.handler_pts,
         capped.qa_pts,
         capped.qa_raw,
         (capped.roster_pts + capped.stage_pts + capped.handler_pts + capped.qa_pts)::int,
         rank() over (
           order by (capped.roster_pts + capped.stage_pts + capped.handler_pts + capped.qa_pts) desc,
                    capped.stage_pts desc
         )::int
    from capped
   order by rank() over (
     order by (capped.roster_pts + capped.stage_pts + capped.handler_pts + capped.qa_pts) desc,
              capped.stage_pts desc
   );
end;
$$;

revoke execute on function public.get_chapter_cup_standings() from anon;
grant execute on function public.get_chapter_cup_standings() to authenticated;

/* The share card gains the logo and the timestamp behind it. The timestamp is
   not printed: the card is rendered at the edge and cached by URL, and it is
   what lets the cache key change when a club swaps its mark.

   Still no ids, no email, no club internals: a logo in a public bucket is
   already public, so returning its URL to `anon` discloses nothing that
   fetching the image would not. */
drop function if exists public.get_share_card(uuid);
create function public.get_share_card(token uuid)
returns table (
  athlete_name    text,
  club_name       text,
  chapter         text,
  club_logo       text,
  logo_updated_at timestamptz,
  show_name       text,
  federation      text,
  date            date,
  division        text,
  class           text,
  "placing"       text,
  won_overall     boolean,
  status          text
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  return query
    select p.display_name,
           c.name,
           coalesce(u.short_name, u.name),
           c.logo_url,
           c.logo_updated_at,
           e.show_name,
           e.federation,
           e.date,
           e.division,
           e."class",
           e."placing",
           e.won_overall,
           e.status
      from public.competition_entries e
      join public.profiles p on p.id = e.profile_id
      left join public.clubs c        on c.id = e.club_id
      left join public.universities u on u.id = c.university_id
     where e.share_token = token
       and e.status <> 'returned'
       and p.deleted_at is null;
end;
$$;

grant execute on function public.get_share_card(uuid) to anon, authenticated;

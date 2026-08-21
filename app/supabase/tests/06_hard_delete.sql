-- ============================================================================
-- What survives a hard delete, and what must not.
--
-- The claim under test is the one the whole design rests on: deleting an
-- athlete must not retroactively change a chapter's Chapter Cup score. That
-- is easy to get half right, because there are two independent ways to lose
-- the points, and the second one survives the obvious fix:
--
--   1. the row cascades away          -> fixed by ON DELETE SET NULL
--   2. the row survives but scores    -> NOT fixed by that, because the
--      through a membership that          handler component joined
--      cascaded away                      active_memberships
--
-- So the test deletes a real athlete who is also a handler, and compares the
-- standings before and after.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
select public.reapply_column_privileges();

\set ON_ERROR_STOP 0
\pset pager off

reset role;
set test.uid = '';

\echo '=== fixtures: an athlete who competes and crews, at a scoring chapter ==='
insert into auth.users (id, email) values
  ('d1110000-0000-0000-0000-0000000d1111', 'doomed@example.com'),
  ('d2220000-0000-0000-0000-0000000d2222', 'survivor@example.com');

update public.profiles set display_name = v.n, status = 'approved' from (values
  ('d1110000-0000-0000-0000-0000000d1111'::uuid, 'Doomed Athlete'),
  ('d2220000-0000-0000-0000-0000000d2222'::uuid, 'Surviving Athlete')
) as v(id, n) where public.profiles.id = v.id;

insert into public.club_memberships (user_id, club_id, status, role, verified_at, verification_method)
select v.uid, c.id, 'active', 'member', now(), 'club_lead'
  from (values
    ('d1110000-0000-0000-0000-0000000d1111'::uuid),
    ('d2220000-0000-0000-0000-0000000d2222'::uuid)
  ) as v(uid)
  join public.clubs c on c.name = 'Purdue Bodybuilding Club';

-- Two approved entries: one by the doomed athlete, one by the survivor.
insert into public.competition_entries
  (profile_id, club_id, show_name, federation, date, division, "class", "placing", status, won_overall)
select v.uid, c.id, v.show, 'NPC', current_date - 30, 'Classic Physique', 'C', '1st', 'approved', false
  from (values
    ('d1110000-0000-0000-0000-0000000d1111'::uuid, 'Doomed Open'),
    ('d2220000-0000-0000-0000-0000000d2222'::uuid, 'Survivor Open')
  ) as v(uid, show)
  join public.clubs c on c.name = 'Purdue Bodybuilding Club';

-- The doomed athlete also crewed for the survivor: 2 handler points.
insert into public.competition_handlers (entry_id, handler_profile_id)
select e.id, 'd1110000-0000-0000-0000-0000000d1111'
  from public.competition_entries e where e.show_name = 'Survivor Open';

\echo '=== 1. the snapshot trigger filled the name and the club on insert ==='
select handler_display, handler_club_id is not null as club_snapshotted
  from public.competition_handlers h
  join public.competition_entries e on e.id = h.entry_id
 where e.show_name = 'Survivor Open';
-- expect Doomed Athlete | t

\echo '=== 2. the entry carries the athlete name too ==='
select athlete_display from public.competition_entries where show_name = 'Doomed Open';
-- expect Doomed Athlete

\echo '=== standings BEFORE the delete ==='
/* As a signed-in member: the RPC refuses anybody else, which is why the first
   run of this test captured nothing and test 7 could not compare. */
set role authenticated;
set test.uid = 'd2220000-0000-0000-0000-0000000d2222';
create temp table before_cup as
select club_name, stage_points, handler_points, roster_points, total_points
  from public.get_chapter_cup_standings() where club_name = 'Purdue Bodybuilding Club';
select * from before_cup;
reset role;
set test.uid = '';

\echo '=== 3. THE DELETE: remove the athlete at the auth level, as the real action does ==='
delete from auth.users where id = 'd1110000-0000-0000-0000-0000000d1111';

select count(*) as profile_rows from public.profiles where id = 'd1110000-0000-0000-0000-0000000d1111';
-- expect 0: the profile cascaded, which is the point

\echo '=== 4. the membership cascaded (an anonymous roster row is not a record) ==='
select count(*) as memberships
  from public.club_memberships where user_id = 'd1110000-0000-0000-0000-0000000d1111';
-- expect 0

\echo '=== 5. the competition entry SURVIVED, anonymised ==='
select profile_id is null as athlete_detached, athlete_display, status, club_id is not null as club_kept
  from public.competition_entries where show_name = 'Doomed Open';
-- expect t | Doomed Athlete | approved | t

\echo '=== 6. the handler credit SURVIVED, anonymised ==='
select handler_profile_id is null as handler_detached, handler_display, handler_club_id is not null as club_kept
  from public.competition_handlers h
  join public.competition_entries e on e.id = h.entry_id
 where e.show_name = 'Survivor Open';
-- expect t | Doomed Athlete | t

\echo '=== 7. THE CLAIM: stage and handler points are unchanged ==='
/* Roster points DO drop by one, and that is correct: the roster is one
   person smaller. Stage and handler points must not move at all. */
set role authenticated;
set test.uid = 'd2220000-0000-0000-0000-0000000d2222';
select b.stage_points   = a.stage_points   as stage_unchanged,
       b.handler_points = a.handler_points as handler_unchanged,
       b.roster_points - a.roster_points   as roster_dropped_by
  from before_cup b,
       lateral (select * from public.get_chapter_cup_standings()
                 where club_name = 'Purdue Bodybuilding Club') a;
reset role;
set test.uid = '';
-- expect t | t | 1

\echo '=== 8. the deleted athlete is gone from the individual board ==='
/* Correct, and different from the club case: an athlete leaderboard is a list
   of people, and they are not one any more. */
set role authenticated;
set test.uid = 'd2220000-0000-0000-0000-0000000d2222';
select count(*) as doomed_rows from public.get_athlete_rankings()
 where display_name = 'Doomed Athlete';
-- expect 0
reset role;
set test.uid = '';

\echo '=== 9. an already-shared card still renders under the snapshot name ==='
select athlete_name, status
  from public.get_share_card(
    (select share_token from public.competition_entries where show_name = 'Doomed Open'));
-- expect Doomed Athlete | approved

\echo '=== 10. two deleted handlers on one entry do not collide on the unique key ==='
/* The old primary key was (entry_id, handler_profile_id), which cannot hold
   two nulls. This is why it became a surrogate key with a unique index. */
insert into auth.users (id, email) values
  ('d3330000-0000-0000-0000-0000000d3333', 'doomed2@example.com'),
  ('d4440000-0000-0000-0000-0000000d4444', 'doomed3@example.com');
insert into public.club_memberships (user_id, club_id, status, role)
select v.uid, c.id, 'active', 'member'
  from (values ('d3330000-0000-0000-0000-0000000d3333'::uuid),
               ('d4440000-0000-0000-0000-0000000d4444'::uuid)) as v(uid)
  join public.clubs c on c.name = 'Purdue Bodybuilding Club';
insert into public.competition_handlers (entry_id, handler_profile_id)
select e.id, v.uid
  from public.competition_entries e
  cross join (values ('d3330000-0000-0000-0000-0000000d3333'::uuid),
                     ('d4440000-0000-0000-0000-0000000d4444'::uuid)) as v(uid)
 where e.show_name = 'Doomed Open';

delete from auth.users where id in ('d3330000-0000-0000-0000-0000000d3333',
                                    'd4440000-0000-0000-0000-0000000d4444');

select count(*) as both_handler_rows_survive
  from public.competition_handlers h
  join public.competition_entries e on e.id = h.entry_id
 where e.show_name = 'Doomed Open' and h.handler_profile_id is null;
-- expect 2

-- ── the audit log ───────────────────────────────────────────────────────────
\echo '=== 11. the audit row has no FK, so it outlives the account it names ==='
/* The whole design of this table in one test: write a row naming a user, then
   delete that user, then check the row is still there and still names them. */
insert into public.admin_audit_log
  (actor_user_id, actor_email, actor_display,
   target_user_id, target_email, target_display, action, detail)
values ('d2220000-0000-0000-0000-0000000d2222', 'admin@example.com', 'An Admin',
        'd1110000-0000-0000-0000-0000000d1111', 'doomed@example.com', 'Doomed Athlete',
        'hard_delete_user', '{"destroyed": {"memberships": 1}}'::jsonb);

select target_display, target_email, action,
       detail -> 'destroyed' ->> 'memberships' as memberships_destroyed
  from public.admin_audit_log
 where target_user_id = 'd1110000-0000-0000-0000-0000000d1111';
-- expect the row, naming an account that was deleted in test 3

\echo '=== 12. no FK constraint points at profiles from the audit log ==='
select count(*) as foreign_keys_to_profiles
  from pg_constraint
 where conrelid = 'public.admin_audit_log'::regclass
   and contype = 'f';
-- expect 0

\echo '=== 13. an ordinary member cannot read the audit log ==='
set role authenticated;
set test.uid = 'd2220000-0000-0000-0000-0000000d2222';
select count(*) as rows_visible_to_member from public.admin_audit_log;
-- expect 0: not an error, a policy-filtered empty result

\echo '=== 14. MUST FAIL: nobody can write their own audit entry ==='
insert into public.admin_audit_log (action) values ('i_did_nothing_wrong');

\echo '=== 15. MUST FAIL: and nobody can edit one ==='
update public.admin_audit_log set action = 'nothing_happened'
 where target_user_id = 'd1110000-0000-0000-0000-0000000d1111';

\echo '=== 16. MUST FAIL: or delete one ==='
delete from public.admin_audit_log
 where target_user_id = 'd1110000-0000-0000-0000-0000000d1111';

reset role;
set test.uid = '';

\echo '=== 17. the row is still there after all three attempts ==='
select count(*) as audit_rows_intact from public.admin_audit_log
 where target_user_id = 'd1110000-0000-0000-0000-0000000d1111';
-- expect 1

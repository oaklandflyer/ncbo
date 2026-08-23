-- ============================================================================
-- Push subscriptions.
--
-- A device's subscription is not a credential for this app, but it is the
-- means of sending that person a notification, so the table is owner-scoped
-- and the tests here are about exactly that: nobody reads or removes anybody
-- else's device, and the one case the policies cannot serve — two people on
-- one browser — goes through the definer function instead of widening them.
--
-- Same conventions: no harness, read the output, MUST FAIL means the loud
-- ERROR is the pass.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
select public.reapply_column_privileges();

\set ON_ERROR_STOP 0
\pset pager off

reset role;
set test.uid = '';

\echo '=== fixtures: two members and an admin ==='
insert into auth.users (id, email) values
  ('13000000-0000-0000-0000-000000000001', 'push-one@example.com'),
  ('13000000-0000-0000-0000-000000000002', 'push-two@example.com'),
  ('13000000-0000-0000-0000-000000000003', 'push-admin@example.com');

update public.profiles set display_name = v.n, status = 'approved' from (values
  ('13000000-0000-0000-0000-000000000001'::uuid, 'Push One'),
  ('13000000-0000-0000-0000-000000000002'::uuid, 'Push Two'),
  ('13000000-0000-0000-0000-000000000003'::uuid, 'Push Admin')
) as v(id, n) where public.profiles.id = v.id;

insert into public.org_roles (user_id, role)
  values ('13000000-0000-0000-0000-000000000003', 'admin');

\echo ''
\echo '=== 1. a member registers two devices, a phone and a laptop ==='
set role authenticated;
set test.uid = '13000000-0000-0000-0000-000000000001';
select public.save_push_subscription('https://push.example.com/one-phone',  'auth-a', 'p256-a') is not null as saved_phone;
select public.save_push_subscription('https://push.example.com/one-laptop', 'auth-b', 'p256-b') is not null as saved_laptop;
select count(*) as my_devices from public.push_subscriptions;

\echo ''
\echo '=== 2. re-registering the same browser refreshes the row, never adds one ==='
select public.save_push_subscription('https://push.example.com/one-phone', 'auth-a2', 'p256-a2') is not null as saved_again;
select count(*) as my_devices, count(*) filter (where auth = 'auth-a2') as refreshed
  from public.push_subscriptions;

\echo ''
\echo '=== 3. MUST RETURN NOTHING: another member reading those devices ==='
set test.uid = '13000000-0000-0000-0000-000000000002';
select count(*) as rows_visible from public.push_subscriptions;

\echo ''
\echo '=== 4. MUST FAIL: registering a device against somebody else''s account ==='
insert into public.push_subscriptions (user_id, endpoint, auth, p256dh)
values ('13000000-0000-0000-0000-000000000001', 'https://push.example.com/forged', 'x', 'y');

\echo ''
\echo '=== 5. deleting somebody else''s device removes nothing ==='
delete from public.push_subscriptions where endpoint = 'https://push.example.com/one-phone';
set test.uid = '13000000-0000-0000-0000-000000000001';
select count(*) as still_mine from public.push_subscriptions;

\echo ''
\echo '=== 6. a shared browser moves to whoever turned it on last ==='
/* The endpoint belongs to the device. Without the definer function the second
   person''s insert hits the first person''s row, RLS refuses it, and that
   browser never rings for anybody again. */
set test.uid = '13000000-0000-0000-0000-000000000002';
select public.save_push_subscription('https://push.example.com/one-laptop', 'auth-c', 'p256-c') is not null as took_over;
select count(*) as now_theirs from public.push_subscriptions
 where endpoint = 'https://push.example.com/one-laptop';
set test.uid = '13000000-0000-0000-0000-000000000001';
select count(*) as no_longer_mine from public.push_subscriptions
 where endpoint = 'https://push.example.com/one-laptop';

\echo ''
\echo '=== 7. an admin can read every subscription, for support ==='
set test.uid = '13000000-0000-0000-0000-000000000003';
select count(*) as all_rows from public.push_subscriptions;

\echo ''
\echo '=== 8. turning it off deletes the member''s own row ==='
set test.uid = '13000000-0000-0000-0000-000000000001';
delete from public.push_subscriptions where endpoint = 'https://push.example.com/one-phone';
select count(*) as mine_left from public.push_subscriptions;

\echo ''
\echo '=== 9. MUST FAIL: subscribing while signed out ==='
reset role;
set test.uid = '';
set role authenticated;
select public.save_push_subscription('https://push.example.com/anon', 'a', 'b');

\echo ''
\echo '=== 10. a deleted account takes its devices with it ==='
reset role;
set test.uid = '';
delete from public.profiles where id = '13000000-0000-0000-0000-000000000002';
select count(*) as orphans from public.push_subscriptions
 where user_id = '13000000-0000-0000-0000-000000000002';

set test.uid = '';

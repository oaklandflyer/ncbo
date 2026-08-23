-- ============================================================================
-- Lifetime training volume, as one row per person.
--
-- The Hub's Training widget and the network card both want "lifetime lb", and
-- the obvious way to get it — fetch every session and add the documents up in
-- the browser — sends a few hundred kilobytes of JSONB to a phone to display
-- one number. This does the traversal in Postgres and returns a row.
--
-- `security_invoker`, and that is the whole privacy story. The view runs as
-- the caller, so the policy on `workout_sessions` applies unchanged:
-- `profile_id = auth.uid()`. There is exactly one row anybody can see and it
-- is their own — not their lead's, not an admin's. That matches what phase 1
-- promised when it wrote that policy, and it is why this is a view over the
-- sessions rather than a denormalised counter that would need its own rules.
--
-- If a coaching feature ever wants somebody else's volume, it should be built
-- as sharing the member switches on. Widening this view is not that.
-- ============================================================================

create or replace view public.my_workout_totals
with (security_invoker = true) as
select
  s.profile_id,
  count(*)::int                        as sessions,
  coalesce(sum(v.volume), 0)::numeric  as total_volume,
  max(s.start_time)                    as last_start_time
from public.workout_sessions s
left join lateral (
  select coalesce(sum(
           (st->>'weight')::numeric * (st->>'reps')::numeric
         ), 0) as volume
    from jsonb_array_elements(s.workout_data) as ex
    cross join lateral jsonb_array_elements(
      /* A row written before the shape settled can carry anything under
         `sets`. Traversing that would fail the whole query rather than the
         one row, so an unexpected shape contributes nothing instead. */
      case when jsonb_typeof(ex->'sets') = 'array' then ex->'sets' else '[]'::jsonb end
    ) as st
   where (st->>'completed')::boolean is true
     and jsonb_typeof(st->'weight') = 'number'
     and jsonb_typeof(st->'reps')   = 'number'
) v on true
where s.status = 'completed'
group by s.profile_id;

comment on view public.my_workout_totals is
  'Lifetime completed-set volume for the calling member and nobody else: security_invoker means the workout_sessions policy (profile_id = auth.uid()) decides what this returns.';

grant select on public.my_workout_totals to authenticated;

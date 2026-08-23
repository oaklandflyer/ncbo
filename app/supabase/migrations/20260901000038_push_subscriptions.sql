-- ============================================================================
-- Web push subscriptions.
--
-- Phase 1 of native push: the place a device's subscription is kept. No
-- sending yet — that is the phase after this one, and it will read this table
-- with the service role from a server-side sender holding the VAPID private
-- key.
--
-- What a subscription actually is: the browser hands back an endpoint URL on
-- the vendor's push service (FCM, Mozilla, WNS) plus two keys the sender uses
-- to encrypt the payload — `p256dh`, the client's public key, and `auth`, a
-- shared secret. All three are per-device, per-browser and per-origin. None of
-- them is a credential for anything on this app: leaked, they let somebody
-- send that device a notification, which is why they are still readable only
-- by their owner.
--
-- One row per endpoint, not per user: a member with a phone and a laptop has
-- two, and both should ring.
-- ============================================================================
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,

  /* The vendor's push URL, and the identity of a subscription. Unique because
     the browser hands back the same endpoint for the same registration, and a
     second row would mean the same device notified twice. */
  endpoint   text not null unique check (length(endpoint) between 1 and 2048),

  -- Named as the browser names them, so nothing has to translate on the way
  -- in or on the way out to `web-push`.
  auth       text not null check (length(auth) between 1 and 255),
  p256dh     text not null check (length(p256dh) between 1 and 255),

  created_at timestamptz not null default now()
);

comment on table public.push_subscriptions is
  'One row per browser that has agreed to receive push. Deleted when the member turns notifications off, and by cascade when their account goes.';
comment on column public.push_subscriptions.endpoint is
  'The vendor push service URL. Identifies the device: a member with a phone and a laptop has two rows.';
comment on column public.push_subscriptions.auth is
  'The subscription''s shared secret, for payload encryption. Not a credential for this app, and still owner-readable only.';

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id, created_at desc);

-- ============================================================================
-- Row-level security
--
-- Narrow on purpose: a member's own rows, and an admin's read for support.
-- The sender in phase 2 runs as the service role, which bypasses RLS
-- entirely — that is what lets it read every subscription without a policy
-- widening this table for anybody holding a session.
-- ============================================================================
alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_read   on public.push_subscriptions;
drop policy if exists push_subscriptions_insert on public.push_subscriptions;
drop policy if exists push_subscriptions_update on public.push_subscriptions;
drop policy if exists push_subscriptions_delete on public.push_subscriptions;

create policy push_subscriptions_read on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());

/* Refreshing an existing row — the keys rotate when a browser renews a
   subscription against the same endpoint. Both clauses, so this cannot become
   a way to move somebody else's device onto your account. */
create policy push_subscriptions_update on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

/* Turning notifications off is a delete, and an admin can clear a row for
   somebody whose device is gone. */
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- ============================================================================
-- Saving one
--
-- A definer function rather than an upsert from the app, for a case the
-- policies above cannot serve and should not be widened to serve: two people
-- sharing a browser.
--
-- The endpoint belongs to the browser, not to the account. When the second
-- person turns notifications on, the vendor hands back the *same* endpoint,
-- the row still carries the first person's `user_id`, and every policy here
-- correctly refuses to touch it — so the insert fails, the toggle reports an
-- error, and that device never rings again for anybody. Reassigning the row
-- is the right answer, and it is safe precisely because the caller had to
-- present the endpoint the browser just gave them.
-- ============================================================================
/* The parameters are prefixed and the column names are not, which is not a
   naming preference: a plpgsql parameter called `endpoint` makes
   `on conflict (endpoint)` ambiguous, and Postgres refuses the whole statement
   at runtime rather than at creation — so the function installs cleanly and
   every save fails. Caught by test 1 in `13_push_subscriptions.sql`. */
create or replace function public.save_push_subscription(
  sub_endpoint text,
  sub_auth text,
  sub_p256dh text
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  saved uuid;
begin
  if auth.uid() is null then
    raise exception 'You are signed out.' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(btrim(sub_endpoint), '') = ''
     or coalesce(btrim(sub_auth), '') = ''
     or coalesce(btrim(sub_p256dh), '') = '' then
    raise exception 'That is not a complete subscription.' using errcode = 'check_violation';
  end if;

  insert into public.push_subscriptions as s (user_id, endpoint, auth, p256dh)
  values (auth.uid(), sub_endpoint, sub_auth, sub_p256dh)
  on conflict (endpoint) do update
    set user_id = auth.uid(),
        auth    = excluded.auth,
        p256dh  = excluded.p256dh
  returning s.id into saved;

  return saved;
end;
$$;

comment on function public.save_push_subscription(text, text, text) is
  'Records the calling account''s subscription for one browser, taking over the row if that browser was previously somebody else''s. Always writes auth.uid(), never a caller-supplied user id.';

revoke execute on function public.save_push_subscription(text, text, text) from anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ============================================================================
-- Club calendar configuration.
--
-- A chapter's schedule already exists somewhere: in a Google Calendar the lead
-- keeps, because that is what a student club actually uses. Rebuilding event
-- management inside this app would ask every lead to maintain the same
-- information twice, and the second copy is always the stale one.
--
-- So the app reads theirs. Three columns, and the third is the one that
-- matters most:
--
--   gcal_id        the calendar's public id
--   gcal_timezone  IANA zone. Google returns instants; this is what turns one
--                  back into "Tuesday 6pm" for the people who have to show up
--   gcal_published whether members see it. Configuring a calendar and
--                  publishing it are separate acts: a lead pasting an id and
--                  testing it should not broadcast a half-built schedule to
--                  their whole chapter mid-edit
-- ============================================================================
alter table public.clubs
  add column if not exists gcal_id        text,
  add column if not exists gcal_timezone  text not null default 'America/New_York',
  add column if not exists gcal_published boolean not null default false;

comment on column public.clubs.gcal_id is
  'Public Google Calendar id. Null means the club has not set one up, which is a valid state and not an error.';
comment on column public.clubs.gcal_timezone is
  'IANA zone the chapter meets in. Required, because an event with no zone is an event at the wrong time for somebody.';
comment on column public.clubs.gcal_published is
  'Whether the configured calendar is shown to members. Setting up and going live are separate decisions.';

/* A blank id is not a configured calendar; it is the empty string pretending
   to be one. Normalise so `gcal_id is not null` means what it looks like. */
alter table public.clubs drop constraint if exists clubs_gcal_id_check;
alter table public.clubs
  add constraint clubs_gcal_id_check
  check (gcal_id is null or btrim(gcal_id) <> '');

/* Nothing is published without an id to publish. */
alter table public.clubs drop constraint if exists clubs_gcal_published_check;
alter table public.clubs
  add constraint clubs_gcal_published_check
  check (not gcal_published or gcal_id is not null);

/* Leads already edit their own club through `clubs_update`; these three columns
   are inside that grant on purpose, so configuring a calendar needs no admin. */

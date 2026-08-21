-- ============================================================================
-- Two fixes to signing up, both found by somebody actually trying to sign up.
--
-- 1. `claimed_lead`
--
--    Onboarding asks how a club lead will recognise you: which group chat you
--    are in, your handle there, how you found the club. Sensible questions to
--    ask a stranger, and nonsense to ask the person who runs the chapter,
--    who has nobody above them in the club to prove themselves to.
--
--    So the form lets somebody say they run the chapter, and this records the
--    claim where a reviewer can see it. It is a claim and nothing more: the
--    membership is still created `pending` by `guard_membership_insert`, still
--    with `role = 'member'`, and nobody can approve their own application.
--    An admin appoints leads, exactly as before.
--
-- 2. The resubmission bug (no schema change, recorded here because this is
--    where somebody will look for it).
--
--    Onboarding wrote the membership with an upsert. The first submission
--    worked and every one after it failed with "permission denied for table
--    club_memberships", surfacing as "Your profile is saved, but the
--    application to your chapter did not go through."
--
--    `ON CONFLICT DO UPDATE` reads `excluded.legal_name`, and `legal_name` is
--    on this table's SELECT deny list, so the member cannot read it back even
--    though they just wrote it. INSERT alone never touches SELECT, which is
--    why the first attempt succeeded and hid the fault.
--
--    Fixed in `onboarding/actions.js` by looking the row up and then either
--    inserting or updating with literal values, neither of which reads a
--    denied column. `supabase/tests/08_onboarding_resubmit.sql` reproduces the
--    original failure and proves the new path.
-- ============================================================================
alter table public.club_memberships
  add column if not exists claimed_lead boolean not null default false;

comment on column public.club_memberships.claimed_lead is
  'The applicant said they run this chapter. A claim shown to whoever reviews the application, never a grant: the row is still pending with role = member, and only an admin appoints a lead.';

/* `club_memberships` has column-level privileges, so a column added here
   starts with no grant and selecting it fails the whole statement. Not on the
   deny list, so this hands it back. */
select public.reapply_column_privileges();

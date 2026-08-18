-- ============================================================================
-- 'rejected' is not 'suspended'
--
-- The admin queue's Decline button wrote `suspended`, which collapsed two
-- different facts into one word: "we looked at your application and said no"
-- and "you were a member and we've stopped that". They read differently to the
-- person on the receiving end, they need different screens, and an audit log
-- that cannot tell them apart is not much of an audit log.
--
-- This migration only adds the enum value. Postgres will not let a new enum
-- value be *used* in the same transaction that adds it, and the Supabase CLI
-- runs each migration file in one transaction — so everything that reads or
-- writes 'rejected' lives in the next migration, not this one.
-- ============================================================================

alter type public.account_status add value if not exists 'rejected';

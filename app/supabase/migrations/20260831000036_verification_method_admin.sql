-- ============================================================================
-- An admin's approval is its own verification method.
--
-- Not 'club_lead'. Who vouched for a member is the whole point of the column,
-- and recording an admin placement as a lead's decision would make the one row
-- that most deserves scrutiny indistinguishable from the ordinary path.
--
-- Alone in its own migration, and that is the point rather than tidiness: a
-- new enum value cannot be *used* in the transaction that adds it, and the
-- migration after this one uses it. One file per transaction keeps them apart.
-- ============================================================================
alter type public.verification_method add value if not exists 'admin';

comment on type public.verification_method is
  'How a membership came to be verified. ''admin'' is a placement by an NCBO admin - the path for a chapter with no lead appointed yet, and the one to look at first in an audit.';

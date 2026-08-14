/**
 * Scoring configuration.
 *
 * Every number in this file is a judgment call, not a fact. They are exported as
 * named constants (rather than buried in the maths) so that the explainer page at
 * /how-standing-works can render them, and so that changing one is a one-line diff
 * with a visible blast radius.
 */

/**
 * Shrinkage constant, in per-1,000-enrolled units.
 *
 * This is the weight given to the league mean when pulling a club's rate toward it.
 * Read it as "every club is treated as if it also had K thousand students' worth of
 * league-average performance attached to its record". A club whose enrollment is
 * large relative to K barely moves; a club whose enrollment is small relative to K
 * moves a long way toward the mean.
 *
 * K = 2 means the shrinkage is equivalent to 2,000 students of league-average
 * evidence. For a 30,000-student university that is ~6% of the denominator and
 * changes almost nothing. For a 2,000-student college it is 100% of the
 * denominator, so its rate lands halfway between its own result and the league
 * mean — which is the correct amount of scepticism to apply to a rate measured
 * over a tiny population.
 *
 * IMPORTANT: this value has not been empirically tuned, because there is no season
 * yet and therefore no data to tune it against. The principled way to set K is to
 * pick the value that minimises out-of-sample prediction error — fit it on half a
 * season and test it on the other half — once a real season exists. Until then, 2
 * is a defensible starting point and nothing more. Say so publicly.
 */
export const K = 2;

/**
 * Minimum number of *verified* members a club needs before it is ranked at all.
 *
 * Below this, a club is listed as "Unranked — building roster" and appears in the
 * table without a position. It is not scored, and it does not contribute to the
 * league mean.
 *
 * The reason is the same one that motivates shrinkage: a rate computed over a
 * handful of people is mostly noise, and shrinkage alone cannot rescue a sample
 * that small. A hard floor is more honest than a heavily-shrunk number that still
 * implies a real ranking.
 *
 * 10 is a starting point chosen to be low enough that a genuinely new club can
 * reach it in a semester. It needs revisiting once there is real roster data.
 */
export const MIN_ROSTER = 10;

/**
 * Which enrollment figure is the denominator.
 *
 * Undergraduate enrollment, not total enrollment. The reasoning: NCBO membership
 * is overwhelmingly undergraduate, so total enrollment would inflate the
 * denominator at universities with large graduate and professional populations and
 * penalise them for students who were never plausible members.
 *
 * This is a judgment call and it has losers either way — a school with a large
 * part-time or online undergraduate population gets a denominator that overstates
 * its realistic recruiting pool. It is stated as a constant so that changing it is
 * a deliberate, visible decision, and it is disclosed on the explainer page.
 */
export const DENOMINATOR = 'undergraduate_enrollment' as const;

/**
 * The rate is expressed per this many enrolled students. Changing it rescales
 * every rate and K identically, so it does not change the ordering — it only
 * changes what the numbers on screen mean.
 */
export const ENROLLMENT_UNIT = 1000;

/** Everything above, in one object, for rendering on the explainer page. */
export const SCORING_CONFIG = {
  K,
  MIN_ROSTER,
  DENOMINATOR,
  ENROLLMENT_UNIT,
} as const;

export type ScoringConfig = typeof SCORING_CONFIG;

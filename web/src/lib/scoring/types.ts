/** Types for the standings computation. Pure data — no I/O, no framework. */

/** What the scorer needs to know about one club. */
export interface ClubScoringInput {
  /** Stable identifier, also used as the final tiebreak so ordering is deterministic. */
  slug: string;
  /** Display name, carried through untouched. */
  name: string;
  /** Season points earned. See docs — points come from event weights. */
  points: number;
  /**
   * Undergraduate enrollment (see DENOMINATOR). `null` means we do not have a
   * verified figure — which is different from zero, and is not guessed at.
   */
  enrollment: number | null;
  /** Count of members whose membership has been verified. */
  verifiedMembers: number;
  /** Optional conference key, for per-conference tables. */
  conference?: string | undefined;
}

/** Why a club is present but not ranked. */
export type UnrankedReason =
  /** Fewer than MIN_ROSTER verified members. */
  | 'below-roster-floor'
  /** No verified enrollment figure — e.g. the IPEDS data has not been fetched. */
  | 'missing-enrollment'
  /** Enrollment on record is zero or negative, which cannot be a denominator. */
  | 'invalid-enrollment';

export interface RankedClub {
  slug: string;
  name: string;
  conference?: string | undefined;
  points: number;
  enrollment: number;
  /** Denominator actually used: enrollment / ENROLLMENT_UNIT. */
  enrollmentPer1k: number;
  /** points / (enrollment / 1000). High variance for small denominators. */
  rawRate: number;
  /** Shrunk toward the league mean. This is what the table is ordered by. */
  adjustedRate: number;
  /** 1-based. Ties share a position, and the next position skips (1, 2, 2, 4). */
  rank: number;
}

export interface UnrankedClub {
  slug: string;
  name: string;
  conference?: string | undefined;
  points: number;
  verifiedMembers: number;
  enrollment: number | null;
  reason: UnrankedReason;
}

export interface StandingsTable {
  ranked: RankedClub[];
  unranked: UnrankedClub[];
  /**
   * Σpoints / Σ(enrollment/1000) across ranked clubs only. Zero when nothing is
   * ranked, in which case no shrinkage target exists and nothing is ranked anyway.
   */
  leagueMean: number;
  /** True when there is nothing to rank at all — drives the pre-season empty state. */
  isEmpty: boolean;
}

/** One club's movement between two published snapshots. */
export interface RankMovement {
  slug: string;
  currentRank: number;
  previousRank: number;
  /** Positive = moved up the table. */
  delta: number;
}

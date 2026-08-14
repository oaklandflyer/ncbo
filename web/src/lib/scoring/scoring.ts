/**
 * NCBO standings scoring.
 *
 * ── The problem this module exists to solve ──────────────────────────────────
 *
 * Ranking clubs on raw points rewards big schools for being big. The obvious fix
 * is points per student — but a naive per-capita rate is worse, not better, in a
 * specific and predictable way:
 *
 *   1. A small denominator inflates the quotient. A 1,500-student college needs a
 *      twentieth of the points of a 30,000-student university to post the same
 *      rate, so small schools win the table by construction.
 *   2. Rates over small denominators are wildly high-variance. One 12-person club
 *      having a good week swings the national table, and the ordering is then
 *      mostly measuring luck.
 *
 * The standard correction is shrinkage (empirical-Bayes style): pull every club's
 * rate toward the league mean by an amount that depends on how much evidence
 * stands behind it. Clubs with a lot of enrolled students behind their rate barely
 * move; clubs with very few move a long way. Nobody is penalised for their school's
 * size — they are penalised for the *uncertainty* their sample size implies, which
 * is a different and defensible thing.
 *
 *   raw_rate    = points / (enrollment / 1000)
 *   league_mean = Σpoints / Σ(enrollment / 1000)      // across ranked clubs
 *   adjusted    = (points + K * league_mean) / (enrollment / 1000 + K)
 *
 * Both rates are surfaced in the UI. Showing only the adjusted number would be
 * asking people to trust a black box; showing only the raw one would be publishing
 * the noise. Transparency is the entire credibility argument for this table.
 *
 * See ./config.ts for K, MIN_ROSTER and the denominator choice, each of which is a
 * judgment call rather than a fact.
 */

import { ENROLLMENT_UNIT, K, MIN_ROSTER } from './config.js';
import type {
  ClubScoringInput,
  RankMovement,
  RankedClub,
  StandingsTable,
  UnrankedClub,
  UnrankedReason,
} from './types.js';

/** Rates that differ by less than this are treated as tied. */
const TIE_EPSILON = 1e-9;

/** Why this club cannot be ranked, or null if it can be. */
function disqualify(club: ClubScoringInput): UnrankedReason | null {
  if (club.verifiedMembers < MIN_ROSTER) return 'below-roster-floor';
  if (club.enrollment === null || !Number.isFinite(club.enrollment)) return 'missing-enrollment';
  if (club.enrollment <= 0) return 'invalid-enrollment';
  return null;
}

/**
 * Points per ENROLLMENT_UNIT enrolled students. Unshrunk, and therefore only
 * meaningful for clubs with a large enrollment behind them — which is why it is
 * shown next to the adjusted rate rather than instead of it.
 */
export function rawRate(points: number, enrollment: number): number {
  const per1k = enrollment / ENROLLMENT_UNIT;
  if (per1k <= 0) return 0;
  return points / per1k;
}

/**
 * Σpoints / Σ(enrollment/1000) over the clubs passed in.
 *
 * This is a pooled rate, not the mean of the individual rates. That distinction
 * matters: the mean-of-rates would itself be dominated by the small-denominator
 * clubs whose noise we are trying to damp, which would make the shrinkage target
 * as unstable as the thing being shrunk.
 *
 * Only ranked clubs contribute. A club below the roster floor is not evidence
 * about the league; it is evidence that we do not yet know much about that club.
 */
export function leagueMeanRate(clubs: readonly { points: number; enrollment: number }[]): number {
  let totalPoints = 0;
  let totalPer1k = 0;
  for (const club of clubs) {
    totalPoints += club.points;
    totalPer1k += club.enrollment / ENROLLMENT_UNIT;
  }
  if (totalPer1k <= 0) return 0;
  return totalPoints / totalPer1k;
}

/**
 * The shrunk rate.
 *
 * At K = 0 this reduces exactly to the raw rate. As enrollment grows relative to
 * K the adjusted rate converges on the raw rate. As enrollment shrinks relative to
 * K it converges on the league mean.
 */
export function adjustedRate(
  points: number,
  enrollment: number,
  mean: number,
  k: number = K,
): number {
  const per1k = enrollment / ENROLLMENT_UNIT;
  const denominator = per1k + k;
  if (denominator <= 0) return 0;
  return (points + k * mean) / denominator;
}

/**
 * Build a full standings table.
 *
 * Ordering: adjusted rate descending, then raw rate descending, then slug
 * ascending so the result is deterministic and stable across builds. Ties on the
 * adjusted rate share a rank and the next rank skips — 1, 2, 2, 4 — because
 * inventing a separation the maths does not support would be the same category of
 * dishonesty this module exists to avoid.
 */
export function computeStandings(
  clubs: readonly ClubScoringInput[],
  options: { k?: number } = {},
): StandingsTable {
  const k = options.k ?? K;

  const eligible: (ClubScoringInput & { enrollment: number })[] = [];
  const unranked: UnrankedClub[] = [];

  for (const club of clubs) {
    const reason = disqualify(club);
    if (reason === null) {
      eligible.push(club as ClubScoringInput & { enrollment: number });
    } else {
      unranked.push({
        slug: club.slug,
        name: club.name,
        conference: club.conference,
        points: club.points,
        verifiedMembers: club.verifiedMembers,
        enrollment: club.enrollment,
        reason,
      });
    }
  }

  const mean = leagueMeanRate(eligible);

  const scored = eligible.map((club) => ({
    slug: club.slug,
    name: club.name,
    conference: club.conference,
    points: club.points,
    enrollment: club.enrollment,
    enrollmentPer1k: club.enrollment / ENROLLMENT_UNIT,
    rawRate: rawRate(club.points, club.enrollment),
    adjustedRate: adjustedRate(club.points, club.enrollment, mean, k),
  }));

  scored.sort((a, b) => {
    if (Math.abs(a.adjustedRate - b.adjustedRate) > TIE_EPSILON) {
      return b.adjustedRate - a.adjustedRate;
    }
    if (Math.abs(a.rawRate - b.rawRate) > TIE_EPSILON) return b.rawRate - a.rawRate;
    return a.slug.localeCompare(b.slug);
  });

  const ranked: RankedClub[] = [];
  let lastRate: number | null = null;
  let lastRank = 0;
  scored.forEach((club, index) => {
    const tiedWithPrevious = lastRate !== null && Math.abs(club.adjustedRate - lastRate) <= TIE_EPSILON;
    const rank = tiedWithPrevious ? lastRank : index + 1;
    ranked.push({ ...club, rank });
    lastRate = club.adjustedRate;
    lastRank = rank;
  });

  unranked.sort((a, b) => a.name.localeCompare(b.name));

  return {
    ranked,
    unranked,
    leagueMean: mean,
    isEmpty: ranked.length === 0,
  };
}

/**
 * Rank movement between two snapshots.
 *
 * Returns an empty array when there is no previous snapshot, so the UI has nothing
 * to render rather than a column of zeroes implying "held position" in a season
 * where nothing has happened yet. Clubs absent from either snapshot are skipped —
 * a club's first appearance is not an improvement from anywhere.
 */
export function computeMovement(
  current: readonly RankedClub[],
  previous: readonly RankedClub[] | null | undefined,
): RankMovement[] {
  if (!previous || previous.length === 0) return [];
  const previousRanks = new Map(previous.map((club) => [club.slug, club.rank]));
  const movements: RankMovement[] = [];
  for (const club of current) {
    const previousRank = previousRanks.get(club.slug);
    if (previousRank === undefined) continue;
    movements.push({
      slug: club.slug,
      currentRank: club.rank,
      previousRank,
      // A smaller rank number is a better position, so the delta inverts.
      delta: previousRank - club.rank,
    });
  }
  return movements;
}

/** Filter a table to one conference, recomputing the mean within it. */
export function computeConferenceStandings(
  clubs: readonly ClubScoringInput[],
  conference: string,
  options: { k?: number } = {},
): StandingsTable {
  return computeStandings(
    clubs.filter((club) => club.conference === conference),
    options,
  );
}

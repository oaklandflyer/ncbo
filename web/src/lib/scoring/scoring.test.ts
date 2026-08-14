import { describe, expect, it } from 'vitest';
import { ENROLLMENT_UNIT, K, MIN_ROSTER } from './config.js';
import {
  adjustedRate,
  computeConferenceStandings,
  computeMovement,
  computeStandings,
  leagueMeanRate,
  rawRate,
} from './scoring.js';
import type { ClubScoringInput, RankedClub } from './types.js';

/** A club that clears every eligibility gate, so tests only vary what they mean to. */
function club(overrides: Partial<ClubScoringInput> & { slug: string }): ClubScoringInput {
  return {
    name: overrides.slug,
    points: 0,
    enrollment: 20_000,
    verifiedMembers: MIN_ROSTER,
    ...overrides,
  };
}

describe('rawRate', () => {
  it('is points per 1,000 enrolled', () => {
    expect(rawRate(100, 20_000)).toBe(5);
    expect(rawRate(100, 1_000)).toBe(100);
  });

  it('does not divide by zero', () => {
    expect(rawRate(100, 0)).toBe(0);
    expect(Number.isFinite(rawRate(100, 0))).toBe(true);
  });

  it('demonstrates the small-denominator inflation the adjustment exists to damp', () => {
    // Same 60 points. The tiny college posts a rate 20x the large university's,
    // purely because of its denominator. This is the naive formula being wrong.
    expect(rawRate(60, 1_500)).toBeCloseTo(40, 10);
    expect(rawRate(60, 30_000)).toBeCloseTo(2, 10);
  });
});

describe('leagueMeanRate', () => {
  it('pools totals rather than averaging the individual rates', () => {
    const clubs = [
      { points: 60, enrollment: 30_000 },
      { points: 60, enrollment: 1_500 },
    ];
    // Pooled: 120 points over 31.5 per-1k units.
    expect(leagueMeanRate(clubs)).toBeCloseTo(120 / 31.5, 10);
    // The mean-of-rates would be (2 + 40) / 2 = 21, dominated by the small club.
    expect(leagueMeanRate(clubs)).not.toBeCloseTo(21, 1);
  });

  it('is zero for an empty league rather than NaN', () => {
    expect(leagueMeanRate([])).toBe(0);
  });
});

describe('adjustedRate', () => {
  it('matches the documented formula', () => {
    const points = 60;
    const enrollment = 12_000;
    const mean = 4;
    const per1k = enrollment / ENROLLMENT_UNIT;
    expect(adjustedRate(points, enrollment, mean, 2)).toBeCloseTo((60 + 2 * 4) / (per1k + 2), 10);
  });

  it('reduces exactly to the raw rate when K is 0', () => {
    expect(adjustedRate(60, 12_000, 4, 0)).toBeCloseTo(rawRate(60, 12_000), 10);
    expect(adjustedRate(1, 1_200, 99, 0)).toBeCloseTo(rawRate(1, 1_200), 10);
  });

  it('converges on the league mean as enrollment shrinks toward zero', () => {
    const mean = 7;
    expect(adjustedRate(0.7, 100, mean, K)).toBeCloseTo(mean, 1);
  });

  it('barely moves a large club away from its raw rate', () => {
    const mean = 4;
    const raw = rawRate(120, 40_000);
    const adjusted = adjustedRate(120, 40_000, mean, K);
    // 40k enrolled vs K = 2 per-1k units: the shrinkage is ~5% of the denominator.
    expect(Math.abs(adjusted - raw)).toBeLessThan(0.2);
  });
});

describe('computeStandings — the small-denominator case that broke the old formula', () => {
  it('stops a 12-person club at a tiny school from buying the top spot with one good week', () => {
    // The spike club is small in both senses: 1,200 undergrads and a one-off haul.
    const spike = club({ slug: 'spike', enrollment: 1_200, points: 60, verifiedMembers: 12 });
    const steady = club({ slug: 'steady', enrollment: 30_000, points: 150, verifiedMembers: 80 });
    const alsoSteady = club({ slug: 'also-steady', enrollment: 25_000, points: 120, verifiedMembers: 60 });

    const table = computeStandings([spike, steady, alsoSteady]);
    const bySlug = new Map(table.ranked.map((entry) => [entry.slug, entry]));
    const spikeRow = bySlug.get('spike');
    const steadyRow = bySlug.get('steady');
    if (!spikeRow || !steadyRow) throw new Error('expected both clubs to be ranked');

    // On the naive formula the spike club wins by a mile — 50 vs 5.
    expect(spikeRow.rawRate).toBeGreaterThan(steadyRow.rawRate * 5);

    // After shrinkage its rate is pulled most of the way back to the league mean,
    // because 1.2 per-1k units of evidence is small next to K = 2.
    expect(spikeRow.adjustedRate).toBeLessThan(spikeRow.rawRate / 2);
    expect(Math.abs(spikeRow.adjustedRate - table.leagueMean)).toBeLessThan(
      Math.abs(spikeRow.rawRate - table.leagueMean),
    );
  });

  it('still lets a small club rank first if its result is large enough to survive shrinkage', () => {
    // Shrinkage damps small samples; it does not forbid small schools from winning.
    const small = club({ slug: 'small', enrollment: 2_000, points: 400, verifiedMembers: 40 });
    const large = club({ slug: 'large', enrollment: 40_000, points: 200, verifiedMembers: 200 });
    const table = computeStandings([small, large]);
    expect(table.ranked[0]?.slug).toBe('small');
  });
});

describe('computeStandings — the roster floor', () => {
  it('lists a club below MIN_ROSTER without ranking it', () => {
    const tiny = club({ slug: 'tiny', verifiedMembers: MIN_ROSTER - 1, points: 500, enrollment: 1_000 });
    const normal = club({ slug: 'normal', points: 100, verifiedMembers: 40 });
    const table = computeStandings([tiny, normal]);

    expect(table.ranked.map((entry) => entry.slug)).toEqual(['normal']);
    expect(table.unranked).toHaveLength(1);
    expect(table.unranked[0]?.slug).toBe('tiny');
    expect(table.unranked[0]?.reason).toBe('below-roster-floor');
  });

  it('excludes below-floor clubs from the league mean, so they cannot drag the target', () => {
    const normal = club({ slug: 'normal', points: 100, enrollment: 20_000, verifiedMembers: 40 });
    const belowFloor = club({
      slug: 'below',
      points: 9_999,
      enrollment: 1_000,
      verifiedMembers: MIN_ROSTER - 1,
    });

    const withoutIt = computeStandings([normal]);
    const withIt = computeStandings([normal, belowFloor]);
    expect(withIt.leagueMean).toBeCloseTo(withoutIt.leagueMean, 10);
  });

  it('ranks a club exactly at the floor', () => {
    const atFloor = club({ slug: 'at-floor', verifiedMembers: MIN_ROSTER, points: 10 });
    expect(computeStandings([atFloor]).ranked).toHaveLength(1);
  });
});

describe('computeStandings — missing and invalid enrollment', () => {
  it('does not rank a club whose enrollment has not been fetched', () => {
    const noData = club({ slug: 'no-data', enrollment: null, verifiedMembers: 50, points: 100 });
    const table = computeStandings([noData]);
    expect(table.ranked).toHaveLength(0);
    expect(table.unranked[0]?.reason).toBe('missing-enrollment');
  });

  it('treats zero enrollment as invalid rather than dividing by it', () => {
    const zero = club({ slug: 'zero', enrollment: 0, verifiedMembers: 50, points: 100 });
    const table = computeStandings([zero]);
    expect(table.unranked[0]?.reason).toBe('invalid-enrollment');
    for (const entry of table.ranked) {
      expect(Number.isFinite(entry.adjustedRate)).toBe(true);
    }
  });

  it('never produces NaN or Infinity anywhere in a table', () => {
    const table = computeStandings([
      club({ slug: 'a', enrollment: null, verifiedMembers: 50 }),
      club({ slug: 'b', enrollment: 0, verifiedMembers: 50 }),
      club({ slug: 'c', enrollment: 1, verifiedMembers: 50, points: 1_000_000 }),
      club({ slug: 'd', enrollment: 50_000, verifiedMembers: 50, points: 0 }),
    ]);
    for (const entry of table.ranked) {
      expect(Number.isFinite(entry.rawRate)).toBe(true);
      expect(Number.isFinite(entry.adjustedRate)).toBe(true);
    }
    expect(Number.isFinite(table.leagueMean)).toBe(true);
  });
});

describe('computeStandings — degenerate leagues', () => {
  it('reports an empty league rather than throwing', () => {
    const table = computeStandings([]);
    expect(table.isEmpty).toBe(true);
    expect(table.ranked).toEqual([]);
    expect(table.leagueMean).toBe(0);
  });

  it('is empty when every club is below the floor — the realistic pre-season case', () => {
    const table = computeStandings([
      club({ slug: 'a', verifiedMembers: 3 }),
      club({ slug: 'b', verifiedMembers: 0 }),
    ]);
    expect(table.isEmpty).toBe(true);
    expect(table.unranked).toHaveLength(2);
  });

  it('handles a one-club league, where the club is by definition the league mean', () => {
    const table = computeStandings([club({ slug: 'only', points: 100, enrollment: 20_000, verifiedMembers: 40 })]);
    expect(table.ranked).toHaveLength(1);
    expect(table.ranked[0]?.rank).toBe(1);
    expect(table.ranked[0]?.adjustedRate).toBeCloseTo(table.leagueMean, 10);
    expect(table.ranked[0]?.rawRate).toBeCloseTo(table.leagueMean, 10);
  });

  it('gives every club a zero rate when nobody has scored, without NaN', () => {
    const table = computeStandings([
      club({ slug: 'a', points: 0, verifiedMembers: 20 }),
      club({ slug: 'b', points: 0, verifiedMembers: 20 }),
    ]);
    expect(table.leagueMean).toBe(0);
    expect(table.ranked.every((entry) => entry.adjustedRate === 0)).toBe(true);
  });
});

describe('computeStandings — ordering', () => {
  it('orders by adjusted rate, not raw rate — and will reverse the raw order to do it', () => {
    // Two low-scoring large clubs drag the pooled mean down to ~3.1. The small
    // club leads on raw rate (12 vs 10) but has only 1 per-1k unit of evidence, so
    // it shrinks most of the way to that low mean while the 30k club barely moves.
    const table = computeStandings([
      club({ slug: 'small-spike', enrollment: 1_000, points: 12, verifiedMembers: 12 }),
      club({ slug: 'big-solid', enrollment: 30_000, points: 300, verifiedMembers: 100 }),
      club({ slug: 'filler-1', enrollment: 50_000, points: 50, verifiedMembers: 30 }),
      club({ slug: 'filler-2', enrollment: 50_000, points: 50, verifiedMembers: 30 }),
    ]);

    const small = table.ranked.find((entry) => entry.slug === 'small-spike');
    const big = table.ranked.find((entry) => entry.slug === 'big-solid');
    if (!small || !big) throw new Error('expected both clubs to be ranked');

    // Raw order: the small club is ahead.
    expect(small.rawRate).toBeGreaterThan(big.rawRate);
    // Adjusted order: it is not.
    expect(big.adjustedRate).toBeGreaterThan(small.adjustedRate);
    expect(table.ranked[0]?.slug).toBe('big-solid');
  });

  it('shares a rank on ties and skips the next position', () => {
    const table = computeStandings([
      club({ slug: 'a', enrollment: 10_000, points: 50, verifiedMembers: 20 }),
      club({ slug: 'b', enrollment: 10_000, points: 50, verifiedMembers: 20 }),
      club({ slug: 'c', enrollment: 10_000, points: 10, verifiedMembers: 20 }),
    ]);
    expect(table.ranked.map((entry) => entry.rank)).toEqual([1, 1, 3]);
  });

  it('is deterministic for identical clubs, breaking the tie on slug', () => {
    const inputs = [
      club({ slug: 'zeta', enrollment: 10_000, points: 50, verifiedMembers: 20 }),
      club({ slug: 'alpha', enrollment: 10_000, points: 50, verifiedMembers: 20 }),
    ];
    expect(computeStandings(inputs).ranked.map((e) => e.slug)).toEqual(['alpha', 'zeta']);
    expect(computeStandings([...inputs].reverse()).ranked.map((e) => e.slug)).toEqual(['alpha', 'zeta']);
  });
});

describe('computeMovement', () => {
  const rankedClub = (slug: string, rank: number): RankedClub => ({
    slug,
    name: slug,
    conference: undefined,
    points: 0,
    enrollment: 10_000,
    enrollmentPer1k: 10,
    rawRate: 0,
    adjustedRate: 0,
    rank,
  });

  it('returns nothing when there is no history to move against', () => {
    expect(computeMovement([rankedClub('a', 1)], null)).toEqual([]);
    expect(computeMovement([rankedClub('a', 1)], [])).toEqual([]);
  });

  it('reports a climb as positive and a fall as negative', () => {
    const movement = computeMovement(
      [rankedClub('climber', 1), rankedClub('faller', 2)],
      [rankedClub('climber', 4), rankedClub('faller', 1)],
    );
    expect(movement.find((m) => m.slug === 'climber')?.delta).toBe(3);
    expect(movement.find((m) => m.slug === 'faller')?.delta).toBe(-1);
  });

  it('skips a club making its first appearance', () => {
    const movement = computeMovement([rankedClub('new', 1)], [rankedClub('old', 1)]);
    expect(movement).toEqual([]);
  });
});

describe('computeConferenceStandings', () => {
  it('recomputes the mean within the conference rather than reusing the national one', () => {
    const clubs = [
      club({ slug: 'east-1', conference: 'east', points: 100, enrollment: 10_000, verifiedMembers: 20 }),
      club({ slug: 'east-2', conference: 'east', points: 80, enrollment: 10_000, verifiedMembers: 20 }),
      club({ slug: 'west-1', conference: 'west', points: 5, enrollment: 10_000, verifiedMembers: 20 }),
    ];
    const east = computeConferenceStandings(clubs, 'east');
    const national = computeStandings(clubs);
    expect(east.ranked.map((entry) => entry.slug)).toEqual(['east-1', 'east-2']);
    expect(east.leagueMean).toBeGreaterThan(national.leagueMean);
  });

  it('is empty for a conference with no clubs', () => {
    expect(computeConferenceStandings([], 'nobody').isEmpty).toBe(true);
  });
});

describe('config', () => {
  it('ships the documented starting values', () => {
    expect(K).toBe(2);
    expect(MIN_ROSTER).toBe(10);
    expect(ENROLLMENT_UNIT).toBe(1000);
  });
});

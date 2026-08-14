/**
 * Assembles the standings inputs from committed data and hands them to the
 * scoring module. This is the only place where "what the data says" meets "how
 * the table is computed", and it is deliberately thin.
 */

import { readFileSync } from 'node:fs';
import { getCollection } from 'astro:content';
import { z } from 'zod';
import { computeStandings, type ClubScoringInput, type StandingsTable } from '../scoring/index.js';
import { isDemo } from './demo.js';
import { enrollmentFor, enrollmentIsEmpty } from './enrollment.js';

const sampleFileSchema = z.object({
  clubs: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      points: z.number(),
      enrollment: z.number().nullable(),
      verifiedMembers: z.number().int().nonnegative(),
      conference: z.string().nullable().default(null),
    }),
  ),
});

function loadSampleInputs(): ClubScoringInput[] {
  const path = new URL('../../../../data/samples/standings.json', import.meta.url);
  const parsed = sampleFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  return parsed.clubs.map((club) => ({
    slug: club.slug,
    name: club.name,
    points: club.points,
    enrollment: club.enrollment,
    verifiedMembers: club.verifiedMembers,
    conference: club.conference ?? undefined,
  }));
}

/**
 * Real inputs, from `data/clubs/`.
 *
 * Two things are null across the board today, and both are load-bearing:
 * `verifiedMembers` (no verified roster exists) and `ipedsUnitId` (nobody has
 * matched the chapters to IPEDS yet). A null roster is read as zero verified
 * members, which puts every club below the roster floor — correct, because we
 * genuinely cannot say otherwise.
 */
export async function realScoringInputs(): Promise<ClubScoringInput[]> {
  const clubs = await getCollection('clubs');
  return clubs.map((entry) => ({
    slug: entry.data.slug,
    name: entry.data.school,
    points: 0,
    enrollment: enrollmentFor(entry.data.ipedsUnitId),
    verifiedMembers: entry.data.verifiedMembers ?? 0,
    conference: entry.data.conference,
  }));
}

export interface StandingsView {
  table: StandingsTable;
  /** True when the rows on screen are sample rows and the banner must render. */
  isSample: boolean;
  /** Why the real table is empty, for the pre-season explanatory state. */
  emptyReasons: {
    noSeason: boolean;
    noEnrollmentData: boolean;
    noVerifiedRosters: boolean;
  };
}

export async function getStandingsView(conference?: string): Promise<StandingsView> {
  const sample = isDemo();
  const inputs = sample ? loadSampleInputs() : await realScoringInputs();
  const scoped = conference ? inputs.filter((club) => club.conference === conference) : inputs;

  return {
    table: computeStandings(scoped),
    isSample: sample,
    emptyReasons: {
      // There is no season. Everything below is downstream of that.
      noSeason: !sample,
      noEnrollmentData: !sample && enrollmentIsEmpty(),
      noVerifiedRosters: !sample && scoped.every((club) => club.verifiedMembers === 0),
    },
  };
}

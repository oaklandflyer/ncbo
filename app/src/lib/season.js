/**
 * Which Chapter Cup season it is.
 *
 * A calendar year. The competitive season runs spring to autumn and nothing
 * about the Cup crosses a new year, so "the 2026 season" and "2026" are the
 * same thing and there is no need for a start month.
 *
 * The database has the same definition in `public.current_season()`, and every
 * RPC that takes a `season_year` defaults to it. This exists so a screen can
 * *label* the season without a round trip — the number in the heading and the
 * number the query used have to be the same one, and a page that fetched
 * standings for one year and printed another is the exact bug the last sweep
 * removed the labels to avoid.
 *
 * Server-side this reads the deployment's clock, which Vercel runs in UTC.
 * That matters for about eight hours a year, on New Year's Eve, and the wrong
 * answer there is "the season that starts tomorrow" — which is also the one
 * whose standings are empty and about to be correct.
 */
export function currentSeason() {
  return new Date().getUTCFullYear();
}

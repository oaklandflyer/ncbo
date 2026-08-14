/**
 * The sample-data gate.
 *
 * There is no NCBO season, so there are no standings. Sample data exists only so
 * the standings UI can be developed and reviewed against something. It must never
 * be mistakable for a real table, which means two hard rules:
 *
 *   1. It loads only when NCBO_DEMO_DATA=1 is set explicitly.
 *   2. It never loads in a production build. Not gated, not warned about —
 *      the build fails loudly instead, so nobody can ship it by accident.
 *
 * Anything rendered from it sits under a persistent, non-dismissible
 * "SAMPLE DATA — NOT REAL STANDINGS" banner (see SampleDataBanner.astro).
 */

export type DemoMode = 'off' | 'on';

export class DemoDataInProductionError extends Error {
  constructor() {
    super(
      'NCBO_DEMO_DATA=1 was set during a production build. Sample standings must ' +
        'never ship: no number in a production build may be presentable as a real ' +
        'standing. Unset NCBO_DEMO_DATA and rebuild, or use the dev server to view ' +
        'sample data.',
    );
    this.name = 'DemoDataInProductionError';
  }
}

/**
 * Pure resolver, so the rule is unit-testable without a build.
 *
 * @param flag  raw value of the NCBO_DEMO_DATA environment variable
 * @param isDev whether this is the dev server rather than a production build
 */
export function resolveDemoMode(flag: string | undefined, isDev: boolean): DemoMode {
  const requested = flag === '1';
  if (!requested) return 'off';
  if (!isDev) throw new DemoDataInProductionError();
  return 'on';
}

/** The live answer for this process. */
export function demoMode(): DemoMode {
  return resolveDemoMode(process.env['NCBO_DEMO_DATA'], import.meta.env.DEV);
}

export function isDemo(): boolean {
  return demoMode() === 'on';
}

import { describe, expect, it } from 'vitest';
import { DemoDataInProductionError, resolveDemoMode } from './demo.js';

describe('resolveDemoMode', () => {
  it('is off when the flag is unset, whatever the build type', () => {
    expect(resolveDemoMode(undefined, true)).toBe('off');
    expect(resolveDemoMode(undefined, false)).toBe('off');
  });

  it('is off for any value other than exactly "1"', () => {
    for (const value of ['0', 'true', 'yes', '', ' 1', '1 ']) {
      expect(resolveDemoMode(value, true)).toBe('off');
    }
  });

  it('is on in dev when explicitly requested', () => {
    expect(resolveDemoMode('1', true)).toBe('on');
  });

  it('THROWS rather than silently disabling itself in a production build', () => {
    // The important case. A silent fallback would let a production build succeed
    // while the person who set the flag believed sample data was rendering; a
    // thrown error makes the mistake impossible to miss.
    expect(() => resolveDemoMode('1', false)).toThrow(DemoDataInProductionError);
  });
});

import { describe, expect, it } from 'vitest';
import { assertNotProduction, DevAuthInProductionError } from './dev-provider.js';
import { evaluate, PROTECTED_ROUTES, ruleFor } from './guard.js';
import { atLeast, ROLES, type Session } from './types.js';
import { memberSchema } from '../schemas.js';

const session = (role: Session['role'], expiresAt: string): Session => ({
  id: 'sess',
  memberId: 'm1',
  role,
  expiresAt,
});

const NOW = new Date('2026-08-14T12:00:00Z');
const FUTURE = '2026-08-15T12:00:00Z';
const PAST = '2026-08-13T12:00:00Z';

describe('role ordering', () => {
  it('is ordered least to most privileged', () => {
    expect(ROLES).toEqual(['member', 'officer', 'coach', 'admin']);
  });

  it('compares correctly in both directions', () => {
    expect(atLeast('admin', 'member')).toBe(true);
    expect(atLeast('member', 'admin')).toBe(false);
    expect(atLeast('officer', 'officer')).toBe(true);
  });
});

describe('ruleFor', () => {
  it('returns nothing for public floor routes', () => {
    for (const path of ['/', '/standings', '/clubs/pitt', '/resources/health']) {
      expect(ruleFor(path)).toBeNull();
    }
  });

  it('matches the longest prefix, so a nested rule is not satisfied by its parent', () => {
    expect(ruleFor('/hub/admin/members')?.minimum).toBe('admin');
    expect(ruleFor('/hub/club/roster')?.minimum).toBe('officer');
    expect(ruleFor('/hub')?.minimum).toBe('member');
  });

  it('does not match a path that merely starts with the same characters', () => {
    expect(ruleFor('/hubbub')).toBeNull();
  });
});

describe('evaluate', () => {
  it('allows public routes with no session at all', () => {
    expect(evaluate('/standings', null, NOW)).toEqual({ allow: true });
  });

  it('refuses a protected route without a session', () => {
    expect(evaluate('/hub', null, NOW)).toEqual({ allow: false, reason: 'unauthenticated' });
  });

  it('refuses an expired session', () => {
    expect(evaluate('/hub', session('member', PAST), NOW)).toEqual({
      allow: false,
      reason: 'expired',
    });
  });

  it('treats an exactly-expiring session as expired', () => {
    expect(evaluate('/hub', session('member', NOW.toISOString()), NOW).allow).toBe(false);
  });

  it('refuses a member reaching for an admin route', () => {
    expect(evaluate('/hub/admin', session('member', FUTURE), NOW)).toEqual({
      allow: false,
      reason: 'insufficient-role',
    });
  });

  it('allows an admin everywhere', () => {
    for (const rule of PROTECTED_ROUTES) {
      expect(evaluate(rule.prefix, session('admin', FUTURE), NOW).allow).toBe(true);
    }
  });

  it('allows an officer into club tools but not admin', () => {
    expect(evaluate('/hub/club', session('officer', FUTURE), NOW).allow).toBe(true);
    expect(evaluate('/hub/admin', session('officer', FUTURE), NOW).allow).toBe(false);
  });
});

describe('dev session provider', () => {
  it('refuses to be constructed in production', () => {
    expect(() => assertNotProduction('production')).toThrow(DevAuthInProductionError);
  });

  it('is permitted in development and test', () => {
    expect(() => assertNotProduction('development')).not.toThrow();
    expect(() => assertNotProduction('test')).not.toThrow();
    expect(() => assertNotProduction(undefined)).not.toThrow();
  });
});

describe('privacy defaults in the schema', () => {
  it('defaults visibility to private when the field is omitted', () => {
    // The important test: a future form that forgets to send `visibility` must
    // produce a private profile, never a public one.
    const parsed = memberSchema.parse({
      id: 'm1',
      email: 'student@example.edu',
      schoolDomain: 'example.edu',
      createdAt: '2026-08-14T00:00:00Z',
    });
    expect(parsed.visibility).toBe('private');
    expect(parsed.role).toBe('member');
    expect(parsed.verified).toBe(false);
    expect(parsed.displayName).toBeNull();
  });

  it('rejects any attempt to mark email or precise location public', () => {
    const withEmailPublic = memberSchema.safeParse({
      id: 'm1',
      email: 'student@example.edu',
      schoolDomain: 'example.edu',
      createdAt: '2026-08-14T00:00:00Z',
      emailVisibility: 'public',
    });
    // There is no such field: the schema is strict, so inventing one fails
    // rather than being silently ignored.
    expect(withEmailPublic.success).toBe(false);
  });

  it('does not accept an unknown visibility value', () => {
    const parsed = memberSchema.safeParse({
      id: 'm1',
      email: 'student@example.edu',
      schoolDomain: 'example.edu',
      createdAt: '2026-08-14T00:00:00Z',
      visibility: 'everyone',
    });
    expect(parsed.success).toBe(false);
  });
});

/**
 * Route protection.
 *
 * Pure decision function plus the middleware that applies it. The decision is
 * separated so it can be unit-tested without a request, and so the rules are
 * readable in one place rather than scattered through route handlers.
 */

import { atLeast, type Role, type Session } from './types.js';

export interface RouteRule {
  /** Path prefix this rule guards. */
  prefix: string;
  /** Minimum role required. */
  minimum: Role;
}

/**
 * The member ceiling. Everything not matched here is public floor: server
 * rendered, indexable, no login. Nothing in this list is built yet -- the rules
 * exist so that adding a page under one of these prefixes is protected by
 * default rather than by remembering to protect it.
 */
export const PROTECTED_ROUTES: RouteRule[] = [
  { prefix: '/hub', minimum: 'member' },
  { prefix: '/hub/check-in', minimum: 'member' },
  { prefix: '/hub/club', minimum: 'officer' },
  { prefix: '/hub/coach', minimum: 'coach' },
  { prefix: '/hub/admin', minimum: 'admin' },
];

export type GuardOutcome =
  | { allow: true }
  | { allow: false; reason: 'unauthenticated' | 'expired' | 'insufficient-role' };

/** Longest matching prefix wins, so /hub/admin is not satisfied by the /hub rule. */
export function ruleFor(pathname: string, rules: RouteRule[] = PROTECTED_ROUTES): RouteRule | null {
  let match: RouteRule | null = null;
  for (const rule of rules) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      if (!match || rule.prefix.length > match.prefix.length) match = rule;
    }
  }
  return match;
}

export function evaluate(
  pathname: string,
  session: Session | null,
  now: Date,
  rules: RouteRule[] = PROTECTED_ROUTES,
): GuardOutcome {
  const rule = ruleFor(pathname, rules);
  if (!rule) return { allow: true };
  if (!session) return { allow: false, reason: 'unauthenticated' };
  if (new Date(session.expiresAt).getTime() <= now.getTime()) {
    return { allow: false, reason: 'expired' };
  }
  if (!atLeast(session.role, rule.minimum)) {
    return { allow: false, reason: 'insufficient-role' };
  }
  return { allow: true };
}

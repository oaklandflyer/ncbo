/**
 * Auth domain types.
 *
 * No auth system runs here. Real `.edu` magic-link sign-in needs an email
 * provider, which needs an account, which is out of scope for this build. What
 * exists is the seam: the types, the role model and the route-protection
 * middleware, so that wiring in a provider later is a substitution rather than a
 * redesign. See docs/AUTH.md.
 */

/**
 * Roles, ordered from least to most privileged. The order is load-bearing:
 * `atLeast` compares by index, so inserting a role in the wrong place silently
 * changes who can reach what.
 */
export const ROLES = ['member', 'officer', 'coach', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Profile visibility.
 *
 * `private` is the default everywhere, and that default is encoded in the schema
 * rather than the UI so a future form cannot invert it by omitting a field.
 * Publishing a student's name against bodybuilding participation is not a neutral
 * act -- see docs/PRIVACY.md.
 */
export const VISIBILITY = ['private', 'club', 'public'] as const;
export type Visibility = (typeof VISIBILITY)[number];

export interface Member {
  id: string;
  /**
   * Institutional email. NEVER public at any visibility level -- there is no
   * setting that exposes it, by construction.
   */
  email: string;
  /** Derived from the email domain at sign-up; see docs/AUTH.md. */
  schoolDomain: string;
  /** Club slug, matching data/clubs/. */
  clubSlug: string | null;
  role: Role;
  displayName: string | null;
  /** Defaults to 'private'. */
  visibility: Visibility;
  /**
   * Whether NCBO has verified this membership. Drives the roster floor in
   * scoring. It is a membership check, not a statement about expertise.
   */
  verified: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  memberId: string;
  role: Role;
  /** ISO timestamp. Sessions are checked against this on every request. */
  expiresAt: string;
}

/** True when `role` is at least as privileged as `required`. */
export function atLeast(role: Role, required: Role): boolean {
  return ROLES.indexOf(role) >= ROLES.indexOf(required);
}

/** The contract any real provider must satisfy. */
export interface SessionProvider {
  readonly name: string;
  getSession(token: string | undefined): Promise<Session | null>;
  getMember(memberId: string): Promise<Member | null>;
  destroySession(token: string): Promise<void>;
}

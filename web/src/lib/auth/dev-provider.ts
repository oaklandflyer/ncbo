/**
 * File-based session provider. DEVELOPMENT ONLY.
 *
 * This exists so the protected-route seam can be exercised locally without an
 * email provider. It is not a security mechanism and must never run in
 * production: sessions are plain files on disk with no cryptographic binding,
 * and members are fixtures.
 *
 * Rather than being merely "disabled" in production, construction THROWS. A
 * provider that quietly degrades is one that eventually ships.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Member, Session, SessionProvider } from './types.js';

export class DevAuthInProductionError extends Error {
  constructor() {
    super(
      'The development file-based session provider was constructed with ' +
        "NODE_ENV=production. It has no security properties and must never run in a " +
        'production build. Wire a real provider instead — see docs/AUTH.md.',
    );
    this.name = 'DevAuthInProductionError';
  }
}

/** Pure guard, so the refusal is testable without touching the filesystem. */
export function assertNotProduction(nodeEnv: string | undefined): void {
  if (nodeEnv === 'production') throw new DevAuthInProductionError();
}

export class DevFileSessionProvider implements SessionProvider {
  readonly name = 'dev-file';
  private readonly dir: string;

  constructor(dir = '.sessions', nodeEnv: string | undefined = process.env['NODE_ENV']) {
    assertNotProduction(nodeEnv);
    this.dir = dir;
    mkdirSync(this.dir, { recursive: true });
  }

  async getSession(token: string | undefined): Promise<Session | null> {
    if (!token || !/^[a-zA-Z0-9_-]+$/.test(token)) return null;
    try {
      return JSON.parse(readFileSync(join(this.dir, `${token}.json`), 'utf8')) as Session;
    } catch {
      return null;
    }
  }

  async getMember(memberId: string): Promise<Member | null> {
    try {
      return JSON.parse(readFileSync(join(this.dir, `member-${memberId}.json`), 'utf8')) as Member;
    } catch {
      return null;
    }
  }

  async destroySession(token: string): Promise<void> {
    rmSync(join(this.dir, `${token}.json`), { force: true });
  }

  /** Test helper — writes a fixture session. Development only, like the rest. */
  async createSession(session: Session, member: Member): Promise<void> {
    writeFileSync(join(this.dir, `${session.id}.json`), JSON.stringify(session, null, 2));
    writeFileSync(join(this.dir, `member-${member.id}.json`), JSON.stringify(member, null, 2));
  }
}

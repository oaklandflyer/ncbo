import { defineMiddleware } from 'astro:middleware';
import { evaluate, ruleFor } from './lib/auth/guard.js';
import type { Session } from './lib/auth/types.js';

/**
 * Route-protection middleware — the seam, wired but not yet load-bearing.
 *
 * Two things to understand before relying on this:
 *
 * 1. **This site builds to static output.** Middleware runs during the build, not
 *    on each request, so it cannot protect anything at runtime today. It is
 *    correct and useful the moment the member ceiling needs a server adapter,
 *    and it fails closed in the meantime: every protected prefix refuses,
 *    because there is no session provider to say otherwise.
 *
 * 2. **No page under a protected prefix exists yet.** The rules are written first
 *    on purpose, so that adding /hub/* later is protected by default rather than
 *    by someone remembering to protect it.
 *
 * See docs/AUTH.md for the intended .edu magic-link flow and what has to be
 * provisioned to make this real.
 */

/**
 * Reads the session for a request. Always null today: the dev file provider is
 * explicitly not wired in here, because a provider with no security properties
 * has no business being the thing that decides access, even in development.
 * Substitute a real provider here.
 */
async function readSession(_request: Request): Promise<Session | null> {
  return null;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const rule = ruleFor(context.url.pathname);
  if (!rule) return next();

  const session = await readSession(context.request);
  const outcome = evaluate(context.url.pathname, session, new Date());

  if (outcome.allow) return next();

  // A protected route is not advertised to someone who cannot reach it: an
  // unauthenticated visitor gets 404, not 403, so the response does not disclose
  // which member surfaces exist.
  if (outcome.reason === 'insufficient-role') {
    return new Response('Forbidden', { status: 403 });
  }
  return new Response('Not found', { status: 404 });
});

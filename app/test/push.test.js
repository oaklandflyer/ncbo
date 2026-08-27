import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/*
 * The service-role sender, checked at the source.
 *
 * `src/lib/push.js` cannot be imported here: it starts with `import
 * 'server-only'`, which throws outside a React Server Component build, and it
 * resolves `@/lib/supabase/admin` through a bundler alias that plain `node
 * --test` does not have. Both of those are load-bearing and neither should be
 * removed to make a test easier.
 *
 * So this reads the file, the same way `providersMounted.test.js` does for the
 * same reason: the invariants below have no runtime surface to assert against,
 * and the only evidence is in the source.
 *
 * What is being pinned is one thing. This module holds the key that bypasses
 * row-level security, so **RLS is no longer scoping its queries — the file
 * is.** Every read and delete must carry an explicit `user_id`. A query here
 * that loses that clause reads or deletes across every member in the database,
 * and no policy will stop it.
 */

const SRC = new URL('../src/lib/push.js', import.meta.url);
const source = readFileSync(SRC, 'utf8');

test('the sender is server-only', () => {
  /* Without this a client component importing anything that reaches this
     module would inline VAPID_PRIVATE_KEY into the browser bundle. */
  assert.match(
    source.split('\n').slice(0, 3).join('\n'),
    /^import 'server-only';/m,
    "push.js must open with import 'server-only'",
  );
});

test('the private key is never NEXT_PUBLIC_ prefixed', () => {
  assert.doesNotMatch(
    source,
    /NEXT_PUBLIC_VAPID_PRIVATE_KEY/,
    'the prefix alone would publish the signing key to every browser',
  );
  assert.match(source, /process\.env\.VAPID_PRIVATE_KEY/);
});

test('every service-role query is scoped to one user_id', () => {
  /* The whole boundary. Each `.from('push_subscriptions')` chain must carry an
     `.eq('user_id', …)`, because the client running it bypasses RLS. */
  const chains = source.split("from('push_subscriptions')").slice(1);
  assert.ok(chains.length >= 2, 'expected at least a read and a delete');

  for (const [i, chain] of chains.entries()) {
    /* Up to the end of the statement — far enough to see the filters, not so
       far that the next query's clauses count for this one. */
    const statement = chain.split(';')[0];
    assert.match(
      statement,
      /\.eq\('user_id', target\)/,
      `push_subscriptions query ${i + 1} is not scoped to a single user_id`,
    );
  }
});

test('a dead endpoint is deleted, and only on 404 or 410', () => {
  /* Exact statuses, never a range. A 429 or a 503 is the vendor having a bad
     day; deleting on those would silently unsubscribe a member who did
     nothing wrong. */
  assert.match(
    source,
    /statusCode === 404 \|\| statusCode === 410/,
    'the gone check must name both statuses exactly',
  );
  assert.doesNotMatch(
    source,
    /statusCode >= 4\d\d/,
    'a status range would delete live subscriptions on transient errors',
  );

  /* And the deletion has to actually happen. */
  assert.match(source, /\.delete\(\)/, 'a dead endpoint must be removed');
});

test('the delete is scoped by id AND user_id', () => {
  const deleteChain = source.slice(source.indexOf('.delete()'));
  const statement = deleteChain.split(';')[0];
  assert.match(statement, /\.eq\('id', row\.id\)/);
  assert.match(statement, /\.eq\('user_id', target\)/);
});

test('nothing in the sender throws at the caller', () => {
  /* An approval must stand whether or not the notification lands. Every exit
     is a returned summary; a `throw` here would take down the server action
     it is attached to. */
  const body = source.slice(source.indexOf('export async function sendPushNotification'));
  assert.doesNotMatch(body, /\bthrow\b/, 'sendPushNotification must never throw');
});

test('a missing key pair is a skip, not a crash', () => {
  /* The app is expected to run before the VAPID keys are set — the toggle
     already says so. Configuring at import time would take down every route
     that transitively imports this module. */
  assert.match(source, /reason: 'vapid-unset'/);
  assert.match(source, /reason: 'service-role-unset'/);
  assert.doesNotMatch(
    source.split('export function pushAvailable')[0],
    /^webpush\.setVapidDetails/m,
    'VAPID must be configured lazily, not at module scope',
  );
});

test('one dead device cannot stop the others ringing', () => {
  assert.match(source, /Promise\.allSettled/);
});

/*
 * The approval hooks. Same reasoning: what matters is that both paths that
 * admit a member call the notifier, and that the admin path can tell an
 * approval from a transfer between chapters.
 */
test('both approval paths notify', () => {
  const lead = readFileSync(
    new URL('../src/app/(shell)/club/applications/actions.js', import.meta.url), 'utf8',
  );
  const admin = readFileSync(
    new URL('../src/app/hub/admin/users/actions.js', import.meta.url), 'utf8',
  );

  assert.match(lead, /notifyMembershipApproved/, 'the lead queue must notify on approve');
  assert.match(admin, /notifyMembershipApproved/, 'admin placement must notify');
});

test('the admin path does not call a chapter transfer an approval', () => {
  const admin = readFileSync(
    new URL('../src/app/hub/admin/users/actions.js', import.meta.url), 'utf8',
  );
  /* Somebody moved between chapters already had an active membership, and must
     not be told their account was approved. */
  assert.match(admin, /const wasActive = /);
  assert.match(admin, /if \(club && !wasActive\) await notifyMembershipApproved\(id\)/);
});

test('the lead path notifies only on approve', () => {
  const lead = readFileSync(
    new URL('../src/app/(shell)/club/applications/actions.js', import.meta.url), 'utf8',
  );
  assert.match(lead, /if \(decision === 'approve'\)/);
});

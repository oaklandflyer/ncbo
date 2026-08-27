import test from 'node:test';
import assert from 'node:assert/strict';
import { isSignedOut, getUserResilient } from '../src/lib/supabase/auth.js';

/*
 * The frequent-logouts bug, pinned.
 *
 * `getUser()` answers a null user both when somebody genuinely has no session
 * and when the auth server could not be reached, and the app used to redirect
 * to /login for both. A cold start, a dropped connection, a 502 or a rate
 * limit therefore presented as "you have been signed out" to a member whose
 * session was perfectly valid.
 *
 * Every case below is one of those failures. If any of them starts reporting
 * "signed out" again, the logouts come back.
 */

const user = { id: '00000000-0000-0000-0000-000000000001' };

test('a real user is never signed out', () => {
  assert.equal(isSignedOut(user, null), false);
  /* Even alongside an error: if the auth server returned a user, it answered. */
  assert.equal(isSignedOut(user, { status: 500 }), false);
});

test('no user and no error is a genuine sign-out', () => {
  /* supabase-js short-circuits without a network call when there are no auth
     cookies at all, which is the ordinary signed-out visitor. */
  assert.equal(isSignedOut(null, null), true);
});

test('the auth server rejecting the session is a sign-out', () => {
  for (const status of [400, 401, 403]) {
    assert.equal(isSignedOut(null, { status }), true, `${status} should sign out`);
  }
});

test('a failure to reach the auth server is NOT a sign-out', () => {
  /* This is the whole bug. Each of these produced a null user, and each was
     treated as proof the member had signed out. */
  const transient = [
    { status: 0, message: 'fetch failed' },      // DNS, TLS, aborted socket
    { status: 429, message: 'rate limited' },    // declining to answer
    { status: 500, message: 'internal error' },
    { status: 502, message: 'bad gateway' },
    { status: 503, message: 'service unavailable' },
    { status: 504, message: 'gateway timeout' }, // a cold start
  ];

  for (const error of transient) {
    assert.equal(
      isSignedOut(null, error), false,
      `status ${error.status} must not be read as a sign-out`,
    );
  }
});

/** A stub `supabase.auth` whose `getUser()` replays a scripted list. */
function stubClient(...results) {
  let calls = 0;
  return {
    calls: () => calls,
    auth: {
      async getUser() {
        const result = results[Math.min(calls, results.length - 1)];
        calls += 1;
        if (result instanceof Error) throw result;
        return result;
      },
    },
  };
}

const NO_DELAY = { delayMs: 0 };

test('a transient failure is retried, and a recovery counts as signed in', async () => {
  const client = stubClient(
    { data: { user: null }, error: { status: 503 } },
    { data: { user }, error: null },
  );

  const result = await getUserResilient(client, NO_DELAY);

  assert.equal(client.calls(), 2, 'the first failure must be retried');
  assert.deepEqual(result.user, user);
  assert.equal(result.unavailable, false);
});

test('two transient failures report unavailable, never signed out', async () => {
  const client = stubClient({ data: { user: null }, error: { status: 500 } });

  const result = await getUserResilient(client, NO_DELAY);

  assert.equal(result.user, null);
  assert.equal(result.unavailable, true, 'the caller must not redirect to /login on this');
});

test('a thrown fetch is transient, not a sign-out', async () => {
  /* supabase-js calls this an AuthRetryableFetchError, which is the library
     agreeing with the classification above. */
  const client = stubClient(new Error('fetch failed'));

  const result = await getUserResilient(client, NO_DELAY);

  assert.equal(result.unavailable, true);
});

test('a genuine sign-out is not retried', async () => {
  /* Retrying a definite answer would double every signed-out request's
     latency for nothing. */
  const client = stubClient({ data: { user: null }, error: null });

  const result = await getUserResilient(client, NO_DELAY);

  assert.equal(client.calls(), 1, 'a clean "no session" is already the answer');
  assert.equal(result.unavailable, false);
  assert.equal(result.user, null);
});

test('the auth server rejecting the token is not retried either', async () => {
  const client = stubClient({ data: { user: null }, error: { status: 401 } });

  const result = await getUserResilient(client, NO_DELAY);

  assert.equal(client.calls(), 1);
  assert.equal(result.unavailable, false);
});

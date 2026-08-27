import 'server-only';
import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Sending a push notification. Phase 2 of native push; phase 1 collected the
 * subscriptions this reads.
 *
 * ── Why this holds the service role ─────────────────────────────────────────
 *
 * `push_subscriptions` is protected by RLS that lets an account touch its own
 * rows and nobody else's. That is correct for the toggle, and useless here: a
 * lead approving an applicant needs to notify *the applicant*, and their
 * session cannot read that person's rows by design. The service role bypasses
 * RLS, which is exactly the capability required and exactly the one worth
 * being careful with.
 *
 * So the containment is the same four rules `@/lib/supabase/admin` documents,
 * plus one of this module's own:
 *
 *   **Every read and delete in here is scoped to one `user_id`, explicitly.**
 *   RLS is not doing that scoping any more — this file is. `.eq('user_id', …)`
 *   on every query is not defensive habit, it is the whole boundary. A query
 *   here that forgets it reads the entire table.
 *
 * `import 'server-only'` means a client component that reaches this module
 * fails the build rather than shipping the private key to a browser.
 *
 * ── Why nothing here throws ─────────────────────────────────────────────────
 *
 * A notification is a courtesy attached to something that already happened.
 * The approval is the fact; the push is a message about it. If the push fails
 * — keys unset, vendor down, every device stale — the approval must still
 * stand and the lead must still see "Approved." So every path returns a
 * summary and the caller is free to ignore it. Nothing in here can take down
 * the action it is attached to.
 */

/**
 * Configure `web-push` once per process, and report whether it can send.
 *
 * Lazy rather than at import: a module that throws at import time takes down
 * every route that transitively imports it, and "the VAPID keys are not set
 * yet" is a deployment state, not a crash. The app is expected to run without
 * them — the toggle already says so.
 */
let configured = null;

function ensureConfigured() {
  if (configured !== null) return configured;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    configured = false;
    return configured;
  }

  /* The subject identifies this application to the push service so it has
     somebody to contact if the sends misbehave. A mailto: or https: URL is
     required by the spec; the fallback is the organisation's own address. */
  const subject = process.env.VAPID_SUBJECT || 'mailto:info@thencbo.org';

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (error) {
    /* A malformed key pair — usually half a copy-paste. Logged once, because
       this runs at most once per process. */
    console.error('[ncbo] VAPID keys rejected by web-push', { message: error?.message });
    configured = false;
  }

  return configured;
}

/** Whether sending is possible at all, so a caller can skip the work. */
export function pushAvailable() {
  return ensureConfigured()
    && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * The payload the service worker expects.
 *
 * `public/sw.js` reads `title`, `body`, `url`, `tag` and `data`, and falls back
 * for anything missing — but it can only fall back on what arrives, so the
 * shape is built here rather than trusted from the caller.
 */
function encodePayload(payload) {
  return JSON.stringify({
    title: payload?.title || 'NCBO',
    body: payload?.body || 'Open the app to see what changed.',
    url: payload?.url || '/hub',
    ...(payload?.tag ? { tag: payload.tag } : {}),
    ...(payload?.data ? { data: payload.data } : {}),
  });
}

/**
 * A dead endpoint, as the push services report it.
 *
 * 404 is "no such subscription" and 410 is "Gone" — both mean the browser threw
 * this registration away: the app was uninstalled, site data was cleared, or
 * the vendor expired it. Neither is retryable, and a row that produces one will
 * produce it forever. They are the only two statuses that justify deleting
 * somebody's data, so the check is exact rather than a range: a 429 or a 503 is
 * the vendor having a bad day, and deleting a live subscription over it would
 * silently unsubscribe a member who did nothing.
 */
function isGone(statusCode) {
  return statusCode === 404 || statusCode === 410;
}

/**
 * Notify every device one member has registered.
 *
 * @param {string} userId  whose devices to ring — the only scope on the reads
 *                         and deletes below, since RLS is bypassed here
 * @param {object} payload `{ title, body, url?, tag?, data? }`
 * @returns {Promise<{ok: boolean, sent: number, removed: number, failed: number, reason?: string}>}
 *          Never rejects. `ok: false` with a `reason` when it could not try.
 */
export async function sendPushNotification(userId, payload) {
  const target = typeof userId === 'string' ? userId.trim() : '';
  if (!target) {
    return { ok: false, sent: 0, removed: 0, failed: 0, reason: 'no-user' };
  }

  if (!ensureConfigured()) {
    return { ok: false, sent: 0, removed: 0, failed: 0, reason: 'vapid-unset' };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    /* `createAdminClient` throws when the service-role key is absent. That is
       the right behaviour for permanent deletion, which must not half-run;
       here it is a reason to skip, not to fail the caller. */
    return { ok: false, sent: 0, removed: 0, failed: 0, reason: 'service-role-unset' };
  }

  /* Scoped to this member. The service role would happily return every row in
     the table without it. */
  const { data: subscriptions, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, auth, p256dh')
    .eq('user_id', target);

  if (error) {
    console.error('[ncbo] push: could not read subscriptions', {
      code: error.code, message: error.message,
    });
    return { ok: false, sent: 0, removed: 0, failed: 0, reason: 'read-failed' };
  }

  if (!subscriptions?.length) {
    /* Not a failure. Most members have not turned notifications on, and that
       is the ordinary case rather than something to log about. */
    return { ok: true, sent: 0, removed: 0, failed: 0 };
  }

  const body = encodePayload(payload);

  /* `allSettled`, so one dead device cannot stop the others from ringing. */
  const results = await Promise.allSettled(subscriptions.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { auth: row.auth, p256dh: row.p256dh } },
        body,
      );
      return { status: 'sent' };
    } catch (err) {
      const statusCode = err?.statusCode;

      if (isGone(statusCode)) {
        /* Delete by id AND user_id. The id alone would be enough, and the
           second clause is here because this client bypasses RLS: it keeps the
           blast radius of a wrong id inside this member's own rows. */
        const { error: deleteError } = await admin
          .from('push_subscriptions')
          .delete()
          .eq('id', row.id)
          .eq('user_id', target);

        if (deleteError) {
          console.error('[ncbo] push: could not delete a dead subscription', {
            code: deleteError.code, message: deleteError.message,
          });
          return { status: 'failed' };
        }
        return { status: 'removed' };
      }

      /* Everything else stays. The endpoint is not proven dead, and a member
         who is simply offline must not be unsubscribed. */
      console.error('[ncbo] push: send failed', {
        statusCode: statusCode || null,
        message: err?.message,
      });
      return { status: 'failed' };
    }
  }));

  const tally = { sent: 0, removed: 0, failed: 0 };
  for (const result of results) {
    /* `allSettled` only rejects if the mapper itself threw, which it cannot —
       every path above returns. Counted as failed rather than assumed away. */
    const status = result.status === 'fulfilled' ? result.value.status : 'failed';
    tally[status] += 1;
  }

  return { ok: true, ...tally };
}

/**
 * The notification a member gets when they are placed into a chapter.
 *
 * Built here rather than at each call site because two different actions
 * approve people — a lead deciding an application, and an admin placing
 * somebody directly — and the member should not be able to tell which one
 * happened from the wording.
 *
 * `tag` collapses the two: if both paths somehow fire, the member sees one
 * notification rather than two saying the same thing.
 */
export async function notifyMembershipApproved(userId) {
  return sendPushNotification(userId, {
    title: 'NCBO: Account Approved',
    body: 'You have been officially placed into your chapter. Tap to open the Hub.',
    url: '/hub',
    tag: 'membership-approved',
  });
}

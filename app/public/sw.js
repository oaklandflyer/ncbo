/**
 * The service worker. It exists for one thing: receiving push.
 *
 * Deliberately no `fetch` handler. A worker that intercepts requests is an
 * offline cache, and an offline cache serves stale HTML to a signed-in member
 * whose session has since changed — a whole class of "it showed me somebody
 * else's chapter" bugs, in exchange for nothing this app needs today. Push
 * delivery does not require one.
 *
 * `skipWaiting` and `clients.claim` so a member who reloads gets the new
 * worker immediately rather than after every tab is closed. The alternative is
 * shipping a fix to a push handler and waiting days for devices to pick it up.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const FALLBACK = {
  title: 'NCBO',
  body: 'Open the app to see what changed.',
  url: '/hub',
};

/**
 * Read the payload without ever letting a bad one swallow the notification.
 *
 * A push whose body is not the JSON this app sends — a malformed send, an
 * older sender, a vendor test ping — must still show *something*. Chrome
 * counts a push event that resolves without a notification as an abuse of the
 * permission, and enough of them revoke it.
 */
function payloadOf(event) {
  if (!event.data) return FALLBACK;

  try {
    const data = event.data.json();
    return {
      title: data.title || FALLBACK.title,
      body: data.body || FALLBACK.body,
      url: data.url || FALLBACK.url,
      tag: data.tag,
      renotify: Boolean(data.tag) && data.renotify !== false,
      data: data.data || {},
    };
  } catch {
    /* Not JSON. Show it as text rather than dropping it. */
    let text = '';
    try { text = event.data.text(); } catch { text = ''; }
    return { ...FALLBACK, body: text || FALLBACK.body };
  }
}

self.addEventListener('push', (event) => {
  const payload = payloadOf(event);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/brand/ncbo-seal.png',
      badge: '/brand/ncbo-seal.png',
      /* The path the tap opens, carried on the notification itself: the click
         handler below runs in a fresh worker with no memory of this event. */
      data: { url: payload.url, ...payload.data },
      /* A tag collapses repeats of the same subject — three results verified
         at one chapter is one notification, not three. */
      tag: payload.tag,
      renotify: payload.renotify,
    }),
  );
});

/**
 * Tapping one.
 *
 * Focus a tab that is already open on this origin and navigate it, rather than
 * opening a second copy of an installed PWA beside the first. `openWindow` is
 * the fallback for a cold start.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = event.notification.data?.url || FALLBACK.url;

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of all) {
      if ('focus' in client) {
        if ('navigate' in client) {
          try {
            await client.navigate(target);
          } catch {
            /* Cross-origin or a client that refuses navigation: focusing it is
               still better than a second window. */
          }
        }
        return client.focus();
      }
    }

    return self.clients.openWindow(target);
  })());
});

/**
 * The vendor renewed this device's subscription and the old endpoint is dead.
 *
 * Nothing can be saved from here — the worker has no session and cannot reach
 * a server action — so the new subscription is created and any open tab is
 * told, and the page persists it. If no tab is open the member's next visit
 * re-subscribes through the toggle's own check.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const old = event.oldSubscription || await self.registration.pushManager.getSubscription();
    const key = event.newSubscription?.options?.applicationServerKey
      || old?.options?.applicationServerKey;
    if (!key) return;

    const fresh = event.newSubscription || await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });

    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      client.postMessage({
        type: 'push-subscription-changed',
        subscription: fresh.toJSON(),
        oldEndpoint: old?.endpoint || null,
      });
    }
  })());
});

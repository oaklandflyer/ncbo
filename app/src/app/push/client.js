/**
 * The browser half of push, kept out of the component.
 *
 * Every function here is defensive about the same thing: this API is missing
 * or half-present on a great many real devices. iOS has it only for a PWA
 * added to the home screen, Safari in a normal tab has `Notification` but no
 * `PushManager`, and a browser in private mode can have both and refuse to
 * register a worker. `supportsPush()` is what the UI asks before drawing
 * anything, so nobody is offered a switch that cannot work.
 */

/** The VAPID public key, inlined at build time. Absent until it is set. */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export function supportsPush() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/**
 * base64url → Uint8Array.
 *
 * `applicationServerKey` takes bytes. Handing it the string works in Chrome
 * and throws in Firefox, which is exactly the kind of difference that ships.
 */
export function urlBase64ToUint8Array(base64) {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Register the worker and wait until it is actually running.
 *
 * `register()` resolves before the worker is active, and subscribing against a
 * registration with no active worker fails. `navigator.serviceWorker.ready` is
 * the wait that everybody leaves out and then debugs for an afternoon.
 */
export async function registerWorker() {
  if (!supportsPush()) return null;
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

/** This device's existing subscription, or null. Never prompts. */
export async function currentSubscription() {
  if (!supportsPush()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/**
 * Ask, then subscribe.
 *
 * The permission prompt comes first and on purpose: subscribing triggers it
 * implicitly, and a member who dismisses that prompt leaves a half-finished
 * state the toggle then has to guess about. Asking explicitly gives one of
 * three answers to act on.
 *
 * `userVisibleOnly: true` is not optional — Chrome refuses any other value.
 * It is a promise that every push shows a notification, which is what the
 * service worker's fallback payload exists to keep.
 */
export async function subscribeThisDevice() {
  if (!supportsPush()) return { error: 'This browser cannot receive push notifications.' };
  if (!VAPID_PUBLIC_KEY) {
    return { error: 'Notifications are not configured yet. An admin needs to set the VAPID keys.' };
  }

  const permission = await Notification.requestPermission();
  if (permission === 'denied') {
    /* Denied is sticky: the browser will not ask again, and no amount of
       retrying from here changes it. Say where the setting is instead. */
    return { error: 'Notifications are blocked for this site. Turn them back on in your browser settings, then try again.' };
  }
  if (permission !== 'granted') return { error: 'Notifications stay off until you allow them.' };

  const registration = await registerWorker();
  if (!registration) return { error: 'This browser cannot receive push notifications.' };

  /* An existing subscription may have been made with a different VAPID key —
     after a key rotation, say — and cannot be reused. Recreating it is the
     only way back, and it is invisible to the member. */
  const existing = await registration.pushManager.getSubscription();
  if (existing) await existing.unsubscribe();

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  return { subscription: subscription.toJSON() };
}

/** Tell the browser to stop, and report the endpoint that was dropped. */
export async function unsubscribeThisDevice() {
  const subscription = await currentSubscription();
  if (!subscription) return { endpoint: null };

  const { endpoint } = subscription;
  await subscription.unsubscribe();
  return { endpoint };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeToPush, unsubscribeFromPush } from './actions';
import {
  supportsPush, currentSubscription, subscribeThisDevice, unsubscribeThisDevice,
  VAPID_PUBLIC_KEY,
} from './client';
import { fineprint } from '@/app/ui';

/**
 * Push notifications, as one switch.
 *
 * Per *device*, and the copy says so: a member with a phone and a laptop turns
 * this on twice, because a subscription belongs to a browser rather than to an
 * account. Getting that wrong is how somebody concludes the toggle is broken
 * when their laptop stays quiet.
 *
 * The truth about whether this device is on lives in the browser's
 * `pushManager`, never in React state or in the database — a row can outlive
 * the subscription it describes (cleared site data, a reinstalled app), and a
 * switch drawn from the row would then be on for a device that will never
 * ring. So the state is read from the browser on mount and after every change.
 */
export default function PushToggle({ className = '' }) {
  const [state, setState] = useState('checking');   // checking · off · on · unsupported
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const settle = useCallback((next, note = null) => {
    if (!alive.current) return;
    setState(next);
    setMessage(note);
    setBusy(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!supportsPush()) {
        if (!cancelled) setState('unsupported');
        return;
      }
      try {
        const sub = await currentSubscription();
        /* Blocked at the browser level counts as off, not as on-with-an-error:
           a subscription can survive a permission the member later revoked. */
        const on = Boolean(sub) && Notification.permission === 'granted';
        if (!cancelled) setState(on ? 'on' : 'off');
      } catch {
        if (!cancelled) setState('off');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  /* The worker's `pushsubscriptionchange`: the vendor renewed this device and
     the old endpoint is dead. The worker cannot save the new one — it has no
     session — so it hands it to whichever tab is open, and that is here. */
  useEffect(() => {
    if (!supportsPush()) return undefined;

    const onMessage = async (event) => {
      if (event.data?.type !== 'push-subscription-changed') return;
      const { subscription, oldEndpoint } = event.data;
      if (oldEndpoint) await unsubscribeFromPush(oldEndpoint);
      const saved = await subscribeToPush(subscription);
      if (saved.ok && alive.current) setState('on');
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);

    try {
      const result = await subscribeThisDevice();
      if (result.error) return settle('off', result.error);

      const saved = await subscribeToPush(result.subscription);
      if (saved.error) {
        /* The row did not save, so nothing will ever send to this endpoint.
           Leaving the browser subscribed would be a device that looks on and
           is not. Undo it. */
        await unsubscribeThisDevice();
        return settle('off', saved.error);
      }

      return settle('on', 'This device will get notifications.');
    } catch (err) {
      console.error('[ncbo] push subscribe failed', err);
      return settle('off', 'Something went wrong turning notifications on.');
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);

    try {
      const { endpoint } = await unsubscribeThisDevice();
      /* The browser first, the row second. In the other order a failed delete
         leaves a device that is still subscribed and still ringing. */
      if (endpoint) {
        const removed = await unsubscribeFromPush(endpoint);
        if (removed.error) return settle('off', removed.error);
      }
      return settle('off', 'Notifications are off for this device.');
    } catch (err) {
      console.error('[ncbo] push unsubscribe failed', err);
      return settle('on', 'Something went wrong turning notifications off.');
    }
  }

  const on = state === 'on';
  const unavailable = state === 'unsupported' || !VAPID_PUBLIC_KEY;

  return (
    <div className={className}>
      <p className="pb-2 font-display text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-meta">
        Push notifications
      </p>

      <div className="flex items-center justify-between gap-4 rounded-[8px] border border-edge bg-raised/60 px-4 py-3">
        <span className="min-w-0">
          <span className="block text-[0.95rem] text-body">
            {unavailable ? 'Not available here' : 'On this device'}
          </span>
          <span className={`mt-1 block ${fineprint}`}>{describe(state, unavailable)}</span>
        </span>

        {/* A real checkbox under a drawn switch: it is a checkbox to a screen
            reader and to the keyboard, and `sr-only` rather than `hidden`,
            which would take it out of the tab order entirely. */}
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={on}
            disabled={busy || unavailable || state === 'checking'}
            onChange={() => (on ? turnOff() : turnOn())}
          />
          <span
            aria-hidden
            className={`h-[26px] w-[46px] rounded-full border border-edge transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-light ${
              on ? 'bg-brand' : 'bg-edge/60'
            } ${busy || unavailable ? 'opacity-60' : ''}`}
          />
          <span
            aria-hidden
            className={`pointer-events-none absolute top-[3px] h-[20px] w-[20px] rounded-full bg-surface shadow-brand-sm transition-all ${
              on ? 'left-[23px]' : 'left-[3px]'
            }`}
          />
        </label>
      </div>

      {message && (
        <p role="status" className={`mt-2 ${fineprint}`}>{message}</p>
      )}
    </div>
  );
}

function describe(state, unavailable) {
  if (unavailable) {
    return 'This browser cannot receive push. On an iPhone, add NCBO to your home screen first.';
  }
  if (state === 'checking') return 'Checking this device…';
  if (state === 'on') return 'Each device is separate — turn it on again on your other ones.';
  return 'Get told when your results are verified or your application is decided.';
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { btnPrimary, btnGhost, btnSmall, fineprint } from '@/app/ui';

/**
 * Share the card.
 *
 * Two things here are the whole reason this component is not three lines:
 *
 *  1. **The blob is prefetched on mount.** WebKit only honours
 *     `navigator.share()` inside the same turn of the event loop as the user's
 *     tap. Fetching the image in the click handler and awaiting it puts the
 *     share call a microtask later, and Safari throws `NotAllowedError`. So
 *     the bytes are already in hand before the button is pressable, and the
 *     handler itself does no awaiting before calling share.
 *
 *  2. **There is no hidden canvas anywhere.** The card is rendered on the Edge
 *     by @vercel/og from the same data the page reads. A client-side
 *     html-to-image pass would produce a different image per browser, need the
 *     fonts to have loaded, and silently emit a blank PNG on the phones least
 *     able to say so.
 */
export default function ShareButton({ token, athlete, show }) {
  const fileRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState('');

  const imageUrl = `/share/${token}/opengraph-image`;
  const pageUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/share/${token}`;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(imageUrl);
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        fileRef.current = new File([blob], `${show || 'result'}.png`, { type: 'image/png' });
        setReady(true);
      } catch {
        /* Sharing the link still works without the file, so a failed prefetch
           quietly degrades rather than disabling the button. */
      }
    })();

    return () => { cancelled = true; };
  }, [imageUrl, show]);

  function onShare() {
    const file = fileRef.current;

    /* No await before this call, on any path. That is the constraint. */
    if (file && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: `${athlete} · ${show}` })
        .catch(() => { /* the user dismissed the sheet; not an error */ });
      return;
    }

    if (navigator.share) {
      navigator.share({ title: `${athlete} · ${show}`, url: pageUrl })
        .catch(() => {});
      return;
    }

    navigator.clipboard?.writeText(pageUrl)
      .then(() => { setNote('Link copied.'); setTimeout(() => setNote(''), 2000); })
      .catch(() => setNote('Copy this page&rsquo;s address to share it.'));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onShare} className={btnPrimary}>
          Share this result
        </button>
        <a href={imageUrl} target="_blank" rel="noopener noreferrer" className={`${btnGhost} ${btnSmall}`}>
          View the card
        </a>
      </div>
      <p className={`mt-2 ${fineprint}`} aria-live="polite">
        {note || (ready ? 'Shares as an image.' : 'Preparing the image…')}
      </p>
    </div>
  );
}

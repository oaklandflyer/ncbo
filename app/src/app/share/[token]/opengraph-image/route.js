import { ImageResponse } from '@vercel/og';
import { loadShareCard, shareCacheControl, shareETag } from '@/lib/share';
import { monogram } from '@/lib/monogram';

export const runtime = 'edge';

/* 9:16. This is a story card: it is opened on a phone, in Instagram, held
   vertically. A 1200x630 link preview would letterbox into a stripe. */
const WIDTH = 1080;
const HEIGHT = 1920;

const INK = '#14181F';
const PAPER = '#F7F5F1';
const BRAND = '#2F5FA8';
const WARN = '#B26A1F';

/* The seal, bundled with the function rather than fetched over the network at
   render time. Two reasons it is the PNG and not the SVG that ships here:
   Satori does not rasterise SVG from an <img>, and a card that has to reach
   the network for its own watermark renders without one the first time a DNS
   lookup is slow.

   `fetch(new URL(..., import.meta.url))` is the shape the bundler recognises:
   it traces the file into the Edge bundle at build time, so this resolves
   inside the deployment and never leaves it. The path reaches back into
   `public/` on purpose, so the PWA manifest and this share the one file.

   Satori wants a string, so the bytes become a data URI once, at module scope,
   and every render after the first reuses it. */
const sealDataUri = fetch(new URL('../../../../../public/brand/ncbo-seal.png', import.meta.url))
  .then((r) => r.arrayBuffer())
  .then(toPngDataUri)
  .catch(() => null);

function toPngDataUri(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  /* In chunks: String.fromCharCode spread over 30k arguments at once
     overflows the call stack, and this file is 30k bytes. */
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

/* One second, and then the card renders with a monogram instead.
   A club logo is decoration; a share card that hangs is not a share card.
   AbortSignal.timeout is available on the Edge runtime. */
const LOGO_TIMEOUT_MS = 1000;

async function loadClubLogo(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(LOGO_TIMEOUT_MS) });
    /* A 404 is the ordinary case here, not an exception: the row still points
       at an object somebody deleted out from under it. */
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    return bytes.byteLength ? toPngDataUri(bytes) : null;
  } catch {
    return null;
  }
}

export async function GET(request, { params }) {
  const { token } = await params;
  const card = await loadShareCard(token);

  /* A returned entry has no card. 404 rather than a placeholder, and no-store
     so a CDN never keeps the gap around after the athlete fixes and resubmits. */
  if (!card) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' },
    });
  }

  const pending = card.status === 'pending';

  /* Both in parallel, and neither can fail the render: the seal falls back to
     nothing and the club logo falls back to its monogram. */
  const [seal, clubLogo] = await Promise.all([sealDataUri, loadClubLogo(card.club_logo)]);

  const etag = shareETag(card);
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': shareCacheControl(card.status, !!card.club_logo),
      },
    });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: PAPER, color: INK, padding: '110px 90px',
          fontFamily: 'sans-serif', position: 'relative',
        }}
      >
        {/* NCBO's own mark, fixed in the top corner and out of the flow, so it
            costs the layout below it nothing. Faint: it says who vouches for
            this card, it is not competing with the placing. */}
        {seal ? (
          <img
            src={seal}
            width={150}
            height={150}
            style={{
              position: 'absolute', top: 70, right: 70,
              width: 150, height: 150, opacity: 0.16,
            }}
          />
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* The chapter line, with the chapter's own mark leading it. The box
              is 84px whether or not there is anything in it, so the headline
              below sits in the same place on every card. */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {clubLogo ? (
              <img
                src={clubLogo}
                width={84}
                height={84}
                style={{ width: 84, height: 84, objectFit: 'contain' }}
              />
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 84, height: 84, borderRadius: 16,
                background: 'rgba(47,95,168,0.12)', color: BRAND,
                fontSize: 36, fontWeight: 800, letterSpacing: 2,
              }}>
                {monogram({ chapter: card.chapter, club_name: card.club_name })}
              </div>
            )}
            <div style={{
              display: 'flex', marginLeft: 26, fontSize: 34, letterSpacing: 8,
              color: BRAND, fontWeight: 700,
            }}>
              {String(card.chapter || 'NCBO').toUpperCase()}
            </div>
          </div>

          <div style={{ display: 'flex', marginTop: 28, fontSize: 96, fontWeight: 800, lineHeight: 1.02 }}>
            {card.athlete_name}
          </div>

          <div style={{ display: 'flex', marginTop: 60, height: 6, width: 220, background: INK }} />

          {/* The placing is the picture. Everything else is a caption. */}
          <div style={{ display: 'flex', marginTop: 70, fontSize: 260, fontWeight: 800, lineHeight: 0.9, color: BRAND }}>
            {card.placing}
          </div>

          <div style={{ display: 'flex', marginTop: 40, fontSize: 46, fontWeight: 600 }}>
            {card.division}
          </div>
          {card.class ? (
            <div style={{ display: 'flex', marginTop: 12, fontSize: 38, color: '#5A6472' }}>
              {card.class}
            </div>
          ) : null}
          {card.won_overall ? (
            <div style={{
              display: 'flex', marginTop: 28, alignSelf: 'flex-start',
              background: INK, color: PAPER, padding: '14px 28px',
              fontSize: 34, fontWeight: 700, letterSpacing: 4,
            }}>
              OVERALL WINNER
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 700 }}>{card.show_name}</div>
          <div style={{ display: 'flex', marginTop: 14, fontSize: 34, color: '#5A6472' }}>
            {card.federation} · {formatDate(card.date)}
          </div>
        </div>

        {/*
          A full-width band across the lower third, not a diagonal corner
          ribbon. A corner ribbon is the first thing a crop tool removes, and
          this claim has to survive being screenshotted and re-cropped: the
          card goes out before a lead has checked it, so "not verified yet" has
          to travel with the image.
        */}
        {pending ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 60, marginLeft: -90, marginRight: -90,
            background: WARN, color: '#FFFFFF',
            padding: '34px 0', fontSize: 40, fontWeight: 800, letterSpacing: 10,
          }}>
            PENDING VERIFICATION
          </div>
        ) : (
          <div style={{ display: 'flex', marginTop: 60, fontSize: 30, letterSpacing: 6, color: '#5A6472' }}>
            VERIFIED · NCBO
          </div>
        )}
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        'Cache-Control': shareCacheControl(card.status, !!card.club_logo),
        ETag: etag,
      },
    },
  );
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(`${value}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

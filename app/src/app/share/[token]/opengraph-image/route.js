import { ImageResponse } from '@vercel/og';
import { loadShareCard, shareCacheControl } from '@/lib/share';

export const runtime = 'edge';

/* 9:16. This is a story card: it is opened on a phone, in Instagram, held
   vertically. A 1200x630 link preview would letterbox into a stripe. */
const WIDTH = 1080;
const HEIGHT = 1920;

const INK = '#14181F';
const PAPER = '#F7F5F1';
const BRAND = '#2F5FA8';
const WARN = '#B26A1F';

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

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: PAPER, color: INK, padding: '110px 90px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 34, letterSpacing: 8, color: BRAND, fontWeight: 700 }}>
            {String(card.chapter || 'NCBO').toUpperCase()}
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
      headers: { 'Cache-Control': shareCacheControl(card.status) },
    },
  );
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(`${value}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

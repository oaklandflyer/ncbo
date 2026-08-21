import { ORG_SHORT, ORG_NAME, SUBTITLE } from '@/lib/copy';

/**
 * The PWA manifest, generated rather than checked in as JSON so the name and
 * description come from the same copy module as everything else.
 *
 * `display: standalone` is what makes an installed copy open without browser
 * chrome; `start_url: /hub` because somebody who installed this is a member —
 * the sign-in page is a door, not a destination.
 */
export default function manifest() {
  return {
    name: `${ORG_NAME} Member Hub`,
    short_name: ORG_SHORT,
    description: SUBTITLE,
    start_url: '/hub',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F4F8FD',
    theme_color: '#2F5FA8',
    icons: [
      { src: '/ncbo-crest.webp', sizes: '192x192', type: 'image/webp', purpose: 'any' },
      { src: '/ncbo-crest.webp', sizes: '512x512', type: 'image/webp', purpose: 'any' },
    ],
  };
}

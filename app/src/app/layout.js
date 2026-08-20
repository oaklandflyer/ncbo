import './globals.css';
import { ORG_SHORT, ORG_NAME, TAGLINE, META_DESCRIPTION } from '@/lib/copy';

/**
 * `robots: noindex` stays. This is the members' hub, not a marketing site —
 * the OG tags below are for the link previews members generate when they share
 * a sign-in link with each other, not for search.
 */
export const metadata = {
  title: { default: `${ORG_SHORT} — ${TAGLINE}`, template: `%s · ${ORG_SHORT}` },
  description: META_DESCRIPTION,
  applicationName: `${ORG_SHORT} Member Hub`,
  robots: { index: false, follow: false },
  openGraph: {
    title: `${ORG_SHORT} — ${TAGLINE}`,
    description: META_DESCRIPTION,
    siteName: ORG_NAME,
    type: 'website',
  },
  twitter: { card: 'summary', title: `${ORG_SHORT} — ${TAGLINE}`, description: META_DESCRIPTION },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

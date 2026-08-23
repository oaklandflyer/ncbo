import './globals.css';
import ThemeScript from './theme/script';
import { ThemeProvider } from './theme/provider';
import { ORG_SHORT, ORG_NAME, TAGLINE, META_DESCRIPTION } from '@/lib/copy';

/**
 * `robots: noindex` stays. This is the members' hub, not a marketing site —
 * the OG tags below are for the link previews members generate when they share
 * a sign-in link with each other, not for search.
 */
export const metadata = {
  title: { default: `${ORG_SHORT} · ${TAGLINE}`, template: `%s · ${ORG_SHORT}` },
  description: META_DESCRIPTION,
  applicationName: `${ORG_SHORT} Member Hub`,
  robots: { index: false, follow: false },
  openGraph: {
    title: `${ORG_SHORT} · ${TAGLINE}`,
    description: META_DESCRIPTION,
    siteName: ORG_NAME,
    type: 'website',
  },
  twitter: { card: 'summary', title: `${ORG_SHORT} · ${TAGLINE}`, description: META_DESCRIPTION },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: ORG_SHORT,
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/brand/ncbo-seal.svg',
    apple: '/brand/ncbo-seal.png',
  },
};

/** The browser chrome picks this up — steel, matching the nav. */
export const viewport = {
  themeColor: '#2F5FA8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    /*
     * `suppressHydrationWarning` on <html> and nowhere else.
     *
     * `ThemeScript` writes a class and a colour-scheme onto this element
     * before React hydrates, so the server's `<html lang="en">` and the DOM
     * React finds are genuinely different — by design. Suppressing it here
     * covers this element's own attributes only; a real mismatch anywhere in
     * the tree below still reports itself.
     */
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

import './globals.css';

export const metadata = {
  title: 'NCBO Member App',
  description: 'Members-only hub for the National Collegiate Bodybuilding Organization.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

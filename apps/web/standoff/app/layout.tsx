import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { siteUrl } from '@/lib/site-url';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'StandoffDuel - the webcam western duel',
  description:
    'Two players, two webcams, one draw. Stare your opponent down and be the fastest gun on the internet.',
  openGraph: {
    title: 'StandoffDuel',
    description: 'The fastest draw on the internet wins. Duel a friend over webcam.',
    type: 'website',
    siteName: 'StandoffDuel',
    // og:image is supplied by the app/opengraph-image route.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StandoffDuel',
    description: 'The fastest draw on the internet wins. Duel a friend over webcam.',
  },
};

export const viewport: Viewport = {
  themeColor: '#0c0a09',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Rye&family=Special+Elite&family=Oswald:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
        <Analytics />
      </body>
    </html>
  );
}

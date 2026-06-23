import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { siteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'StandoffDuel, the webcam western duel',
  description:
    'Two players, two webcams, one draw. Stare your opponent down and be the fastest gun on the internet.',
  openGraph: {
    title: 'StandoffDuel',
    description: 'The fastest draw on the internet wins. Duel a friend over webcam.',
    type: 'website',
    siteName: 'StandoffDuel',
    // og:image is supplied by the app/standoff/opengraph-image route.
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

// Segment layout for the standoff experiment. The western look lives entirely
// under `.standoff` (defined in globals.css) so it never touches the landing.
// Fonts are loaded here; Next hoists these <link> tags into <head>.
export default function StandoffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Rye&family=Special+Elite&family=Oswald:wght@500;700&display=swap"
        rel="stylesheet"
      />
      <div className="standoff">
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </div>
      <Analytics />
    </>
  );
}

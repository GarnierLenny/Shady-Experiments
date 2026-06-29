import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { siteUrl } from '@/lib/site-url';
import './whisper-skin.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'Whispering Hacker, the broken-walkie-talkie co-op',
  description:
    'Two friends, one terminal. The hacker has nothing; the operator has the manual. You can only talk by voice — and the line keeps getting worse.',
  openGraph: {
    title: 'Whispering Hacker',
    description:
      'The hacker types, the operator reads the manual, and you can only talk by voice. Then the line falls apart.',
    type: 'website',
    siteName: 'Whispering Hacker',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Whispering Hacker',
    description:
      'Co-op hacking over a deliberately terrible voice line. Bring a friend and a sense of humor.',
  },
};

export const viewport: Viewport = {
  themeColor: '#060a07',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

// Segment layout for the Whispering Hacker experiment. The CRT terminal look
// lives entirely under `.whisper` (defined in globals.css) so it never touches
// the landing. Fonts are loaded here; Next hoists these <link> tags into <head>.
export default function WhisperingHackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Share+Tech+Mono&family=VT323&display=swap"
        rel="stylesheet"
      />
      <div className="wh-root">{children}</div>
      <Analytics />
    </>
  );
}

import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { TrackPageView } from "@/components/TrackPageView";

// Space Grotesk Bold for titles. IBM Plex Mono for data, labels and metadata.
// Inter for running body copy (the lobby's subtitle and dossier blurbs).
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShadyExperiments",
  description: "Une collection d'expériences sociales conduites sur l'humanité.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${display.variable} ${mono.variable} ${body.variable}`}
    >
      <body>
        <TrackPageView />
        {children}
      </body>
    </html>
  );
}

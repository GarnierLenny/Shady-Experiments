import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StandoffDuel",
  description: "Real-time 1v1 western webcam duel. First to draw wins.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

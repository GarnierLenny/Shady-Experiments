import type { NextConfig } from "next";

// Multi-Zones: the landing is the root zone. Each experiment is its own Next app
// served under its own path. standoff lives under /standoff — we proxy those
// requests to its zone. Realtime (socket.io / WebRTC) connects straight to the
// central API, so only HTTP is rewritten here.
const STANDOFF_ZONE_URL =
  process.env.STANDOFF_ZONE_URL ?? "http://localhost:3003";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/standoff", destination: `${STANDOFF_ZONE_URL}/standoff` },
        {
          source: "/standoff/:path*",
          destination: `${STANDOFF_ZONE_URL}/standoff/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;

import type { NextConfig } from "next";

// Single Next app: the landing (root) plus every experiment as a route subtree
// (standoff lives under /standoff). No Multi-Zones proxy. Realtime (socket.io /
// WebRTC) connects straight to the central API via NEXT_PUBLIC_SOCKET_URL.
const nextConfig: NextConfig = {
  // No ESLint config shipped; don't let it block production builds.
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      net: false,
      tls: false,
    };
    // simple-peer expects Node globals (Buffer/process) in the browser bundle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webpack = require("webpack");
    config.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ["buffer", "Buffer"],
        process: "process/browser",
      }),
    );
    return config;
  },
};

export default nextConfig;

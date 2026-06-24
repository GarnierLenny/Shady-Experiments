import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Single Next app: the landing (root) plus every experiment as a route subtree
// (standoff lives under /standoff). No Multi-Zones proxy. Realtime (socket.io /
// WebRTC) connects straight to the central API via NEXT_PUBLIC_SOCKET_URL.
const nextConfig: NextConfig = {
  // No ESLint config shipped; don't let it block production builds.
  eslint: { ignoreDuringBuilds: true },
  // Keep Prisma's query engine external (not bundled) in server builds.
  serverExternalPackages: ["@prisma/client"],
  webpack: (config, { isServer }) => {
    // Browser-only shims for simple-peer. MUST NOT touch the server bundle:
    // the `process/browser` shim has an empty `process.versions`, which breaks
    // @sentry/node's nodeVersion check (process.versions.node.match -> crash).
    if (!isServer) {
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
    }
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "shadyexperiments",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});

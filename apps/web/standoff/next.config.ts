import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Multi-Zones: this experiment is mounted under /standoff on the SE domain.
  // basePath rebases routes; assetPrefix makes _next assets load from /standoff.
  basePath: '/standoff',
  assetPrefix: '/standoff',
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
    const webpack = require('webpack');
    config.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
      }),
    );
    return config;
  },
};

export default nextConfig;

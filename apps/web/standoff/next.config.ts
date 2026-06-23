import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Multi-Zones: this experiment is mounted under /standoff on the SE domain.
  // basePath alone rebases both routes AND _next assets under /standoff. Do NOT
  // also set assetPrefix (it double-handles the publicPath and breaks dev chunk
  // loading: "Cannot read properties of undefined (reading 'call')").
  basePath: '/standoff',
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

import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

// The browser talks to /api on the same origin; Next forwards it to the API in dev.
// In production Caddy routes /api directly to the API container.
const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  transpilePackages: ['@tc/core', '@tc/engine', '@tc/api'],
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default config;

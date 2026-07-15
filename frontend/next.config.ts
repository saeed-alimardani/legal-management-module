import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output is for Docker production images only. Using it with
  // `next start` locally breaks static chunk serving for route groups like (app)/[id].
  ...(process.env.DOCKER_BUILD === 'true' ? { output: 'standalone' as const } : {}),
};

export default nextConfig;

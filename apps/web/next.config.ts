import path from 'node:path';
import type { NextConfig } from 'next';

const monorepoRoot = path.join(__dirname, '..', '..');

const config: NextConfig = {
  // @kofc/shared publishes raw TypeScript (its package.json "main" is src/index.ts), so Next compiles it.
  transpilePackages: ['@kofc/shared'],
  // Trace and resolve from the workspace root, where node_modules and the lockfile live.
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
};

export default config;

// Next.js config for Football Factory frontend.
//
// `outputFileTracingRoot` is set explicitly to silence the "inferred
// workspace root" warning on local Windows where the user has a stray
// lockfile at the home directory. On Vercel the root is set via the
// Project Settings → Root Directory (`frontend/`) and this option has
// no negative effect — it just makes the build deterministic.
//
// Reference:
//   https://nextjs.org/docs/app/api-reference/next-config-js/outputFileTracingRoot

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const next_config = {
  // Pin the file-tracing root to this directory so Next.js does not
  // walk upward and pick up unrelated lockfiles (e.g. C:\Users\<user>\package-lock.json).
  outputFileTracingRoot: __dirname,
  reactStrictMode: true,
  // Transpile the in-repo lib/football layer if needed by App Router
  // route handlers. Keeps the dev server aligned with production builds.
  transpilePackages: [],
  experimental: {
    // Reserved for Phase 2 / 9 features (WordPress GraphQL client, ISR).
    typedRoutes: false,
  },
};

export default next_config;

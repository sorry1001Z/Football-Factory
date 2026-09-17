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

// Security headers block applied to every response.
// HSTS: keep production value of 2 years (was set by Vercel default).
// Do NOT add `preload` here — it is difficult to reverse and would
// require every current/future subdomain of ff90.online to be
// HTTPS-compatible. Do NOT add `includeSubDomains` for the same reason
// until every subdomain (e.g. wp.ff90.online, *.ff90.online) is HTTPS
// verified.
// CSP is intentionally NOT set here in report-only mode yet — it lives
// in middleware.ts so we can iterate the policy without rebuilding.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

/** @type {import('next').NextConfig} */
const next_config = {
  // Pin the file-tracing root to this directory so Next.js does not
  // walk upward and pick up unrelated lockfiles (e.g. C:\Users\<user>\package-lock.json).
  outputFileTracingRoot: __dirname,
  reactStrictMode: true,
  // Kill X-Powered-By header leakage (was: "Next.js").
  removePoweredByHeader: true,
  // Transpile the in-repo lib/football layer if needed by App Router
  // route handlers. Keeps the dev server aligned with production builds.
  transpilePackages: [],
  experimental: {
    // Reserved for Phase 2 / 9 features (WordPress GraphQL client, ISR).
    typedRoutes: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default next_config;

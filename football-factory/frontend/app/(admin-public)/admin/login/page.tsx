// Football Factory — /admin/login (public sign-in page).
//
// Lives in the (admin-public) route group so it does NOT inherit the
// auth gate from app/(admin)/layout.tsx. Submits to the existing
// /api/auth/login endpoint, which:
//   - validates JSON body { email, password }
//   - enforces CSRF via Origin / Sec-Fetch-Site (lib/security/csrf.ts)
//   - rate-limits per IP (5 / minute)
//   - sets the ff_session cookie on success
//
// No DB query, no protected data, no auth check on this page itself.

import { LoginForm } from "@/components/admin/login-form";

export const metadata = {
  title: "Sign in · Admin · Football Factory",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  return <LoginForm searchParams={searchParams} />;
}

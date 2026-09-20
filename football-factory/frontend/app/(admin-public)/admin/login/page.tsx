// FF90 — /admin/login (public sign-in page).
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

import Image from "next/image";
import { LoginForm } from "@/components/admin/login-form";
import {
  BRAND_NAME,
  BRAND_LOGO_MARK_PATH,
} from "@/lib/brand";

export const metadata = {
  title: `Sign in · Admin · ${BRAND_NAME}`,
  robots: { index: false, follow: false },
};

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  return (
    <>
      <div
        className="admin-login-logo"
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "24px 0 0",
        }}
      >
        <Image
          src={BRAND_LOGO_MARK_PATH}
          alt={BRAND_NAME}
          height={56}
          width={260}
          priority
        />
      </div>
      <LoginForm searchParams={searchParams} />
    </>
  );
}

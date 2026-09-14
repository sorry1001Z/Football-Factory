// Football Factory — Admin route-group layout (R2 Wave 2C + security gate).
//
// Mounts the admin pages WITHOUT the global Thai-first Header /
// Footer. Admin pages get a minimal admin shell only.
//
// Security gate (added 2026-09-14):
// - Every admin sub-route inside this route group requires an
//   authenticated session with role `admin` OR `editor`.
// - The auth check uses the SAME authority as /api/admin/*:
//     * cookie: ff_session (env-overridable via SESSION_COOKIE_NAME)
//     * HS256 verify via AUTH_SECRET
//     * role allowlist from lib/admin/guard.ts (requireAdminOrEditor)
// - Anonymous or unauthorized requests are redirected to /admin/login.
// - The login page lives in the SIBLING route group (admin-public) so
//   it does NOT inherit this layout; users can always reach sign-in.
//
// No protected DB query or render runs before this gate resolves.

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminOrEditor } from "@/lib/admin/guard";
import type { Session } from "@/lib/auth/contracts";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await cookies();
  const cookieHeader =
    h.getAll().length === 0
      ? null
      : h
          .getAll()
          .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
          .join("; ");

  const syntheticHeaders = new Headers();
  if (cookieHeader) syntheticHeaders.set("cookie", cookieHeader);

  const result = requireAdminOrEditor({
    headers: {
      get(name: string) {
        return syntheticHeaders.get(name);
      },
    },
  });

  if (!result.ok) {
    // 401/403/503 — all funnel to the login page.
    redirect("/admin/login");
  }

  // result.ok === true. Layouts don't pass session down to children;
  // pages that need it can call requireAdminOrEditor again.
  void (result as { session: Session }).session;
  return <div className="admin-shell-root">{children}</div>;
}

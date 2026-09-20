// FF90 — /admin/reset-password?token=<token> (public).
//
// Completes a password reset using the email-delivered token. The
// server route /api/auth/reset-password hashes the token, looks it
// up, applies the new password hash, and returns ok=true. We display
// either the form (if token is present and submittable) or the
// confirmation.

import {
  BRAND_NAME,
  BRAND_LOGO_MARK_PATH,
} from "@/lib/brand";
import { ResetPasswordForm } from "@/components/admin/reset-password-form";

export const metadata = {
  title: `ตั้งรหัสผ่านใหม่ · Admin · ${BRAND_NAME}`,
  robots: { index: false, follow: false },
};

export default function AdminResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <div className="admin-shell admin-shell-root">
      <main className="admin-shell-main" aria-label="Reset password">
        <h1>ตั้งรหัสผ่านใหม่</h1>
        <ResetPasswordForm searchParams={searchParams} />
        <p className="admin-help-text">
          <a className="admin-link" href="/admin/login">
            ← กลับไปหน้าเข้าสู่ระบบ
          </a>
        </p>
      </main>
    </div>
  );
}

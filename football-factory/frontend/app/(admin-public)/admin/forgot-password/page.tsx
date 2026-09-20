// FF90 — /admin/forgot-password (public).
//
// Sends the email with a one-time reset link. Always returns the
// generic UX response so account-existence is not leaked.

import {
  BRAND_NAME,
  BRAND_LOGO_MARK_PATH,
} from "@/lib/brand";
import { ForgotPasswordForm } from "@/components/admin/forgot-password-form";

export const metadata = {
  title: `ลืมรหัสผ่าน · Admin · ${BRAND_NAME}`,
  robots: { index: false, follow: false },
};

export default function AdminForgotPasswordPage() {
  return (
    <div className="admin-shell admin-shell-root">
      <main className="admin-shell-main" aria-label="Forgot password">
        <h1>ลืมรหัสผ่าน</h1>
        <p className="admin-help-text">
          กรอกอีเมลที่ใช้เข้าสู่ระบบ หากอีเมลนี้มีบัญชีอยู่ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
        </p>
        <ForgotPasswordForm />
        <p className="admin-help-text">
          <a className="admin-link" href="/admin/login">
            ← กลับไปหน้าเข้าสู่ระบบ
          </a>
        </p>
      </main>
    </div>
  );
}

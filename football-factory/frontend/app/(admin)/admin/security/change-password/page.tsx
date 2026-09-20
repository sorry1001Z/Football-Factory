// FF90 — /admin/security/change-password (authenticated admin/editor).
//
// Requires an admin or editor session (enforced by the parent
// (admin) layout). Submits to /api/admin/security/change-password.

import {
  BRAND_NAME,
} from "@/lib/brand";
import { ChangePasswordForm } from "@/components/admin/change-password-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: `เปลี่ยนรหัสผ่าน · Admin · ${BRAND_NAME}`,
  robots: { index: false, follow: false },
};

export default function AdminChangePasswordPage() {
  return (
    <section className="admin-section">
      <h1>เปลี่ยนรหัสผ่าน</h1>
      <p className="admin-help-text">
        รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษร
      </p>
      <ChangePasswordForm />
    </section>
  );
}

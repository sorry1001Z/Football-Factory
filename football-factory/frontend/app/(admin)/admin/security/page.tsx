// FF90 — /admin/security (authenticated admin/editor).
//
// Index page for the Security section. Lists the available settings
// (currently: change password). Auth is enforced by the parent
// (admin) layout; this page runs only when an admin/editor session
// cookie has already been validated.

import {
  BRAND_NAME,
} from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata = {
  title: `Security · Admin · ${BRAND_NAME}`,
  robots: { index: false, follow: false },
};

export default function AdminSecurityPage() {
  return (
    <section className="admin-section">
      <h1>Security</h1>
      <ul className="admin-list">
        <li>
          <a href="/admin/security/change-password">เปลี่ยนรหัสผ่าน</a>
          <p className="admin-help-text">
            เปลี่ยนรหัสผ่านที่ใช้เข้าสู่ระบบ Admin ปัจจุบัน ต้องยืนยันรหัสผ่านเดิมก่อน
          </p>
        </li>
      </ul>
    </section>
  );
}

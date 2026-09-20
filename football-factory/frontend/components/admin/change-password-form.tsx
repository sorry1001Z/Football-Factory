"use client";

// FF90 — Change password form (client component).
//
// Authenticated admin/editor. Three inputs: currentPassword,
// newPassword, confirmPassword. POST to
// /api/admin/security/change-password. The route enforces CSRF,
// auth, rate limit, and password policy.

import { useState, useTransition } from "react";

type Outcome = null | "ok" | "wrong_current_password" | "policy_failed" | "rate_limited" | "same_password" | "network" | "validation_failed" | "unknown";

const MESSAGE: Record<NonNullable<Outcome>, string> = {
  ok: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว",
  wrong_current_password: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
  policy_failed: "รหัสผ่านใหม่ไม่เป็นไปตามนโยบาย (อย่างน้อย 12 ตัวอักษร)",
  rate_limited: "มีความพยายามมากเกินไป กรุณารอสักครู่",
  same_password: "รหัสผ่านใหม่ต้องแตกต่างจากรหัสผ่านปัจจุบัน",
  network: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้",
  validation_failed: "ข้อมูลไม่ถูกต้อง",
  unknown: "ไม่สามารถเปลี่ยนรหัสผ่านได้",
};

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<Outcome>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("policy_failed");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/security/change-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        if (res.ok) {
          setError("ok");
          return;
        }
        if (res.status === 429) {
          setError("rate_limited");
          return;
        }
        let code: Outcome = "unknown";
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error === "wrong_current_password") code = "wrong_current_password";
          else if (data.error === "policy_failed") code = "policy_failed";
          else if (data.error === "same_password") code = "same_password";
          else if (data.error === "validation_failed") code = "validation_failed";
        } catch {
          // parse failed — keep "unknown"
        }
        setError(code);
      } catch {
        setError("network");
      }
    });
  }

  return (
    <form
      method="post"
      action="/api/admin/security/change-password"
      onSubmit={onSubmit}
      className="admin-login-form"
    >
      <label>
        <span>รหัสผ่านปัจจุบัน</span>
        <input
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          disabled={pending}
        />
      </label>
      <label>
        <span>รหัสผ่านใหม่ (อย่างน้อย 12 ตัวอักษร)</span>
        <input
          type="password"
          name="newPassword"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={256}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={pending}
        />
      </label>
      <label>
        <span>ยืนยันรหัสผ่านใหม่</span>
        <input
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={256}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={pending}
        />
      </label>
      <button type="submit" className="admin-button" disabled={pending}>
        {pending ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
      </button>
      {error ? (
        <p
          role={error === "ok" ? "status" : "alert"}
          className={error === "ok" ? "admin-success" : "admin-error"}
          aria-live="polite"
          data-testid="change-pw-status"
          data-outcome={error}
        >
          {MESSAGE[error]}
        </p>
      ) : null}
    </form>
  );
}

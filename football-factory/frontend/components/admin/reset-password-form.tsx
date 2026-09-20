"use client";

// FF90 — Reset password form (client component).
//
// Two inputs: newPassword + confirm. POST { token, newPassword } to
// /api/auth/reset-password.

import { use, useState, useTransition } from "react";

export function ResetPasswordForm({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = use(searchParams);
  const token = typeof sp.token === "string" ? sp.token : "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function validate(p: string): string | null {
    if (p.length < 12) return "รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร";
    if (p.length > 256) return "รหัสผ่านยาวเกินไป";
    return null;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const v = validate(newPassword);
    if (v) { setError(v); return; }
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (!token) {
      setError("ไม่พบรหัสลิงก์ตั้งรหัสผ่านใหม่ กรุณาขอลิงก์ใหม่");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ token, newPassword }),
        });
        if (res.ok) {
          setDone(true);
          return;
        }
        if (res.status === 429) {
          setError("มีความพยายามมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง");
          return;
        }
        setError("ไม่สามารถตั้งรหัสผ่านใหม่ได้ ลิงก์อาจหมดอายุหรือถูกใช้แล้ว");
      } catch {
        setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      }
    });
  }

  if (!token) {
    return (
      <p role="alert" className="admin-error" aria-live="polite">
        ไม่พบรหัสลิงก์ตั้งรหัสผ่านใหม่ กรุณาขอลิงก์ใหม่จากหน้าลืมรหัสผ่าน
      </p>
    );
  }

  if (done) {
    return (
      <>
        <p role="status" className="admin-success" aria-live="polite">
          ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่ของคุณ
        </p>
        <p>
          <a className="admin-link" href="/admin/login">
            ไปหน้าเข้าสู่ระบบ
          </a>
        </p>
      </>
    );
  }

  return (
    <form
      method="post"
      action="/api/auth/reset-password"
      onSubmit={onSubmit}
      className="admin-login-form"
    >
      <input type="hidden" name="token" value={token} />
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
        {pending ? "กำลังตั้งรหัสผ่านใหม่..." : "ตั้งรหัสผ่านใหม่"}
      </button>
      {error ? (
        <p role="alert" className="admin-error" aria-live="polite">
          {error}
        </p>
      ) : null}
    </form>
  );
}

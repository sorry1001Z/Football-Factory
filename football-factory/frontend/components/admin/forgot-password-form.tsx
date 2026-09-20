"use client";

// FF90 — Forgot password form (client component).
//
// Submits { email } to POST /api/auth/forgot-password. The server
// always returns the SAME response. We render a generic message
// locally too so the UX is consistent regardless of which branch the
// server took.

import { useState, useTransition } from "react";

const GENERIC_MESSAGE =
  "หากอีเมลนี้มีบัญชีอยู่ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    startTransition(async () => {
      try {
        await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email }),
        });
        // Always generic; we discard the response body's specifics.
      } catch {
        // Swallow network errors — the UI is already generic.
      }
    });
  }

  return (
    <>
      <form
        method="post"
        action="/api/auth/forgot-password"
        onSubmit={onSubmit}
        className="admin-login-form"
      >
        <label>
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </label>
        <button type="submit" className="admin-button" disabled={pending}>
          {pending ? "กำลังส่ง..." : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
        </button>
      </form>
      {submitted ? (
        <p role="status" className="admin-success" aria-live="polite">
          {GENERIC_MESSAGE}
        </p>
      ) : null}
    </>
  );
}

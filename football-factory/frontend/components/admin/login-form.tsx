"use client";

// Football Factory — Admin login form (client component).
//
// Submits JSON { email, password } to POST /api/auth/login. The
// browser sets Origin/Sec-Fetch-Site headers automatically, which
// /api/auth/login's CSRF check accepts for same-origin POSTs.
//
// On 200 { ok: true, user }: redirects to /admin (or to ?next=...).
// On any non-2xx: shows a generic error. Never reveals which field
// was wrong (server enforces that already).

import { use, useState, useTransition } from "react";

export function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = use(searchParams);
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/admin";
  const initialError =
    sp.error === "invalid_credentials"
      ? "Invalid email or password."
      : sp.error === "rate_limited"
        ? "Too many attempts. Please wait and try again."
        : sp.error === "csrf_failed"
          ? "Sign-in failed security check. Please reload and try again."
          : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email, password }),
        });
        if (res.ok) {
          // Full page navigation so the freshly-set ff_session cookie
          // is sent on the next request.
          window.location.href = next;
          return;
        }
        if (res.status === 429) {
          setError("Too many attempts. Please wait and try again.");
          return;
        }
        if (res.status === 401) {
          setError("Invalid email or password.");
          return;
        }
        setError("Sign-in failed. Please try again.");
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  return (
    <div className="admin-shell admin-shell-root">
      <main className="admin-shell-main" aria-label="Admin sign in">
        <h1>Admin sign in</h1>
        <form
          method="post"
          action="/api/auth/login"
          onSubmit={onSubmit}
          className="admin-login-form"
        >
          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
            />
          </label>
          <button type="submit" className="admin-button" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="admin-help-text">
          <a className="admin-link" href="/admin/forgot-password">
            ลืมรหัสผ่าน?
          </a>
        </p>
        {error ? (
          <p role="alert" className="admin-error" aria-live="polite">
            {error}
          </p>
        ) : null}
      </main>
    </div>
  );
}

// Football Factory — Admin shell header (R2 Wave 2C).
//
// Server-rendered top header for the admin sections.

import "server-only";
import Link from "next/link";

export function AdminShellHeader({ currentPath }: { currentPath: string }) {
  const links: Array<{ href: string; label: string }> = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/editorial", label: "Editorial queue" },
  ];
  return (
    <header className="admin-shell-header">
      <strong>Football Factory · Admin</strong>
      <nav aria-label="Admin navigation">
        <ul>
          {links.map((l) => {
            const active = currentPath === l.href;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={active ? "active" : undefined}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

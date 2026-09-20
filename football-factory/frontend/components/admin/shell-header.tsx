// FF90 — Admin shell header (LOCAL ONLY — visual-only rebranded).
//
// Server-rendered top header for the admin sections. Brand text only —
// no auth/identity/secret material.

import "server-only";
import Link from "next/link";
import Image from "next/image";
import {
  BRAND_NAME,
  BRAND_LOGO_MARK_PATH,
} from "@/lib/brand";

export function AdminShellHeader({ currentPath }: { currentPath: string }) {
  const links: Array<{ href: string; label: string }> = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/editorial", label: "Editorial queue" },
  ];
  return (
    <header className="admin-shell-header">
      <Link href="/admin" className="admin-shell-brand" aria-label={BRAND_NAME}>
        <Image
          src={BRAND_LOGO_MARK_PATH}
          alt={BRAND_NAME}
          height={36}
          width={170}
          className="adminShellLogo"
        />
      </Link>
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

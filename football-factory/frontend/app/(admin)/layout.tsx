// Football Factory — Admin route-group layout (R2 Wave 2C).
//
// Mounts the admin pages WITHOUT the global Thai-first Header /
// Footer. Admin pages get a minimal admin shell only.

export const metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="admin-shell-root">{children}</div>;
}

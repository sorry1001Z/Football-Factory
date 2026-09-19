// Football Factory — /admin/editorial/new — operator-driven pilot page.
//
// Hosts the NewEditorialPilot component. No server-side data load —
// the form starts blank and calls admin pipeline endpoints on submit.
//
// Auth: same as other admin pages (requireAdminOrEditor at the layout
// level — this file just renders the client component).

import "server-only";
import NewEditorialPilot from "@/components/admin/new-editorial-pilot";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New Editorial Pilot · Admin · Football Factory",
  robots: { index: false, follow: false },
};

export default function AdminEditorialNewPage() {
  return <NewEditorialPilot />;
}

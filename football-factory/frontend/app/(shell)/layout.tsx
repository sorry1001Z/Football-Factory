// Football Factory — Commercial Shell route group layout (R2 Wave 2A).
//
// Pages in `app/(shell)/` opt out of the global Header/Footer that
// `app/layout.tsx` renders. They provide their own MainHeader /
// Footer through the commercial-shell components. This prevents
// duplicated chrome on the homepage, news list, and search pages.
//
// URL paths are unchanged: `app/(shell)/page.tsx` is still served
// at `/`, `app/(shell)/news/page.tsx` at `/news`, and
// `app/(shell)/search/page.tsx` at `/search`. Route groups are
// invisible in URLs.

import "../commercial-shell.css";

export default function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}

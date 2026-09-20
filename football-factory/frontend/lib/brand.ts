// FF90 — Brand constants (LOCAL ONLY — not yet committed).
//
// Single source of truth for user-visible brand strings in the FF90 web
// application. Auth/identity values (Neon users.email, AUTH_SECRET,
// DATABASE_URL, etc.) are NOT routed through here on purpose: they live
// in Vercel environment and in the database.
//
// Anything that is a USER-VISIBLE BRAND STRING — site name, header
// title, footer copyright, contact email, JSON-LD publisher name,
// OpenGraph site_name, etc. — should come from this module.
//
// Internal identifiers that are intentionally NOT routed through this
// module (and are therefore deliberately preserved verbatim):
//   - repo dir name
//   - package name in `package.json`
//   - API route paths
//   - DB tables
//   - env-var names (AUTH_SECRET, DATABASE_URL, etc.)
// FF90 — Brand constants (LOCAL ONLY — not yet committed).

// Public brand
export const BRAND_NAME = "FF90.online";
export const BRAND_NAME_SHORT = "FF90";
export const BRAND_NAME_LONG = "FF90.online";

// Default title template. Pages can override with their own title.
export const BRAND_TITLE_TEMPLATE = "%s · FF90.online";
export const BRAND_TITLE_DEFAULT = "FF90.online";

// Tagline used in footer and structured data.
export const BRAND_TAGLINE = "FF90.online — ข่าวฟุตบอล อัปเดตผลบอล ตารางคะแนน และบทวิเคราะห์ฟุตบอล";

// Public contact email. Mailbox delivery is NOT verified in this slice.
export const PUBLIC_CONTACT_EMAIL = "contact@ff90.online";

// OpenGraph / Twitter card description baseline.
export const BRAND_DESCRIPTION =
  "ข่าวฟุตบอล ผลบอล โปรแกรมการแข่งขัน บทวิเคราะห์ และข้อมูลทีมแบบรวดเร็ว";

// Organization name used in JSON-LD publisher blocks.
export const BRAND_PUBLISHER_NAME = "FF90.online";

// Logo asset paths (relative to /public). These are extracted from the
// operator-supplied brand board artwork. Per the brief, the FOOTBALL
// FACTORY subtitle is NOT shown anywhere on the live site — only the
// FF90 mark and "FF90.online" HTML text.
export const BRAND_LOGO_PATH = "/branding/ff90/ff90-logo-horizontal.png";
export const BRAND_LOGO_MARK_PATH = "/branding/ff90/ff90-logo-mark.png";
export const BRAND_ICON_PATH = "/branding/ff90/ff90-icon.png";
export const BRAND_MONOGRAM_PATH = "/branding/ff90/ff90-monogram.png";
export const BRAND_FAVICON_PATH = "/favicon.ico";

// Aria label and screen-reader text for the brand mark.
export const BRAND_HOME_LABEL = "FF90.online home";

// Football Factory — admin date formatters.
//
// The EditorialItem / AuditEvent TS contracts declare `updated_at`,
// `approved_at`, `created_at`, and `at` as `string` (or `string |
// null`), but pg returns `timestamptz` as JavaScript `Date` objects
// at runtime. When those Date objects reach JSX as React children,
// React throws "Objects are not valid as a React child" (minified
// error #31). These helpers normalize Date | string | null |
// undefined to a safe localized string for JSX rendering, and to an
// ISO string (or empty) for the `<time dateTime="…">` attribute.
//
// Locale: `th-TH` short form (matches the rest of FF90's date
// formatting in `lib/content/content-service.ts` and `lib/wordpress.ts`).

/**
 * Render-safe text for a Date | string | null | undefined value.
 * Returns "—" for null/undefined/invalid input.
 */
export function formatAdminDateText(
  value: Date | string | null | undefined,
): string {
  if (value == null) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Safe value for the `<time dateTime="…">` HTML attribute.
 * Returns an ISO string or empty string (HTML datetime attribute
 * rejects Date objects; React would otherwise warn about non-string
 * attribute values).
 */
export function formatAdminDateAttr(
  value: Date | string | null | undefined,
): string {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

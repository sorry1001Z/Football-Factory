#!/usr/bin/env node
/**
 * Football Factory — production environment validator.
 *
 * Usage:
 *   npm run validate:prod
 *
 * Reports the presence/shape of every env var the production deployment
 * needs. NEVER prints a secret value. Exits 0 if every REQUIRED_NOW var
 * is present and shape-valid; non-zero otherwise.
 *
 * Required-Now: must be set before the FIRST SLICE staging go-live.
 * Required-Later: needed for full feature surface (Phase 4+); not blocking.
 * Optional: never blocking.
 */
import process from "node:process";

const PLACEHOLDER_RE = /(CHANGE_ME|example\.com|replace-with)/i;

const ENVS = [
  // -------- REQUIRED NOW (FIRST SLICE staging) --------
  {
    name: "NEXT_PUBLIC_SITE_URL",
    required: "now",
    shape: (v) => /^https?:\/\//.test(v),
    note: "Production site URL. Used for CSRF origin matching and revalidate.",
  },
  {
    name: "WORDPRESS_GRAPHQL_URL",
    required: "now",
    shape: (v) => /^https?:\/\/.*\/graphql$/.test(v),
    note: "Read path for Content Service. (Phase 3, already wired.)",
  },
  {
    name: "REVALIDATE_SECRET",
    required: "now",
    shape: (v) => v.length >= 16,
    note: "Server-only secret for /api/revalidate.",
  },
  {
    name: "DATABASE_URL",
    required: "now",
    shape: (v) =>
      /^postgres(ql)?:\/\//.test(v) && !PLACEHOLDER_RE.test(v),
    note: "Server-only Postgres connection string. Required for /api/auth/*, /api/admin/*, /api/automation/deduplicate, /api/automation/wp-draft.",
  },
  {
    name: "AUTH_SECRET",
    required: "now",
    shape: (v) => v.length >= 32 && !PLACEHOLDER_RE.test(v),
    note: "Session HMAC secret. >= 32 chars, not a placeholder.",
  },
  {
    name: "WORDPRESS_REST_URL",
    required: "now",
    shape: (v) => /^https?:\/\/.*\/wp-json\/wp\/v2\/?$/.test(v),
    note: "Write path for /api/admin/posts and /api/automation/wp-draft.",
  },
  {
    name: "WORDPRESS_APP_USER",
    required: "now",
    shape: (v) => v.length > 0,
    note: "WordPress automation username. Editor role recommended.",
  },
  {
    name: "WORDPRESS_APP_PASSWORD",
    required: "now",
    shape: (v) => v.length >= 16 && !PLACEHOLDER_RE.test(v),
    note: "WordPress Application Password. >= 16 chars, not a placeholder.",
  },
  {
    name: "AUTOMATION_SECRET",
    required: "now",
    shape: (v) => v.length >= 16 && !PLACEHOLDER_RE.test(v),
    note: "Server-only secret shared with n8n for x-automation-secret.",
  },
  // -------- REQUIRED LATER --------
  {
    name: "FOOTBALL_API_KEY",
    required: "later",
    shape: (v) => v.length >= 16 && !PLACEHOLDER_RE.test(v),
    note: "Live football provider. Not blocking FIRST SLICE.",
  },
  {
    name: "N8N_WEBHOOK_URL",
    required: "later",
    shape: (v) => /^https?:\/\//.test(v),
    note: "n8n source webhook. Not blocking until n8n is provisioned.",
  },
  {
    name: "AI_ASSIST_ENDPOINT",
    required: "later",
    shape: (v) => v.length === 0 || /^https?:\/\//.test(v),
    note: "External AI endpoint. Empty OK; set when service is wired.",
  },
  {
    name: "FACT_CHECK_ENDPOINT",
    required: "later",
    shape: (v) => v.length === 0 || /^https?:\/\//.test(v),
    note: "External fact-check endpoint. Empty OK; set when service is wired.",
  },
  {
    name: "SEO_ENDPOINT",
    required: "later",
    shape: (v) => v.length === 0 || /^https?:\/\//.test(v),
    note: "External SEO endpoint. Empty OK; set when service is wired.",
  },
  {
    name: "RIGHTS_CHECK_ENDPOINT",
    required: "later",
    shape: (v) => v.length === 0 || /^https?:\/\//.test(v),
    note: "External rights-check endpoint. Empty OK; set when service is wired.",
  },
  {
    name: "GA4_PROPERTY_ID",
    required: "later",
    shape: (v) => v.length === 0 || /^\d+$/.test(v),
    note: "GA4 property id (digits). Empty OK; required when analytics is enabled.",
  },
  {
    name: "GSC_SITE_URL",
    required: "later",
    shape: (v) => v.length === 0 || /^sc-domain:|https?:\/\//.test(v),
    note: "Google Search Console site URL. Empty OK; required when analytics is enabled.",
  },
  {
    name: "GOOGLE_SERVICE_ACCOUNT_JSON_B64",
    required: "later",
    shape: (v) => v.length === 0 || /^[A-Za-z0-9+/=]+$/.test(v),
    note: "Service account JSON, base64-encoded. Empty OK; required when GA4/GSC enabled.",
  },
  {
    name: "TELEGRAM_BOT_TOKEN",
    required: "later",
    shape: (v) => v.length === 0 || /^\d+:[A-Za-z0-9_-]+$/.test(v),
    note: "Telegram bot token. Empty OK; required when alerts are enabled.",
  },
  {
    name: "TELEGRAM_CHAT_ID",
    required: "later",
    shape: (v) => v.length === 0 || /^-?\d+$/.test(v),
    note: "Telegram chat id. Empty OK; required when alerts are enabled.",
  },
  {
    name: "N8N_BASE_URL",
    required: "later",
    shape: (v) => v.length === 0 || /^https?:\/\//.test(v),
    note: "n8n instance URL. Empty OK; required when n8n is provisioned.",
  },
  {
    name: "N8N_HEALTH_URL",
    required: "later",
    shape: (v) => v.length === 0 || /^https?:\/\//.test(v),
    note: "n8n health endpoint. Empty OK; required when n8n is provisioned.",
  },
  {
    name: "HEALTH_ALERT_WEBHOOK_URL",
    required: "later",
    shape: (v) => v.length === 0 || /^https?:\/\//.test(v),
    note: "Health alert sink. Empty OK; required when alerts are enabled.",
  },
  // -------- OPTIONAL --------
  {
    name: "SESSION_COOKIE_NAME",
    required: "optional",
    shape: (v) => v.length === 0 || /^[A-Za-z0-9_-]{1,64}$/.test(v),
    note: "Override default 'ff_session'.",
  },
  {
    name: "SESSION_TTL_SECONDS",
    required: "optional",
    shape: (v) => v.length === 0 || /^\d+$/.test(v),
    note: "Override default 604800 (7 days).",
  },
  {
    name: "FOOTBALL_PROVIDER",
    required: "optional",
    shape: (v) =>
      v.length === 0 ||
      ["football-data.org", "api-football", "mock"].includes(v),
    note: "Override default provider. Set when FOOTBALL_API_KEY is set.",
  },
  {
    name: "FOOTBALL_API_BASE_URL",
    required: "optional",
    shape: (v) => v.length === 0 || /^https?:\/\//.test(v),
    note: "Override default API base URL.",
  },
  {
    name: "FOOTBALL_TIMEOUT_MS",
    required: "optional",
    shape: (v) => v.length === 0 || /^\d+$/.test(v),
    note: "Override default 8000.",
  },
  {
    name: "FOOTBALL_CACHE_TTL_SECONDS",
    required: "optional",
    shape: (v) => v.length === 0 || /^\d+$/.test(v),
    note: "Override default 60.",
  },
  {
    name: "FOOTBALL_RETRY_COUNT",
    required: "optional",
    shape: (v) => v.length === 0 || /^\d+$/.test(v),
    note: "Override default 2.",
  },
  {
    name: "WORDPRESS_WRITE_TIMEOUT_MS",
    required: "optional",
    shape: (v) => v.length === 0 || /^\d+$/.test(v),
    note: "Override default 8000 for the write client.",
  },
  {
    name: "REVALIDATE_URL",
    required: "optional",
    shape: (v) => v.length === 0 || /^https?:\/\//.test(v),
    note: "Override default (NEXT_PUBLIC_SITE_URL + /api/revalidate).",
  },
  {
    name: "PRODUCTION_BASE_URL",
    required: "optional",
    shape: (v) => v.length === 0 || /^https?:\/\//.test(v),
    note: "Production base URL for gate scripts; usually == NEXT_PUBLIC_SITE_URL.",
  },
  {
    name: "PGSSLMODE",
    required: "optional",
    shape: (v) => v.length === 0 || ["disable", "require", "verify-ca", "verify-full"].includes(v),
    note: "Postgres SSL mode. Default uses sslmode=require unless disabled.",
  },
  {
    name: "REQUIRE_GA4",
    required: "optional",
    shape: (v) => v.length === 0 || ["true", "false"].includes(v),
    note: "Gate flag for GA4. Set 'true' only when analytics is wired.",
  },
  {
    name: "REQUIRE_GSC",
    required: "optional",
    shape: (v) => v.length === 0 || ["true", "false"].includes(v),
    note: "Gate flag for GSC. Set 'true' only when analytics is wired.",
  },
];

function classify(e) {
  const v = process.env[e.name] ?? "";
  if (PLACEHOLDER_RE.test(v) && e.shape(v)) {
    return { status: "PLACEHOLDER", present: true };
  }
  if (!v) return { status: e.required === "now" ? "MISSING" : "EMPTY", present: false };
  if (!e.shape(v)) return { status: "INVALID", present: true };
  return { status: "OK", present: true };
}

const buckets = { now: [], later: [], optional: [] };
let missingNow = 0;
let invalidNow = 0;
let placeholderNow = 0;

console.log("[validate:prod] scanning env ...\n");
for (const e of ENVS) {
  const r = classify(e);
  const label = e.required.toUpperCase().padEnd(8);
  console.log(`  [${label}] ${e.name.padEnd(34)} ${r.status.padEnd(11)} ${e.note}`);
  if (e.required === "now") {
    if (r.status === "MISSING") missingNow++;
    else if (r.status === "INVALID") invalidNow++;
    else if (r.status === "PLACEHOLDER") placeholderNow++;
    buckets.now.push({ ...e, ...r });
  } else if (e.required === "later") buckets.later.push({ ...e, ...r });
  else buckets.optional.push({ ...e, ...r });
}

console.log();
console.log("[validate:prod] summary:");
console.log(`  REQUIRED_NOW : OK=${buckets.now.filter((x) => x.status === "OK").length} missing=${missingNow} invalid=${invalidNow} placeholder=${placeholderNow}`);
console.log(`  CONFIG_REQUIRED_LATER : ${buckets.later.filter((x) => x.status === "OK" || x.status === "INVALID" || x.status === "PLACEHOLDER").length} configured / ${buckets.later.length} total`);
console.log(`  OPTIONAL : ${buckets.optional.filter((x) => x.status === "OK").length} set / ${buckets.optional.length} total`);

console.log();
const blocking = missingNow + invalidNow + placeholderNow;
if (blocking > 0) {
  console.log(`[validate:prod] FAIL: ${blocking} REQUIRED_NOW env vars missing or invalid.`);
  process.exit(2);
}
console.log("[validate:prod] PASS: every REQUIRED_NOW env var is present and shape-valid.");
process.exit(0);

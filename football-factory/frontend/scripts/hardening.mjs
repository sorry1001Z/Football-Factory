// Football Factory — production hardening helpers (R2.1 Wave A).
//
// ADAPTED FROM: external Pack 03 (production-hardening-toolkit-r2).
// MERGED-INTO: scripts/security-headers.mjs + scripts/readiness-report.mjs
//               (no module is consumed from production TypeScript; this
//                file is a script-side helper only).
//
// SCOPE: pure functions only. No fetch. No credentials. No deployment
// actions. The existing scripts/_stats.mjs, scripts/smoke.mjs,
// scripts/benchmark.mjs, scripts/benchmark-compare.mjs, and
// lib/observability/index.ts remain authoritative for HTTP / latency /
// percentile / baseline-comparison. We do NOT duplicate those.
//
// HONEST CONSTRAINT: `checkHttpsUrlPolicy` checks URL scheme only.
// `certificateVerified` is hardcoded `false`. This is NOT a TLS
// certificate validator.

// ---------- Header normalisation --------------------------------------

function normalizeHeaders(headers = {}) {
  const out = {};
  if (headers && typeof headers.forEach === "function") {
    headers.forEach((v, k) => {
      out[String(k).toLowerCase()] = String(v ?? "");
    });
  } else if (headers && typeof headers === "object") {
    for (const [k, v] of Object.entries(headers)) {
      out[String(k).toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
    }
  }
  return out;
}

// ---------- Cache-Control parser ---------------------------------------

const CACHE_BOOL_DIRECTIVES = new Set([
  "public",
  "private",
  "no-store",
  "no-cache",
  "must-revalidate",
  "immutable",
]);

export function parseCacheControl(value = "") {
  const directives = {};
  const errors = [];
  for (const raw of String(value ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
    const eq = raw.indexOf("=");
    const keyRaw = eq === -1 ? raw : raw.slice(0, eq);
    const valRaw = eq === -1 ? "" : raw.slice(eq + 1);
    const key = keyRaw.toLowerCase();
    const val = valRaw.replace(/^"|"$/g, "");
    if (CACHE_BOOL_DIRECTIVES.has(key)) {
      directives[key] = true;
    } else if (key === "max-age" || key === "s-maxage") {
      if (!/^\d+$/.test(val)) {
        errors.push(`INVALID_${key.toUpperCase().replace("-", "_")}`);
      } else {
        directives[key] = Number(val);
      }
    } else {
      directives[key] = val || true;
    }
  }
  return { directives, errors };
}

export function checkCacheHeader(value) {
  if (!String(value ?? "").trim()) {
    return {
      id: "cache-header",
      category: "cache",
      status: "WARN",
      evidence: { value: null },
      recommendation: "Confirm intended cache policy",
    };
  }
  const parsed = parseCacheControl(value);
  return {
    id: "cache-header",
    category: "cache",
    status: parsed.errors.length ? "WARN" : "PASS",
    evidence: { raw: value, ...parsed },
    recommendation: parsed.errors.length
      ? "Fix malformed cache directives"
      : "Review policy semantics separately from syntax",
  };
}

// ---------- HSTS parser -------------------------------------------------

export function parseHsts(value = "") {
  const parts = String(value ?? "").split(";").map((x) => x.trim()).filter(Boolean);
  const maxPart = parts.find((x) => /^max-age=/i.test(x));
  const raw = maxPart ? maxPart.split("=")[1] : undefined;
  const maxAge = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  return {
    maxAge,
    includeSubDomains: parts.some((x) => /^includesubdomains$/i.test(x)),
    preload: parts.some((x) => /^preload$/i.test(x)),
  };
}

// ---------- CSP / Referrer-Policy allowlist -----------------------------

const REFERRER_POLICIES = new Set([
  "no-referrer",
  "no-referrer-when-downgrade",
  "origin",
  "origin-when-cross-origin",
  "same-origin",
  "strict-origin",
  "strict-origin-when-cross-origin",
  "unsafe-url",
]);

// ---------- Security headers check -------------------------------------

export function checkSecurityHeaders(inputHeaders = {}) {
  const h = normalizeHeaders(inputHeaders);
  const out = [];
  const csp = h["content-security-policy"];
  const cspReport = h["content-security-policy-report-only"];
  out.push({
    id: "security-csp",
    category: "security",
    status: csp ? "PASS" : cspReport ? "WARN" : "WARN",
    evidence: {
      present: Boolean(csp),
      reportOnly: Boolean(cspReport),
      frameAncestors: csp ? csp.match(/frame-ancestors\s+[^;]+/i)?.[0] ?? null : null,
    },
    recommendation: csp
      ? "Review CSP semantics separately"
      : "Enforced CSP missing",
  });
  const hs = parseHsts(h["strict-transport-security"]);
  out.push({
    id: "security-hsts",
    category: "security",
    status: hs.maxAge && hs.maxAge > 0 ? "PASS" : "WARN",
    evidence: hs,
    recommendation:
      hs.maxAge && hs.maxAge > 0
        ? "Review duration/subdomain/preload policy"
        : "Set valid positive max-age for HTTPS production",
  });
  const nosniff = String(h["x-content-type-options"] ?? "").toLowerCase() === "nosniff";
  out.push({
    id: "security-nosniff",
    category: "security",
    status: nosniff ? "PASS" : "WARN",
    evidence: { value: h["x-content-type-options"] ?? null },
    recommendation: nosniff ? "No action" : "Use nosniff where appropriate",
  });
  const rp = String(h["referrer-policy"] ?? "").toLowerCase();
  out.push({
    id: "security-referrer",
    category: "security",
    status: REFERRER_POLICIES.has(rp) ? "PASS" : "WARN",
    evidence: { value: rp || null },
    recommendation: REFERRER_POLICIES.has(rp) ? "No action" : "Use a recognized Referrer-Policy",
  });
  const pp = String(h["permissions-policy"] ?? "").trim();
  const ppLooksValid =
    pp === ""
      ? false
      : /^[a-z0-9-]+\s*=\s*\([^)]*\)(\s*,\s*[a-z0-9-]+\s*=\s*\([^)]*\))*$/i.test(pp);
  out.push({
    id: "security-permissions",
    category: "security",
    status: ppLooksValid ? "PASS" : "WARN",
    evidence: { value: pp || null },
    recommendation: ppLooksValid ? "No action" : "Review Permissions-Policy syntax/presence",
  });
  const frame = h["x-frame-options"] ?? csp?.match(/frame-ancestors\s+[^;]+/i)?.[0];
  out.push({
    id: "security-frame",
    category: "security",
    status: frame ? "PASS" : "WARN",
    evidence: { value: frame ?? null },
    recommendation: frame ? "No action" : "Configure frame-ancestors or X-Frame-Options where appropriate",
  });
  return out;
}

// ---------- HTTPS URL policy (scheme-only) ------------------------------

export function checkHttpsUrlPolicy(url) {
  try {
    const u = new URL(String(url));
    const https = u.protocol === "https:";
    return {
      id: "https-url-policy",
      category: "transport",
      status: https ? "PASS" : "FAIL",
      evidence: {
        protocol: u.protocol,
        certificateVerified: false, // explicit: scheme-only check
      },
      recommendation: https
        ? "HTTPS scheme present; certificate not probed"
        : "Require HTTPS in production",
    };
  } catch {
    return {
      id: "https-url-policy",
      category: "transport",
      status: "FAIL",
      evidence: { url, certificateVerified: false },
      recommendation: "Invalid URL",
    };
  }
}

// ---------- Readiness report -------------------------------------------

export function readinessJson(results) {
  const counts = { PASS: 0, WARN: 0, FAIL: 0 };
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return {
    generatedAt: new Date().toISOString(),
    counts,
    results,
  };
}

export function readinessMarkdown(results) {
  const d = readinessJson(results);
  return [
    "# Production Readiness",
    `PASS ${d.counts.PASS} · WARN ${d.counts.WARN} · FAIL ${d.counts.FAIL}`,
    "",
    ...results.map((r) => `- **${r.status}** ${r.id}: ${r.recommendation}`),
  ].join("\n");
}

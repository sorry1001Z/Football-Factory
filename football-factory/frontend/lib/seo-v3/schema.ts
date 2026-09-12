// Football Factory — SEO V3 Schema Validator (Wave A).
//
// Validator only. Does NOT emit or replace the production
// JSON-LD emitted by `lib/seo/seo.ts::buildNewsArticleJsonLd` or
// `lib/seo-entity/service.ts::buildHubSeo`.
//
// This module checks a candidate `@graph`-rooted JSON-LD
// document for structural correctness:
//   - empty graph
//   - missing @type
//   - duplicate @id
//   - unresolved references (a node references `@id` that does
//     not appear elsewhere in the graph)

export type SchemaIssueCode =
  | "EMPTY_GRAPH"
  | "MISSING_TYPE"
  | "DUPLICATE_ID"
  | "UNRESOLVED_REF";

export interface SchemaIssue {
  code: SchemaIssueCode;
  detail: string;
}

export interface SchemaValidation {
  valid: boolean;
  issues: SchemaIssue[];
}

type JsonObject = { [k: string]: unknown };

export interface SchemaGraphNode extends JsonObject {
  "@type"?: unknown;
  "@id"?: unknown;
}

export interface SchemaGraphDocument extends JsonObject {
  "@context"?: unknown;
  "@graph"?: unknown;
}

/**
 * Wrap a list of nodes in a minimal `@context`-rooted document.
 * Pure helper; does not validate.
 */
export function graph(nodes: SchemaGraphNode[]): SchemaGraphDocument {
  return {
    "@context": "https://schema.org",
    "@graph": nodes as unknown as unknown[],
  };
}

function isPlainObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate a candidate `@graph`-rooted JSON-LD document. Pure;
 * no I/O; never throws. Returns the typed validation result with
 * a list of issues (empty when valid).
 */
export function validateGraph(
  doc: SchemaGraphDocument | null | undefined,
): SchemaValidation {
  if (!isPlainObject(doc)) {
    return { valid: false, issues: [{ code: "EMPTY_GRAPH", detail: "document is not an object" }] };
  }
  const g = doc["@graph"];
  if (!Array.isArray(g) || g.length === 0) {
    return { valid: false, issues: [{ code: "EMPTY_GRAPH", detail: "@graph missing or empty" }] };
  }

  const issues: SchemaIssue[] = [];
  const ids = new Set<string>();

  // First pass: enforce @type and unique @id.
  for (let i = 0; i < g.length; i++) {
    const n = g[i];
    if (!isPlainObject(n)) {
      issues.push({ code: "MISSING_TYPE", detail: `node at index ${i} is not an object` });
      continue;
    }
    if (!n["@type"]) {
      issues.push({ code: "MISSING_TYPE", detail: `node at index ${i}` });
    }
    const id = n["@id"];
    if (typeof id === "string") {
      if (ids.has(id)) {
        issues.push({ code: "DUPLICATE_ID", detail: id });
      } else {
        ids.add(id);
      }
    }
  }

  // Second pass: collect @id references and report unresolved ones.
  // A reference is a node whose ONLY key is `@id`. Absolute http(s)
  // URLs are accepted without an in-graph match (out-of-graph refs).
  const refs: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    if (!isPlainObject(v)) return;
    const keys = Object.keys(v);
    if (keys.length === 1 && typeof v["@id"] === "string") {
      refs.push(v["@id"]);
      return;
    }
    for (const k of keys) walk(v[k]);
  };
  for (const node of g) walk(node);
  for (const ref of refs) {
    if (ids.has(ref)) continue;
    if (/^https?:\/\//.test(ref)) continue;
    issues.push({ code: "UNRESOLVED_REF", detail: ref });
  }

  return { valid: issues.length === 0, issues };
}

// Football Factory — SEO V3 Domain Adapter Contract (Wave A).
//
// Generic interface for domain adapters. NO football-specific
// implementation in this wave. Domain adapters plug into the
// advisory service layer; production rendering stays in
// `lib/seo/seo.ts`.

export type EntityRef = {
  id: string;
  type: string;
  name: string;
  slug?: string;
  [k: string]: unknown;
};

export type EntityRelation = {
  fromId: string;
  toId: string;
  type: string;
  [k: string]: unknown;
};

export type IntentRule = {
  id: string;
  locale?: string;
  patterns: Array<{ phrase: string; weight?: number }> | string[];
  negativePatterns?: string[];
  intent: string;
  entityType?: string;
  entityId?: string;
  landingPageType: string;
  priority?: number;
  [k: string]: unknown;
};

export type SchemaExtension = Record<string, unknown> & {
  "@type": string;
  "@id"?: string;
};

export type InternalLinkTarget = {
  url: string;
  label: string;
  confidence: number;
  entityId: string;
  entityType: string;
  priority?: number;
  [k: string]: unknown;
};

/**
 * Generic SEO domain-adapter contract. Production rendering lives
 * elsewhere; this contract is the advisory service-layer hook.
 *
 * All methods MUST be implemented. The contract assertion helper
 * throws a TypeError listing the missing methods.
 */
export interface SeoDomainAdapter {
  resolveEntity(text: string): Promise<EntityRef[]>;
  getEntityRelations(entity: EntityRef): Promise<EntityRelation[]>;
  getLandingPageType(entity: EntityRef, intent: string): string;
  getIntentRules(): IntentRule[];
  getSchemaExtensions(entity: EntityRef): SchemaExtension[];
  getInternalLinkTargets(entity: EntityRef): Promise<InternalLinkTarget[]>;
}

/**
 * Contract assertion helper. Returns `true` on success; throws
 * `TypeError` listing any missing methods.
 */
export function assertSeoDomainAdapter(a: unknown): a is SeoDomainAdapter {
  const methods: Array<keyof SeoDomainAdapter> = [
    "resolveEntity",
    "getEntityRelations",
    "getLandingPageType",
    "getIntentRules",
    "getSchemaExtensions",
    "getInternalLinkTargets",
  ];
  if (!a || typeof a !== "object") {
    throw new TypeError("adapter is not an object");
  }
  const obj = a as Record<string, unknown>;
  const missing = methods.filter((m) => typeof obj[m] !== "function");
  if (missing.length > 0) {
    throw new TypeError(`Missing adapter method: ${missing.join(", ")}`);
  }
  return true;
}

// Football Factory — SEO Admin Suggestions view-model (Set #3 Wave D).
//
// Read-only, advisory view-model that normalizes a production
// SEO V3 advisory payload into UI-shaped data for the existing
// editorial admin shell.
//
// Production invariants:
//   - mutationCapabilities() returns ALL FALSE — no UI control
//     can trigger an automatic edit, link insertion, title rewrite,
//     publish, or publish-gate modification.
//   - rankingGuarantee is always FALSE on every GSC opportunity.
//   - Player / Match entities without canonicalId get
//     status = 'deferred_unresolved'. NO canonical_id fabrication.
//   - Pure functions only — no I/O, no env reads, no network.
//   - No SEO rule reimplementation; only advisory view-shaping.

export const GSC_OPPORTUNITY_TYPES = [
  "HIGH_IMPRESSIONS_LOW_CTR",
  "POSITION_8_TO_20",
  "DECLINING_PAGE",
  "RISING_QUERY",
  "CANNIBALIZATION",
  "LOW_INDEX_COVERAGE",
  "TITLE_REWRITE_OPPORTUNITY",
  "INTERNAL_LINK_OPPORTUNITY",
] as const;

export type GscOpportunityType = (typeof GSC_OPPORTUNITY_TYPES)[number];

export interface RawEntityRef {
  canonicalId?: string | null;
  id?: string | null;
  name?: string;
  type?: string;
  slug?: string;
}

export interface RawGscOpportunity {
  type?: string;
  priority?: number;
  confidence?: number;
  url?: string;
  query?: string;
  position?: number;
  ctr?: number;
  impressions?: number;
  notes?: string;
}

export interface RawInternalLinkSuggestion {
  anchor?: string;
  target?: string;
  reason?: string;
  confidence?: number;
  context?: string;
}

export interface RawArticleRelations {
  teams?: RawEntityRef[];
  competitions?: RawEntityRef[];
  players?: RawEntityRef[];
  matches?: RawEntityRef[];
  articleRelations?: Array<{
    fromId?: string;
    toId?: string;
    type?: string;
  }>;
}

export interface RawQuality {
  score?: number;
  blockingIssues?: string[];
  warnings?: string[];
  opportunities?: string[];
}

export interface RawIntent {
  intent?: string;
  confidence?: number;
  matchedRules?: string[];
  landingPageType?: string;
  entity?: RawEntityRef;
}

export interface SeoAdvisoryInput {
  quality?: RawQuality;
  intent?: RawIntent;
  internalLinks?: RawInternalLinkSuggestion[];
  gsc?: RawGscOpportunity[];
  entities?: RawArticleRelations;
}

export interface QualityModel {
  score: number;
  blockingIssues: string[];
  warnings: string[];
  opportunities: string[];
  publishBlocking: boolean;
}

export interface IntentModel {
  intent: string;
  confidence: number;
  matchedRules: string[];
  landingPageType: string | null;
  entity: RawEntityRef | null;
  lowConfidence: boolean;
}

export interface InternalLinkModel {
  anchor: string;
  target: string;
  reason: string;
  confidence: number;
  context: string | null;
  selected: boolean;
}

export interface GscOpportunityModel extends RawGscOpportunity {
  rankingGuarantee: false;
}

export interface EntityContextModel {
  teams: RawEntityRef[];
  competitions: RawEntityRef[];
  players: RawEntityRef[];
  matches: RawEntityRef[];
  articleRelations: Array<{ fromId?: string; toId?: string; type?: string }>;
}

export interface SeoOverview {
  quality: QualityModel;
  intent: IntentModel;
  internalLinks: InternalLinkModel[];
  gsc: GscOpportunityModel[];
  entities: EntityContextModel;
}

export interface SeoMutationCapabilities {
  canAutoEdit: boolean;
  canAutoInsertLink: boolean;
  canRewriteTitle: boolean;
  canPublish: boolean;
  canModifyPublishGate: boolean;
}

export type PanelStateKind = "loading" | "error" | "empty" | "ready";

export interface PanelState {
  kind: PanelStateKind;
  message?: string;
}

// ----- Quality ---------------------------------------------------------

export function qualityModel(input: RawQuality = {}): QualityModel {
  const blockingIssues = Array.isArray(input.blockingIssues)
    ? [...input.blockingIssues]
    : [];
  return {
    score: Number(input.score ?? 0),
    blockingIssues,
    warnings: Array.isArray(input.warnings) ? [...input.warnings] : [],
    opportunities: Array.isArray(input.opportunities)
      ? [...input.opportunities]
      : [],
    publishBlocking: blockingIssues.length > 0,
  };
}

// ----- Intent ----------------------------------------------------------

export function intentModel(input: RawIntent = {}): IntentModel {
  const confidence = Number(input.confidence ?? 0);
  return {
    intent: input.intent ?? "UNKNOWN",
    confidence,
    matchedRules: Array.isArray(input.matchedRules) ? [...input.matchedRules] : [],
    landingPageType: input.landingPageType ?? null,
    entity: input.entity ?? null,
    lowConfidence: confidence < 0.65,
  };
}

// ----- Internal links --------------------------------------------------

export function internalLinksModel(
  items: readonly RawInternalLinkSuggestion[] = [],
): InternalLinkModel[] {
  return items.map((x) => ({
    anchor: String(x.anchor ?? ""),
    target: String(x.target ?? ""),
    reason: String(x.reason ?? ""),
    confidence: Number(x.confidence ?? 0),
    context: x.context ?? null,
    selected: false,
  }));
}

// ----- GSC opportunities ----------------------------------------------

export function gscModel(
  items: readonly RawGscOpportunity[] = [],
): GscOpportunityModel[] {
  return [...items]
    .sort(
      (a, b) =>
        Number(b.priority ?? 0) - Number(a.priority ?? 0) ||
        Number(b.confidence ?? 0) - Number(a.confidence ?? 0),
    )
    .map((x) => ({
      ...x,
      rankingGuarantee: false as const,
    }));
}

// ----- Entity context --------------------------------------------------

function withEntityStatus(items: readonly RawEntityRef[]): RawEntityRef[] {
  return items.map((x) =>
    x.canonicalId ? { ...x } : { ...x, status: "deferred_unresolved" },
  );
}

export function entityContextModel(
  input: RawArticleRelations = {},
): EntityContextModel {
  return {
    teams: Array.isArray(input.teams) ? [...input.teams] : [],
    competitions: Array.isArray(input.competitions) ? [...input.competitions] : [],
    players: Array.isArray(input.players) ? withEntityStatus(input.players) : [],
    matches: Array.isArray(input.matches) ? withEntityStatus(input.matches) : [],
    articleRelations: Array.isArray(input.articleRelations)
      ? [...input.articleRelations]
      : [],
  };
}

// ----- Overview builder -----------------------------------------------

export function buildSeoOverview(input: SeoAdvisoryInput = {}): SeoOverview {
  return {
    quality: qualityModel(input.quality),
    intent: intentModel(input.intent),
    internalLinks: internalLinksModel(input.internalLinks),
    gsc: gscModel(input.gsc),
    entities: entityContextModel(input.entities),
  };
}

// ----- Panel state -----------------------------------------------------

export function panelState(
  data: unknown,
  opts: { loading?: boolean; error?: string | null } = {},
): PanelState {
  const loading = opts.loading ?? false;
  const error = opts.error ?? null;
  if (loading) return { kind: "loading" };
  if (error) return { kind: "error", message: String(error) };
  if (!data) return { kind: "empty" };
  return { kind: "ready" };
}

// ----- Mutation capabilities (always all-false) -----------------------

export function mutationCapabilities(): SeoMutationCapabilities {
  return {
    canAutoEdit: false,
    canAutoInsertLink: false,
    canRewriteTitle: false,
    canPublish: false,
    canModifyPublishGate: false,
  };
}

// ----- Identity safety assertion ---------------------------------------

/**
 * Returns the identity status for a single entity ref:
 *   - 'deferred_unresolved' when canonicalId is missing/null
 *   - 'resolved'            when canonicalId is a non-empty string
 *
 * NEVER fabricates canonicalId. NEVER mutates input.
 */
export function identityStatusFor(entity: RawEntityRef | null | undefined):
  | "resolved"
  | "deferred_unresolved" {
  if (!entity) return "deferred_unresolved";
  return entity.canonicalId && String(entity.canonicalId).length > 0
    ? "resolved"
    : "deferred_unresolved";
}
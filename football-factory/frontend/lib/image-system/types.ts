// Football Factory — Image System types (R2 Wave 1).
//
// Adapted from the external Football Image System R2 pack (src/types.ts).
// Public domain shape; consumed by lib/image-system/policy.ts,
// lib/image-system/prefetch.ts, and components/image/rights-image.tsx.
//
// IMPORTANT: status semantics are LOCKED here. CHECK_PER_ASSET sources
// must NEVER be promoted to APPROVED at the data layer. The decision
// to use an asset is set only by `publicationDecision()` at runtime,
// which requires an explicit license + license_url before allowing
// publication.

export type SourceStatus =
  | "APPROVED"
  | "ATTRIBUTION_REQUIRED"
  | "CHECK_PER_ASSET"
  | "BLOCKED";

export interface SourcePolicy {
  source_name: string;
  base_url: string;
  status: SourceStatus;
  commercial_use_allowed: boolean;
  editorial_use_allowed: boolean;
  attribution_required: boolean;
  download_allowed: boolean;
  hotlink_allowed: boolean;
  api_available: boolean;
  license_notes: string;
  terms_url: string;
  last_verified_at: string;
  metadata_cache_ttl_hours: number;
}

export type AssetState =
  | "ACTIVE"
  | "STALE"
  | "QUARANTINED_LICENSE"
  | "QUARANTINED_SOURCE";

export interface Asset {
  asset_id: string;
  source: string;
  source_page: string;
  image_url: string;
  author?: string;
  license?: string;
  license_url?: string;
  attribution?: string;
  width?: number;
  height?: number;
  player?: string;
  team?: string;
  competition?: string;
  tags: string[];
  last_verified_at: string;
  canonical_source_url: string;
  state: AssetState;
}

/**
 * Reasons `publicationDecision()` may refuse an asset.
 * Used by callers to render appropriate fallback UI.
 */
export type PublicationReason =
  | "blocked-source"
  | "rights-unresolved"
  | "QUARANTINED_LICENSE"
  | "QUARANTINED_SOURCE";

export interface PublicationDecisionResult {
  ok: boolean;
  reason: PublicationReason | "verified-metadata-present";
}

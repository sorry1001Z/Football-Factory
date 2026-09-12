// Football Factory — Banner Prompt Composer Types (Image System).
//
// Pure prompt-metadata contracts. NEVER:
//   - calls an image API
//   - generates a binary image
//   - evaluates image rights
//   - mutates BannerComposition
//
// The Prompt Composer sits DOWNSTREAM of the production Banner
// Composer. It receives a production `BannerComposition` (from
// `lib/image-system/banner-composer/`) and produces advisory prompt
// metadata for a future image generator. It does NOT decide which
// people are eligible; that authority lives in the Entity Freshness
// gate. REQUIRES_REVIEW / NOT_ELIGIBLE people from the production
// `excludedPeople` list MUST NOT enter the prompt.

import type {
  ArticleType,
  BannerPersonContext,
  VisualContext,
} from "./entity-freshness/types";

/**
 * The banner usage types the Prompt Composer supports. These map
 * 1:1 onto production ArticleType plus two renderer-friendly
 * shapes that consumers can map to their own image-asset channels.
 *
 *   HERO_BANNER       — site-wide hero / lead banner.
 *   NEWS_COVER        — news article cover image.
 *   ARTICLE_IMAGE     — inline editorial image inside an article body.
 *   BREAKING_NEWS     — urgent lead with breaking-news framing.
 *   TRANSFER_NEWS     — transfer context (split or careful framing).
 *   MATCH_NEWS        — matchday framing.
 *   HISTORICAL        — historical / archive framing.
 *   PROFILE           — profile / portrait framing.
 */
export type PromptBannerType =
  | "HERO_BANNER"
  | "NEWS_COVER"
  | "ARTICLE_IMAGE"
  | "BREAKING_NEWS"
  | "TRANSFER_NEWS"
  | "MATCH_NEWS"
  | "HISTORICAL"
  | "PROFILE";

/**
 * Style presets the future renderer can map to its own visual
 * presets. The Prompt Composer does NOT bind to a renderer; it
 * just emits the preset name in the prompt metadata.
 */
export type PromptStylePreset =
  | "PREMIUM_EDITORIAL"
  | "CINEMATIC_STADIUM"
  | "TRANSFER_SPLIT"
  | "BREAKING_NEWS"
  | "MATCHDAY"
  | "HISTORICAL_ARCHIVE"
  | "CLEAN_ARTICLE_EDITORIAL";

/**
 * Visual-context warnings the future renderer must respect when
 * composing an image. The Prompt Composer does NOT change
 * Entity Freshness decisions; it only ADDS advisory metadata
 * to the prompt output.
 */
export type PromptVisualWarning =
  | "DO_NOT_IMPLY_TARGET_IS_CURRENT"
  | "DO_NOT_IMPLY_FORMER_IS_CURRENT"
  | "DO_NOT_IMPLY_TRANSFER_COMPLETED"
  | "DO_NOT_IMPLY_TRANSFER_ALREADY_EFFECTIVE"
  | "DO_NOT_IMPLY_NEW_CLUB_BEFORE_EFFECTIVE"
  | "NON_PERSON_FALLBACK"
  | "UNCERTAIN_VISUAL_CONTEXT";

/**
 * One subject derived strictly from production
 * `BannerComposition.selectedPeople`. `visualContext` is preserved
 * VERBATIM from the production BannerPersonContext — the Prompt
 * Composer never reinterprets visual context.
 */
export interface PromptSubject {
  personId: string;
  displayName: string;
  role: BannerPersonContext["role"];
  visualContext: VisualContext;
  /** Optional display-only team label (NOT a rights-affecting source). */
  teamName?: string;
}

/**
 * Input the Hermes adapter hands to the Prompt Composer.
 *
 * The Prompt Composer MUST receive only:
 *   - composition.status
 *   - composition.selectedPeople (NEVER excludedPeople, NEVER raw roster)
 *
 * `transferStatus` and `transferEffective` are derived from the
 * PRODUCTION BannerComposition (the adapter inspects the per-person
 * audit + the article type) and passed explicitly so the composer
 * stays a pure transformation.
 */
export interface PromptComposerInput {
  /** Production BannerComposition.status */
  status: "READY" | "REQUIRES_REVIEW" | "NO_VALID_SUBJECTS";
  /** Strict subset of production BannerComposition.selectedPeople */
  people: readonly PromptSubject[];
  /** Display-only team label list (free-text, NOT a rights source). */
  teamContext?: readonly string[];
  /**
   * Production-derived transfer status for the article overall.
   * Hermes adapter derives this from BannerComposition.audit.
   */
  transferStatus?: "TRANSFER_PENDING" | "TRANSFER_CONFIRMED" | "NONE";
  /**
   * Production-derived transfer effective flag. True when the
   * transfer has actually become effective (date on or after
   * validFrom) per Entity Freshness truth table.
   */
  transferEffective?: boolean;
}

export interface PromptComposerOptions {
  type?: PromptBannerType;
  headline?: string;
  stylePreset?: PromptStylePreset;
}

/**
 * Output prompt metadata. Pure data — no functions, no I/O,
 * no rights implications. The future renderer may read this to
 * decide how to compose an image.
 */
export interface BannerPromptMetadata {
  /** Joined prompt text (advisory only). */
  prompt: string;
  /** Negative-prompt text — what the renderer must NOT do. */
  negativePrompt: string;
  aspectRatio: string;
  layout: string;
  textSafeZone: string;
  /** Strict subset of input.people (defensive copy). */
  people: readonly PromptSubject[];
  teamContext: readonly string[];
  /** Advisory warnings the renderer must respect. */
  visualWarnings: readonly PromptVisualWarning[];
  stylePreset: PromptStylePreset;
}
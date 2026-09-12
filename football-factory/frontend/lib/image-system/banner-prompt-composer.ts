// Football Factory — Banner Prompt Composer (Image System).
//
// Pure advisory prompt metadata. NEVER:
//   - calls an image API / network
//   - generates a binary image
//   - evaluates rights / publicationDecision()
//   - performs a roster lookup
//   - mutates its input
//
// The Prompt Composer sits DOWNSTREAM of `lib/image-system/banner-composer/`.
// The Hermes-owned `buildBannerPrompt` helper (in this file) is the
// single permitted entrypoint that bridges production BannerComposition
// to the pure `composeBannerPrompt` function. It guarantees:
//
//   1. The prompt input contains ONLY `composition.selectedPeople`.
//   2. REQUIRES_REVIEW / NOT_ELIGIBLE people never enter the prompt
//      (the production composer already filters them out of
//      selectedPeople; the adapter double-checks defensively).
//   3. `composition.excludedPeople` is NEVER read.
//   4. The visualContext of each person is preserved VERBATIM.
//   5. NO_VALID_SUBJECTS returns a non-person fallback with zero people.

import type { BannerComposition } from "./banner-composer/types";
import type {
  VisualContext,
} from "./entity-freshness/types";
import type {
  BannerPromptMetadata,
  PromptComposerInput,
  PromptComposerOptions,
  PromptStylePreset,
  PromptSubject,
  PromptVisualWarning,
  PromptBannerType,
} from "./banner-prompt-types";

// ----- Template tables --------------------------------------------------

/**
 * Per-banner-type template rules. All values are display-only
 * prompt metadata — no rights, no API bindings, no network.
 * `maxPeople` MUST never exceed 3 (matches production Banner
 * Composer's hard cap).
 */
interface TemplateRule {
  aspectRatio: string;
  layout: string;
  textSafeZone: string;
  maxPeople: number;
  preset: PromptStylePreset;
  headline: boolean;
}

const TEMPLATE_RULES: Readonly<Record<PromptBannerType, TemplateRule>> = Object.freeze({
  HERO_BANNER: {
    aspectRatio: "16:9",
    layout: "lead-subject-wide",
    textSafeZone: "left-or-right 36% protected",
    maxPeople: 3,
    preset: "PREMIUM_EDITORIAL",
    headline: true,
  },
  NEWS_COVER: {
    aspectRatio: "16:9",
    layout: "single-focus-card",
    textSafeZone: "top-left 28% protected",
    maxPeople: 2,
    preset: "PREMIUM_EDITORIAL",
    headline: true,
  },
  ARTICLE_IMAGE: {
    aspectRatio: "16:9",
    layout: "clean-editorial",
    textSafeZone: "caption-safe bottom edge",
    maxPeople: 3,
    preset: "CLEAN_ARTICLE_EDITORIAL",
    headline: false,
  },
  BREAKING_NEWS: {
    aspectRatio: "16:9",
    layout: "urgent-wide",
    textSafeZone: "left 34% protected",
    maxPeople: 2,
    preset: "BREAKING_NEWS",
    headline: true,
  },
  TRANSFER_NEWS: {
    aspectRatio: "16:9",
    layout: "split-context",
    textSafeZone: "center-top protected",
    maxPeople: 2,
    preset: "TRANSFER_SPLIT",
    headline: true,
  },
  MATCH_NEWS: {
    aspectRatio: "16:9",
    layout: "matchday-dual-focus",
    textSafeZone: "upper-center protected",
    maxPeople: 3,
    preset: "MATCHDAY",
    headline: true,
  },
  HISTORICAL: {
    aspectRatio: "16:9",
    layout: "archive-documentary",
    textSafeZone: "left 32% protected",
    maxPeople: 3,
    preset: "HISTORICAL_ARCHIVE",
    headline: true,
  },
  PROFILE: {
    aspectRatio: "4:5",
    layout: "portrait-profile",
    textSafeZone: "upper-left 24% protected",
    maxPeople: 1,
    preset: "PREMIUM_EDITORIAL",
    headline: true,
  },
});

const STYLE_PRESETS: Readonly<Record<PromptStylePreset, {
  lighting: string;
  tone: string;
  contrast: string;
}>> = Object.freeze({
  PREMIUM_EDITORIAL: {
    lighting: "clean premium editorial",
    tone: "authoritative",
    contrast: "high but natural",
  },
  CINEMATIC_STADIUM: {
    lighting: "cinematic stadium lighting",
    tone: "dramatic sports documentary",
    contrast: "strong",
  },
  TRANSFER_SPLIT: {
    lighting: "polished transfer-news lighting",
    tone: "careful transfer context",
    contrast: "strong split composition",
  },
  BREAKING_NEWS: {
    lighting: "urgent newsroom lighting",
    tone: "breaking editorial",
    contrast: "high",
  },
  MATCHDAY: {
    lighting: "floodlit matchday atmosphere",
    tone: "competitive",
    contrast: "crisp",
  },
  HISTORICAL_ARCHIVE: {
    lighting: "archival documentary lighting",
    tone: "historical",
    contrast: "restrained",
  },
  CLEAN_ARTICLE_EDITORIAL: {
    lighting: "natural editorial lighting",
    tone: "clean reportage",
    contrast: "moderate",
  },
});

const ALLOWED_VISUAL_CONTEXTS: ReadonlySet<VisualContext> = new Set<VisualContext>([
  "CURRENT_CLUB",
  "NEW_CLUB",
  "TARGET_CLUB",
  "FORMER_CLUB",
  "PROFILE_SUBJECT",
  "HISTORICAL_SUBJECT",
  "MATCH_SUBJECT",
]);

const MAX_HEADLINE_WORDS = 7;

// ----- Pure helpers ------------------------------------------------------

/**
 * Build the joined prompt body for the people in the composition.
 * Pure transformation. No network. No rights.
 */
function peopleText(people: readonly PromptSubject[]): string {
  return people
    .map((p) => {
      const ctx = ALLOWED_VISUAL_CONTEXTS.has(p.visualContext)
        ? p.visualContext
        : "UNKNOWN";
      const team = p.teamName ? `; team=${p.teamName}` : "";
      return `${p.displayName} [${p.role}; visualContext=${ctx}${team}]`;
    })
    .join(", ");
}

/**
 * Shorten a headline to the prompt metadata budget. Pure. Trims
 * whitespace and slices to MAX_HEADLINE_WORDS words. Returns an
 * empty string when the headline is absent or whitespace-only.
 */
function safeHeadline(headline: string | undefined): string {
  if (!headline) return "";
  return String(headline)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_HEADLINE_WORDS)
    .join(" ");
}

/**
 * Derive advisory warnings from the people + transferStatus.
 *
 * The Prompt Composer does NOT reinterpret any visualContext.
 * It only ADDS warnings when a person carries a context that the
 * renderer must not paint as "current". Warnings are prompt
 * metadata only — they MUST NOT be read by Entity Freshness.
 */
function deriveWarnings(
  people: readonly PromptSubject[],
  input: PromptComposerInput,
): readonly PromptVisualWarning[] {
  const warnings: PromptVisualWarning[] = [];
  for (const p of people) {
    if (!ALLOWED_VISUAL_CONTEXTS.has(p.visualContext)) {
      warnings.push("UNCERTAIN_VISUAL_CONTEXT");
    }
    if (p.visualContext === "TARGET_CLUB") {
      warnings.push("DO_NOT_IMPLY_TARGET_IS_CURRENT");
    }
    if (p.visualContext === "FORMER_CLUB") {
      warnings.push("DO_NOT_IMPLY_FORMER_IS_CURRENT");
    }
  }
  if (input.transferStatus === "TRANSFER_PENDING") {
    warnings.push("DO_NOT_IMPLY_TRANSFER_COMPLETED");
  }
  if (
    input.transferStatus === "TRANSFER_CONFIRMED" &&
    input.transferEffective === false
  ) {
    warnings.push("DO_NOT_IMPLY_TRANSFER_ALREADY_EFFECTIVE");
    warnings.push("DO_NOT_IMPLY_NEW_CLUB_BEFORE_EFFECTIVE");
  }
  // Deduplicate while preserving order.
  return [...new Set(warnings)];
}

// ----- Public pure function ----------------------------------------------

/**
 * Compose prompt metadata from an already-filtered composition
 * input. Pure. Never mutates its input. Never selects people
 * (that authority lives in production `banner-composer/compose.ts`).
 *
 * Caller MUST guarantee `input.people` is the strict subset of
 * `BannerComposition.selectedPeople` (and nothing else). The
 * Hermes-owned `buildBannerPrompt` adapter in this file is the
 * single recommended entrypoint; direct use of this function is
 * allowed only for tests.
 */
export function composeBannerPrompt(
  input: PromptComposerInput,
  options: PromptComposerOptions = {},
): BannerPromptMetadata {
  const bannerType: PromptBannerType = options.type ?? "HERO_BANNER";
  const rule = TEMPLATE_RULES[bannerType];
  if (!rule) {
    throw new TypeError("UNSUPPORTED_BANNER_TYPE");
  }

  // Defensive shallow copy — never mutate caller arrays.
  const people: readonly PromptSubject[] = input.people
    .slice(0, rule.maxPeople)
    .map((p) => ({ ...p }));

  const visualWarnings = deriveWarnings(people, input);

  const presetName: PromptStylePreset =
    options.stylePreset && STYLE_PRESETS[options.stylePreset]
      ? options.stylePreset
      : rule.preset;
  const preset = STYLE_PRESETS[presetName];

  const teamContext = [...new Set((input.teamContext ?? []).map(String))];
  const shortHeadline = safeHeadline(options.headline);

  // ----- Fallback path: NO_VALID_SUBJECTS or zero people ---------------
  if (input.status === "NO_VALID_SUBJECTS" || people.length === 0) {
    return {
      prompt: [
        `Football Factory ${bannerType.toLowerCase().replaceAll("_", " ")} fallback`,
        "non-person sports editorial composition",
        "stadium architecture, football, crowd atmosphere, competition or club graphic context where supplied",
        `${preset.lighting}, ${preset.tone}`,
        `layout=${rule.layout}; text-safe-zone=${rule.textSafeZone}`,
        "mobile crop protection: keep key graphic elements inside central 70%",
        "do not inject famous players or managers",
      ].join(". "),
      negativePrompt:
        "unverified people, celebrity injection, misleading transfer confirmation",
      aspectRatio: rule.aspectRatio,
      layout: rule.layout,
      textSafeZone: rule.textSafeZone,
      people: [],
      teamContext,
      visualWarnings: [...visualWarnings, "NON_PERSON_FALLBACK"],
      stylePreset: presetName,
    };
  }

  // ----- Normal path: people are present -------------------------------
  const headlinePart =
    rule.headline && shortHeadline
      ? `short headline metadata="${shortHeadline}"`
      : "no oversized headline; preserve clean editorial composition";

  const transferPart =
    input.transferStatus === "TRANSFER_PENDING"
      ? "transfer remains pending; visually distinguish current-club and target-club context without implying completion"
      : input.transferStatus === "TRANSFER_CONFIRMED" &&
          input.transferEffective === false
        ? "transfer confirmed but not yet effective; avoid depicting target/new club as already current"
        : "";

  const prompt = [
    `Football Factory ${bannerType.toLowerCase().replaceAll("_", " ")}`,
    `approved contextual people: ${peopleText(people)}`,
    teamContext.length
      ? `team context: ${teamContext.join(", ")}`
      : "no team context supplied",
    `${preset.lighting}; ${preset.tone}; ${preset.contrast} contrast`,
    `layout=${rule.layout}; aspect=${rule.aspectRatio}`,
    `text-safe-zone=${rule.textSafeZone}`,
    headlinePart,
    "mobile crop protection: keep faces and essential identity cues inside central 70%",
    transferPart,
  ]
    .filter(Boolean)
    .join(". ");

  return {
    prompt,
    negativePrompt:
      "invented team membership, fabricated transfer completion, misleading quote text, unapproved extra people",
    aspectRatio: rule.aspectRatio,
    layout: rule.layout,
    textSafeZone: rule.textSafeZone,
    people: people.map((x) => ({
      personId: x.personId,
      displayName: x.displayName,
      role: x.role,
      visualContext: x.visualContext,
      teamName: x.teamName,
    })),
    teamContext,
    visualWarnings,
    stylePreset: presetName,
  };
}

// ----- Hermes-owned adapter ---------------------------------------------

/**
 * Pure helper to fetch a template rule (used by tests + future
 * callers that want to inspect the rule table without composing).
 */
export function getTemplateRule(type: PromptBannerType): TemplateRule | null {
  return TEMPLATE_RULES[type] ?? null;
}

/**
 * Pure helper to fetch a style preset descriptor (used by tests).
 */
export function getStylePreset(name: PromptStylePreset): {
  lighting: string;
  tone: string;
  contrast: string;
} | null {
  return STYLE_PRESETS[name] ?? null;
}

/**
 * Hermes-owned adapter. The ONLY public entrypoint that callers
 * should use in production. It guarantees the Prompt Composer
 * receives only `selectedPeople` and never `excludedPeople`,
 * REQUIRES_REVIEW people, or NOT_ELIGIBLE people.
 *
 * Production `BannerComposition.selectedPeople` is already filtered
 * by the Entity Freshness gate — every entry is `decision ===
 * "ELIGIBLE"`. The adapter defensively re-checks the audit trail
 * and rejects any `selectedPeople` entry whose corresponding
 * `audit[]` record is REQUIRES_REVIEW or NOT_ELIGIBLE (defense in
 * depth — production should already guarantee this).
 */
export function buildBannerPrompt(
  composition: BannerComposition,
  options: PromptComposerOptions = {},
): BannerPromptMetadata {
  if (!composition) {
    throw new TypeError("MISSING_BANNER_COMPOSITION");
  }

  // Map selectedPeople into the strict PromptSubject shape. We
  // never carry forward any field that could leak rights-related
  // metadata; `displayName` is display-only.
  const subjects: PromptSubject[] = composition.selectedPeople
    .filter((person) => {
      const audit = composition.audit.find((a) => a.personId === person.personId);
      if (!audit) return true; // No audit entry — trust the composer contract.
      return audit.decision === "ELIGIBLE";
    })
    .map((person) => ({
      personId: person.personId,
      displayName: person.displayName ?? person.personId,
      role: person.role,
      visualContext: person.visualContext,
    }));

  // Derive overall transferStatus + transferEffective from the
  // production audit. The Hermes adapter is authoritative for
  // this derivation (it is a pure projection of Entity Freshness
  // decisions); the Prompt Composer itself does not perform
  // eligibility evaluation.
  let transferStatus: PromptComposerInput["transferStatus"] = "NONE";
  let transferEffective: boolean | undefined;
  let firstTransferHit = false;
  for (const audit of composition.audit) {
    if (audit.relationshipStatus === "TRANSFER_PENDING") {
      transferStatus = "TRANSFER_PENDING";
      firstTransferHit = true;
      break;
    }
    if (audit.relationshipStatus === "TRANSFER_CONFIRMED") {
      transferStatus = "TRANSFER_CONFIRMED";
      firstTransferHit = true;
      // effective = person.visualContext === NEW_CLUB (this is the
      // exact truth-table mapping the production gate emits).
      const person = composition.selectedPeople.find(
        (p) => p.personId === audit.personId,
      );
      transferEffective = person?.visualContext === "NEW_CLUB";
      break;
    }
  }
  if (!firstTransferHit) {
    transferStatus = "NONE";
    transferEffective = undefined;
  }

  // Defense in depth: explicitly drop any subject whose
  // visualContext came from REQUIRES_REVIEW/NOT_ELIGIBLE. The
  // production composer already filters those out of selectedPeople,
  // but if a future bug let one through we still refuse to forward
  // it. Note: TARGET_CLUB / FORMER_CLUB / CURRENT_CLUB / NEW_CLUB /
  // PROFILE_SUBJECT / HISTORICAL_SUBJECT / MATCH_SUBJECT are all
  // ALLOWED — they are valid output visualContexts from the
  // production composer.
  const safeSubjects = subjects.filter((s) =>
    ALLOWED_VISUAL_CONTEXTS.has(s.visualContext),
  );

  return composeBannerPrompt(
    {
      status: composition.status,
      people: safeSubjects,
      teamContext: composition.teamIds.map(String),
      transferStatus,
      transferEffective,
    },
    options,
  );
}
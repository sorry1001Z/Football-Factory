// Football Factory — SEO V3 Suggestion contract (Wave B).
//
// A unified shape that future admin/editorial surfaces can use to
// render both intent-classification results and internal-link
// suggestions in a single panel.
//
// This contract is TYPE-ONLY here. No wiring into Admin UI in
// this wave. The contract is purely a typed convenience for
// future slices that want to surface Wave B output.

import type { IntentClassification } from "./intent";
import type { InternalLinkSuggestion } from "./internal-links";

export type SuggestionType = "intent" | "internal_link";
export type SuggestionSeverity = "info" | "opportunity" | "warning";

export interface SeoSuggestion {
  /** Type of suggestion. */
  type: SuggestionType;
  /** Severity classification. */
  severity: SuggestionSeverity;
  /** Human-readable message. */
  message: string;
  /** 0..1 confidence. Always present. */
  confidence: number;
  /**
   * Free-form payload. For `intent`, this is the
   * `IntentClassification` object. For `internal_link`, this
   * is the `InternalLinkSuggestion` object.
   */
  data: IntentClassification | InternalLinkSuggestion;
}

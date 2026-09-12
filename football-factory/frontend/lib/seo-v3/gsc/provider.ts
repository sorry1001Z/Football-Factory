// Football Factory — SEO V3 SearchMetricsProvider contract (Wave D).
//
// Generic provider interface. Implementations can be fixture, mock,
// or production-shaped. The provider never throws — invalid input
// is returned as a structured error in the result envelope so callers
// can decide what to do.

import type {
  GetMetricsParams,
  GetMetricsResult,
  MetricDimension,
  MetricFilterField,
} from "./types";

/** Maximum pageSize cap. Providers may enforce a stricter cap. */
export const MAX_PAGE_SIZE = 10_000;
/** Default pageSize when the caller does not specify one. */
export const DEFAULT_PAGE_SIZE = 1_000;

export const SUPPORTED_DIMENSIONS: readonly MetricDimension[] = [
  "query",
  "page",
  "date",
  "country",
  "device",
];

export const SUPPORTED_FILTER_FIELDS: readonly MetricFilterField[] = [
  "query",
  "page",
  "country",
  "device",
  "pageType",
  "indexState",
];

export interface ProviderError {
  ok: false;
  code:
    | "INVALID_DATE_FORMAT"
    | "INVALID_DATE_RANGE"
    | "EMPTY_RANGE"
    | "UNSUPPORTED_DIMENSION"
    | "UNSUPPORTED_FILTER_FIELD"
    | "PAGE_SIZE_TOO_LARGE"
    | "PAGE_SIZE_NEGATIVE"
    | "EMPTY_SITE"
    | "PROVIDER_ERROR";
  message: string;
}

export type ProviderResult = GetMetricsResult | ProviderError;

export interface SearchMetricsProvider {
  getMetrics(params: GetMetricsParams): Promise<ProviderResult>;
}

/**
 * Validate the common parameters shared by every provider. Returns
 * `null` on success or a structured `ProviderError` describing the
 * first failure encountered. Pure; never throws.
 */
export function validateGetMetricsParams(
  params: GetMetricsParams,
): ProviderError | null {
  if (!params || typeof params.site !== "string" || params.site.trim() === "") {
    return {
      ok: false,
      code: "EMPTY_SITE",
      message: "site is required",
    };
  }
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  if (!ISO_DATE.test(params.dateFrom) || !ISO_DATE.test(params.dateTo)) {
    return {
      ok: false,
      code: "INVALID_DATE_FORMAT",
      message: "dateFrom / dateTo must be ISO 8601 dates (YYYY-MM-DD)",
    };
  }
  if (params.dateFrom > params.dateTo) {
    return {
      ok: false,
      code: "INVALID_DATE_RANGE",
      message: `dateFrom ${params.dateFrom} is after dateTo ${params.dateTo}`,
    };
  }
  if (params.dateFrom === params.dateTo) {
    return {
      ok: false,
      code: "EMPTY_RANGE",
      message: "dateFrom must be strictly before dateTo",
    };
  }
  if (params.pageSize !== undefined) {
    if (typeof params.pageSize !== "number" || !Number.isFinite(params.pageSize)) {
      return {
        ok: false,
        code: "PAGE_SIZE_NEGATIVE",
        message: "pageSize must be a finite number",
      };
    }
    if (params.pageSize <= 0) {
      return {
        ok: false,
        code: "PAGE_SIZE_NEGATIVE",
        message: "pageSize must be > 0",
      };
    }
    if (params.pageSize > MAX_PAGE_SIZE) {
      return {
        ok: false,
        code: "PAGE_SIZE_TOO_LARGE",
        message: `pageSize ${params.pageSize} exceeds MAX_PAGE_SIZE ${MAX_PAGE_SIZE}`,
      };
    }
  }
  if (params.dimensions) {
    for (const d of params.dimensions) {
      if (!SUPPORTED_DIMENSIONS.includes(d)) {
        return {
          ok: false,
          code: "UNSUPPORTED_DIMENSION",
          message: `unsupported dimension: ${d}`,
        };
      }
    }
  }
  if (params.filters) {
    for (const f of params.filters) {
      if (!SUPPORTED_FILTER_FIELDS.includes(f.field)) {
        return {
          ok: false,
          code: "UNSUPPORTED_FILTER_FIELD",
          message: `unsupported filter field: ${f.field}`,
        };
      }
    }
  }
  return null;
}

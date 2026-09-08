// Football Factory — WPGraphQL client (Phase 2)
// Server-only module. The `server-only` marker is loaded only in the
// Next.js server bundle path; in plain Node test runs (via
// `node --conditions=react-server`) the import resolves to its
// no-op `empty.js` entry so the class and error types below are
// available to the test runner.
import "server-only";

const DEFAULT_TIMEOUT_MS = 8_000;

export type WordPressClientErrorKind =
  | "UNCONFIGURED"
  | "TIMEOUT"
  | "NETWORK"
  | "HTTP_ERROR"
  | "GRAPHQL_ERROR"
  | "INVALID_PAYLOAD";

export class WordPressClientError extends Error {
  readonly kind: WordPressClientErrorKind;
  readonly http_status: number | null;
  /** Public-safe error message. Never contains the URL, never contains
   *  the GraphQL query, never contains user data. */
  readonly safe_message: string;
  constructor(
    kind: WordPressClientErrorKind,
    safe_message: string,
    options: { http_status?: number | null; cause?: unknown } = {},
  ) {
    super(safe_message);
    this.name = "WordPressClientError";
    this.kind = kind;
    this.http_status = options.http_status ?? null;
    this.safe_message = safe_message;
  }
  toJSON(): unknown {
    return {
      kind: this.kind,
      safe_message: this.safe_message,
      http_status: this.http_status,
    };
  }
}

export interface WordPressRequestOptions {
  query: string;
  variables?: Record<string, unknown>;
  timeout_ms?: number;
  fetchImpl?: typeof fetch;
}

export interface WordPressClientOptions {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  default_timeout_ms?: number;
}

export class WordPressClient {
  private readonly endpoint: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly default_timeout_ms: number;

  constructor(options: WordPressClientOptions = {}) {
    const envEndpoint =
      typeof process !== "undefined" && process.env
        ? process.env.WORDPRESS_GRAPHQL_URL
        : undefined;
    this.endpoint = (options.endpoint ?? envEndpoint ?? "").trim() || null;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.default_timeout_ms =
      options.default_timeout_ms ?? DEFAULT_TIMEOUT_MS;
  }

  /** True if a non-empty endpoint is configured. */
  get configured(): boolean {
    return Boolean(this.endpoint);
  }

  /** Returns the configured endpoint host portion for safe diagnostics.
   *  Never returns the full URL (path/query) and never returns credentials. */
  get endpoint_host(): string | null {
    if (!this.endpoint) return null;
    try {
      const u = new URL(this.endpoint);
      return u.host;
    } catch {
      return null;
    }
  }

  /**
   * Safe JSON serialization. Returns ONLY a minimal diagnostic shape.
   * Never includes the full endpoint URL (which may carry a query-string
   * token or other credential), the fetch implementation, or any
   * request-time state. Use `endpoint_host` for safe host diagnostics.
   */
  toJSON(): unknown {
    return {
      provider: "wpgraphql",
      configured: this.configured,
      endpoint_host: this.endpoint_host,
    };
  }

  async request<T>(opts: WordPressRequestOptions): Promise<T> {
    if (!this.endpoint) {
      throw new WordPressClientError(
        "UNCONFIGURED",
        "WordPress endpoint is not configured",
      );
    }
    if (!opts.query || typeof opts.query !== "string") {
      throw new WordPressClientError(
        "INVALID_PAYLOAD",
        "GraphQL query must be a non-empty string",
      );
    }
    const variables = opts.variables ?? {};
    const timeout_ms = opts.timeout_ms ?? this.default_timeout_ms;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout_ms);
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: opts.query, variables }),
        signal: controller.signal,
      });
    } catch (err) {
      const isAbort =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err as { name?: string } | null)?.name === "AbortError";
      if (isAbort) {
        throw new WordPressClientError(
          "TIMEOUT",
          `WordPress request timed out after ${timeout_ms}ms`,
          { cause: err },
        );
      }
      throw new WordPressClientError(
        "NETWORK",
        "WordPress request failed",
        { cause: err },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new WordPressClientError(
        "HTTP_ERROR",
        `WordPress returned HTTP ${response.status}`,
        { http_status: response.status },
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (err) {
      throw new WordPressClientError(
        "INVALID_PAYLOAD",
        "WordPress response is not valid JSON",
        { cause: err },
      );
    }
    if (!isPlainObject(json)) {
      throw new WordPressClientError(
        "INVALID_PAYLOAD",
        "WordPress response is not a JSON object",
      );
    }
    const errors = (json as { errors?: unknown }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      throw new WordPressClientError(
        "GRAPHQL_ERROR",
        "WordPress GraphQL returned an error",
      );
    }
    const data = (json as { data?: unknown }).data;
    if (data === null || data === undefined) {
      throw new WordPressClientError(
        "INVALID_PAYLOAD",
        "WordPress GraphQL response has no data field",
      );
    }
    return data as T;
  }
}

// ----- helpers ---------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

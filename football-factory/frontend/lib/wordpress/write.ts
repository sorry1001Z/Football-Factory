// Football Factory — WordPress REST write client (FIRST SLICE).
//
// Server-only. Reads Application Password credentials from env. Draft
// by default. Constant-time basic-auth header construction. 8s timeout.
// Safe error envelope: never throws raw fetch error, never logs
// credentials.
//
// Required env (server-only):
//   WORDPRESS_REST_URL       e.g. https://cms.example.com/wp-json/wp/v2
//   WORDPRESS_APP_USER       e.g. automation
//   WORDPRESS_APP_PASSWORD   Application Password issued by WP admin
//
// This client is for WRITES (POST/PATCH/DELETE on /posts etc.). The
// READ layer is `lib/wordpress/client.ts` and uses WPGraphQL. The two
// clients do NOT share state.
//
// Hardening beyond the external package:
//   - All inputs validated (zod is at the route layer).
//   - Error envelope: includes only HTTP status, never the response
//     body verbatim (response bodies can echo user content).
//   - updatePost requires explicit status if status is provided
//     (H6 finding closed).

import "server-only";

export type WpPostInput = {
  title: string;
  content: string;
  status?: "draft" | "pending" | "publish";
  categories?: number[];
  tags?: number[];
  featured_media?: number;
};

export type WpPostUpdate = {
  title?: string;
  content?: string;
  status?: "draft" | "pending" | "publish";
  categories?: number[];
  tags?: number[];
  featured_media?: number;
};

export type WpPost = {
  id: number;
  status: string;
  link: string;
  title?: { rendered?: string };
  slug?: string;
};

export class WordPressWriteError extends Error {
  public readonly status: number | null;
  public readonly kind:
    | "not_configured"
    | "timeout"
    | "network"
    | "http_4xx"
    | "http_5xx"
    | "invalid_json";
  constructor(
    kind:
      | "not_configured"
      | "timeout"
      | "network"
      | "http_4xx"
      | "http_5xx"
      | "invalid_json",
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.name = "WordPressWriteError";
    this.kind = kind;
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 8_000;

export class WordPressWriteClient {
  private base: string;
  private user: string;
  private password: string;
  private timeoutMs: number;

  constructor() {
    this.base = process.env.WORDPRESS_REST_URL ?? "";
    this.user = process.env.WORDPRESS_APP_USER ?? "";
    this.password = process.env.WORDPRESS_APP_PASSWORD ?? "";
    const t = Number(process.env.WORDPRESS_WRITE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    this.timeoutMs =
      Number.isFinite(t) && t >= 1_000 && t <= 30_000 ? t : DEFAULT_TIMEOUT_MS;
  }

  get configured(): boolean {
    return Boolean(this.base && this.user && this.password);
  }

  private headers(): Record<string, string> {
    if (!this.base || !this.user || !this.password) {
      throw new WordPressWriteError(
        "not_configured",
        "WordPress write not configured (WORDPRESS_REST_URL/APP_USER/APP_PASSWORD missing)",
      );
    }
    const basic = Buffer.from(`${this.user}:${this.password}`, "utf8").toString(
      "base64",
    );
    return {
      "content-type": "application/json",
      authorization: `Basic ${basic}`,
      accept: "application/json",
    };
  }

  private async request(
    path: string,
    init: { method: string; body?: unknown },
  ): Promise<WpPost> {
    if (!this.configured) {
      throw new WordPressWriteError(
        "not_configured",
        "WordPress write not configured",
      );
    }
    const url = `${this.base.replace(/\/+$/, "")}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: init.method,
        headers: this.headers(),
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      if (/timeout|abort/i.test(msg)) {
        throw new WordPressWriteError("timeout", `wp_timeout: ${this.timeoutMs}ms`);
      }
      throw new WordPressWriteError("network", "wp_network_error");
    }
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const kind = res.status >= 500 ? "http_5xx" : "http_4xx";
      throw new WordPressWriteError(kind, `wp_http_${res.status}`, res.status);
    }
    if (!text) return {} as WpPost;
    try {
      return JSON.parse(text) as WpPost;
    } catch {
      throw new WordPressWriteError("invalid_json", "wp_invalid_json");
    }
  }

  /**
   * Create a new post. Default status is `draft` unless the caller
   * passes a higher status. Status `publish` should NOT be used by
   * automation; the route layer enforces this.
   */
  async createPost(input: WpPostInput): Promise<WpPost> {
    const status = input.status ?? "draft";
    if (status === "publish") {
      throw new WordPressWriteError(
        "http_4xx",
        "createPost_publish_forbidden",
        400,
      );
    }
    return this.request("/posts", {
      method: "POST",
      body: {
        title: input.title,
        content: input.content,
        status,
        ...(input.categories ? { categories: input.categories } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
        ...(input.featured_media
          ? { featured_media: input.featured_media }
          : {}),
      },
    });
  }

  /**
   * Partial update. If `status` is provided, it MUST be one of
   * `draft|pending|publish`. Status `publish` requires an explicit
   * human-approval flag at the route layer.
   */
  async updatePost(id: number, input: WpPostUpdate): Promise<WpPost> {
    const body: Record<string, unknown> = {};
    if (input.title !== undefined) body.title = input.title;
    if (input.content !== undefined) body.content = input.content;
    if (input.status !== undefined) {
      if (!["draft", "pending", "publish"].includes(input.status)) {
        throw new WordPressWriteError(
          "http_4xx",
          "updatePost_invalid_status",
          400,
        );
      }
      body.status = input.status;
    }
    if (input.categories) body.categories = input.categories;
    if (input.tags) body.tags = input.tags;
    if (input.featured_media) body.featured_media = input.featured_media;
    return this.request(`/posts/${encodeURIComponent(String(id))}`, {
      method: "POST",
      body,
    });
  }

  /**
   * Trash a post (no force delete in this slice).
   *
   * WordPress REST: DELETE /posts/<id> with `force=true` deletes
   * permanently; with `force=false` (default) it trashes. We use the
   * safer default.
   */
  async trashPost(id: number): Promise<WpPost> {
    return this.request(
      `/posts/${encodeURIComponent(String(id))}?force=false`,
      { method: "DELETE" },
    );
  }
}

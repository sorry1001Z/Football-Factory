"use client";

// Football Factory — Client-bound analytics trackers (R2 Wave 2D).
//
// All trackers are NO-OP safe: when no provider is configured or
// consent is unknown, the useEffect body emits zero network
// calls. The trackers are intentionally small so the client
// bundle stays lean.

import { useEffect } from "react";
import {
  getAnalyticsProvider,
  trackEvent,
  type AnalyticsEvent,
} from "./provider";

/**
 * Tracks a single `page_view` for the current route on mount. Pass
 * `path` explicitly when the rendered path differs from the URL
 * (e.g. when the route is gated by middleware).
 */
export function PageViewTracker({
  path,
}: {
  path: string;
}) {
  useEffect(() => {
    const event: AnalyticsEvent = { name: "page_view", path };
    trackEvent(getAnalyticsProvider(), event);
  }, [path]);
  return null;
}

/**
 * Tracks a single `article_view` when an article is rendered.
 */
export function ArticleViewTracker({ id }: { id: string }) {
  useEffect(() => {
    if (!id) return;
    const event: AnalyticsEvent = {
      name: "article_view",
      entityId: id,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    };
    trackEvent(getAnalyticsProvider(), event);
  }, [id]);
  return null;
}

/**
 * Tracks a single `search` event when a query is non-empty. Does
 * NOT track empty queries (avoids spurious "search null" events).
 */
export function SearchEventTracker({ query }: { query: string }) {
  useEffect(() => {
    if (!query) return;
    const event: AnalyticsEvent = { name: "search", query };
    trackEvent(getAnalyticsProvider(), event);
  }, [query]);
  return null;
}

/**
 * Tracks a single `team_view` event when the team hub page mounts.
 */
export function TeamViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;
    const event: AnalyticsEvent = {
      name: "team_view",
      entityId: `team:${slug}`,
    };
    trackEvent(getAnalyticsProvider(), event);
  }, [slug]);
  return null;
}

/**
 * Tracks a single `competition_view` event when the competition
 * hub page mounts.
 */
export function CompetitionViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;
    const event: AnalyticsEvent = {
      name: "competition_view",
      entityId: `competition:${slug}`,
    };
    trackEvent(getAnalyticsProvider(), event);
  }, [slug]);
  return null;
}

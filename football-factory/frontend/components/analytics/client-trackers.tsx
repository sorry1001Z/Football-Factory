"use client";

// Football Factory — Narrow client wrapper around PageViewTracker.
//
// Server components can't call `useEffect`. The PageViewTracker
// itself is a client component; this wrapper lets a server
// component (`<HomePage>`) compose the tracker without converting
// itself to a client component.

import { PageViewTracker } from "@/lib/analytics/trackers";

export function HomeAnalytics() {
  return <PageViewTracker path="/" />;
}

export function NewsAnalytics() {
  return <PageViewTracker path="/news" />;
}

export function SearchAnalytics({ q }: { q: string }) {
  return <PageViewTracker path="/search" />;
}

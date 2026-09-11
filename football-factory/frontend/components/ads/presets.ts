// Football Factory — Ad preset configurations (R2 Wave 2D).
//
// Kept in a separate file so that consumers of AdSlot don't pull
// the preset map into their module evaluation order. The
// presets themselves are disabled-by-default and consent-required
// — they describe reserved dimensions only.

import type { AdConfig, Placement } from "./ad-slot";

export const AD_PRESETS: Record<Placement, AdConfig> = {
  leaderboard: {
    id: "ad-leaderboard-home",
    placement: "leaderboard",
    enabled: false,
    consentRequired: true,
    width: 970,
    height: 90,
    mobileWidth: 320,
    mobileHeight: 50,
  },
  "hero-sponsor": {
    id: "ad-hero-sponsor",
    placement: "hero-sponsor",
    enabled: false,
    consentRequired: true,
    width: 728,
    height: 90,
    mobileWidth: 320,
    mobileHeight: 50,
  },
  "in-feed": {
    id: "ad-in-feed",
    placement: "in-feed",
    enabled: false,
    consentRequired: true,
    width: 728,
    height: 90,
    mobileWidth: 320,
    mobileHeight: 50,
  },
  "article-inline": {
    id: "ad-article-inline",
    placement: "article-inline",
    enabled: false,
    consentRequired: true,
    width: 728,
    height: 90,
    mobileWidth: 320,
    mobileHeight: 50,
  },
  sidebar: {
    id: "ad-sidebar",
    placement: "sidebar",
    enabled: false,
    consentRequired: true,
    width: 300,
    height: 250,
    mobileWidth: 300,
    mobileHeight: 250,
  },
  "footer-sponsor": {
    id: "ad-footer-sponsor",
    placement: "footer-sponsor",
    enabled: false,
    consentRequired: true,
    width: 970,
    height: 90,
    mobileWidth: 320,
    mobileHeight: 50,
  },
};

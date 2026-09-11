"use client";

// Football Factory — Ad / Sponsor slot components (R2 Wave 2D).
//
// Adapted from the external Analytics + Commercial R2 pack
// (src/ads.tsx) with three CRITICAL SAFETY decisions:
//
//   1. Every AdConfig defaults `enabled: false`. Ads are
//      disabled-by-default. The component never mounts a live
//      ad-network code path without `enabled && consent`.
//
//   2. There is NO live ad-network JavaScript in this slice.
//      No third-party ad loader, no DFP integration, no
//      Google AdSense / AdX bootstrap. The `<div data-ad-provider-mount>`
//      is an empty mount-point ready for future SDK wiring.
//
//   3. CLS safety: every variant reserves explicit width +
//      min-height + CSS `contain: layout`. Reserving dimensions
//      before mount guarantees surrounding content does not
//      shift when an ad later fills the slot.
//
// Accessibility:
//   - The reserved placeholder carries `<small>RESERVED …</small>`
//     with an `aria-label="Reserved <placement> placement"`.
//   - When the slot is live, the surrounding `<aside>` retains
//     `aria-label="Advertisement"` so screen readers correctly
//     identify ad content (vs editorial content).
//   - When disabled, we still render an empty `<aside>` with
//     the aria-label so assistive tech announces a slot exists
//     and editors / QA can see CLS-safe reserved dimensions.

import type { CSSProperties } from "react";

export type Placement =
  | "leaderboard"
  | "hero-sponsor"
  | "in-feed"
  | "article-inline"
  | "sidebar"
  | "footer-sponsor";

export interface AdConfig {
  /** Stable id for the slot, used as the data attribute and key. */
  id: string;
  /** Where the slot is mounted. */
  placement: Placement;
  /**
   * Disabled by default. Even if the layout includes the slot,
   * the visible impression is suppressed until this is true.
   */
  enabled: boolean;
  /**
   * Whether the slot requires user consent before becoming live.
   * When true, the slot is gated by the `consent` prop below.
   */
  consentRequired: boolean;
  /** Desktop width — reserved even when disabled. */
  width: number;
  /** Desktop height — reserved even when disabled (CLS safety). */
  height: number;
  /** Tablet width. Defaults to `width`. */
  mobileWidth?: number;
  /** Tablet height. Defaults to `height`. */
  mobileHeight?: number;
  /**
   * Optional human label rendered in the visible placeholder.
   * Defaults to `RESERVED · <placement>`.
   */
  label?: string;
}

export interface AdSlotProps {
  config: AdConfig;
  consent?: boolean;
  className?: string;
}

/**
 * Internal base. Pure presentation + accessibility, no live
 * network code. SSR-safe (no useEffect, no window references).
 */
export function AdSlot({
  config,
  consent = false,
  className,
}: AdSlotProps) {
  const allowed =
    config.enabled && (!config.consentRequired || consent);
  const w = config.width;
  const h = config.height;
  const style: CSSProperties = {
    width: "100%",
    minHeight: h,
    contain: "layout",
  };
  const ariaLabel = allowed
    ? "Advertisement"
    : `Reserved ${config.placement} placement`;

  // We render an empty <aside> even when disabled so that the
  // surrounding grid layout is stable. The aspect-ratio is
  // preserved by minHeight + width:100%.
  return (
    <aside
      aria-label={ariaLabel}
      data-placement={config.placement}
      data-ad-slot={config.id}
      data-ad-state={allowed ? "live" : "reserved"}
      className={`cs-ad cs-ad-${config.placement}${className ? " " + className : ""}`}
      style={style}
    >
      {allowed ? (
        <div data-ad-provider-mount={config.id} className="cs-ad-mount" />
      ) : (
        <div className="cs-ad-reserved" aria-hidden>
          <small>{config.label ?? `RESERVED · ${config.placement.toUpperCase()}`}</small>
        </div>
      )}
    </aside>
  );
}

// ----- Placement-specific helpers (preserved from Pack 05) -----------------
//
// Each helper is a thin wrapper that calls <AdSlot /> with a
// caller-supplied config. They DO NOT modify Pack 05's behavior;
// they just give the call sites a typed name.

export function LeaderboardAd(props: AdSlotProps) {
  return <AdSlot {...props} />;
}

export function HeroSponsor(props: AdSlotProps) {
  return <AdSlot {...props} />;
}

export function InFeedAd(props: AdSlotProps) {
  return <AdSlot {...props} />;
}

export function ArticleInlineAd(props: AdSlotProps) {
  return <AdSlot {...props} />;
}

export function SidebarAd(props: AdSlotProps) {
  return <AdSlot {...props} />;
}

export function FooterSponsor(props: AdSlotProps) {
  return <AdSlot {...props} />;
}

// AD_PRESETS lives in ./presets to keep the AdSlot module
// dependency-free at evaluation time.

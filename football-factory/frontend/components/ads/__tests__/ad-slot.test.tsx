// Football Factory — Ad / Sponsor slot tests (R2 Wave 2D).
//
// Covers:
//   - AdSlot disabled-by-default returns reserved placeholder.
//   - AdSlot enabled but consentRequired without consent returns
//     reserved placeholder.
//   - AdSlot enabled with consent returns the live mount div.
//   - CLS safety: min-height + width:100% + contain:layout always
//     rendered.
//   - Aria-label flips between reserved / advertisement.
//   - All placement helpers preserve AdSlot behaviour.
//   - All AD_PRESETS are disabled-by-default + consent-required.
//   - Source scan: no googletagmanager / googlesyndication /
//     adsbygoogle / doubleclick / gtag( / iframe src= in this slice.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  AdSlot,
  LeaderboardAd,
  HeroSponsor,
  InFeedAd,
  ArticleInlineAd,
  SidebarAd,
  FooterSponsor,
  type AdConfig,
  type Placement,
} from "../ad-slot";
import { AD_PRESETS } from "../presets";

const baseConfig: AdConfig = {
  id: "test-slot",
  placement: "leaderboard",
  enabled: false,
  consentRequired: true,
  width: 970,
  height: 90,
};

function render(props: Parameters<typeof AdSlot>[0]): {
  text: string;
  attrs: Record<string, string>;
} {
  // Render the React element to a string via react-dom/server.
  // We rely on the project's React + JSX runtime for production.
  const { renderToStaticMarkup } = require("react-dom/server");
  const html = renderToStaticMarkup(AdSlot(props));
  // Extract data-* and aria-* attrs to make assertions compact.
  const attrs: Record<string, string> = {};
  const re = /\s([a-z\-]+)="([^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    attrs[m[1]] = m[2];
  }
  return { text: html, attrs };
}

test("AdSlot: disabled-by-default renders reserved placeholder", () => {
  const { text, attrs } = render({ config: baseConfig });
  assert.ok(text.includes("RESERVED"));
  assert.equal(attrs["data-ad-state"], "reserved");
});

test("AdSlot: enabled WITHOUT consent requirement renders live mount", () => {
  const { text, attrs } = render({
    config: { ...baseConfig, enabled: true, consentRequired: false },
  });
  assert.ok(!text.includes("RESERVED"));
  assert.equal(attrs["data-ad-state"], "live");
  assert.ok(text.includes("data-ad-provider-mount"));
});

test("AdSlot: enabled WITH consent but no consent prop → reserved", () => {
  const { text, attrs } = render({
    config: { ...baseConfig, enabled: true, consentRequired: true },
    consent: false,
  });
  assert.ok(text.includes("RESERVED"));
  assert.equal(attrs["data-ad-state"], "reserved");
});

test("AdSlot: enabled WITH consent prop = true → live", () => {
  const { text, attrs } = render({
    config: { ...baseConfig, enabled: true, consentRequired: true },
    consent: true,
  });
  assert.equal(attrs["data-ad-state"], "live");
});

test("AdSlot: aria-label flips reserved→advertisement", () => {
  const r1 = render({ config: baseConfig });
  assert.ok(
    r1.attrs["aria-label"]?.startsWith("Reserved "),
    "reserved label",
  );
  const r2 = render({
    config: { ...baseConfig, enabled: true, consentRequired: false },
  });
  assert.equal(r2.attrs["aria-label"], "Advertisement");
});

test("AdSlot: CLS-safe — width 100% / minHeight / contain layout", () => {
  const { attrs } = render({ config: baseConfig });
  // The style attribute carries the inline CLS-safe styles.
  assert.ok(attrs["style"]?.includes("width:100%"));
  assert.ok(attrs["style"]?.includes("min-height:90px"));
  assert.ok(attrs["style"]?.includes("contain:layout"));
});

test("AdSlot: data-placement is always set", () => {
  for (const placement of [
    "leaderboard",
    "hero-sponsor",
    "in-feed",
    "article-inline",
    "sidebar",
    "footer-sponsor",
  ] as Placement[]) {
    const { attrs } = render({
      config: { ...baseConfig, placement },
    });
    assert.equal(attrs["data-placement"], placement);
  }
});

test("Placement helpers preserve AdSlot behaviour", () => {
  const { renderToStaticMarkup } = require("react-dom/server");
  const html = renderToStaticMarkup(
    <div>
      <LeaderboardAd config={baseConfig} />
      <HeroSponsor config={baseConfig} />
      <InFeedAd config={baseConfig} />
      <ArticleInlineAd config={baseConfig} />
      <SidebarAd config={baseConfig} />
      <FooterSponsor config={baseConfig} />
    </div>,
  );
  // Each component renders an <aside> with data-ad-slot.
  assert.ok((html.match(/data-ad-slot=/g) || []).length === 6);
});

test("AD_PRESETS: every preset is disabled-by-default", () => {
  for (const placement of Object.keys(AD_PRESETS) as Placement[]) {
    const cfg = AD_PRESETS[placement];
    assert.equal(cfg.enabled, false, `${placement} must be disabled`);
    assert.equal(cfg.consentRequired, true, `${placement} must require consent`);
  }
});

test("AD_PRESETS: every preset reserves dimensions", () => {
  for (const placement of Object.keys(AD_PRESETS) as Placement[]) {
    const cfg = AD_PRESETS[placement];
    assert.ok(cfg.width > 0);
    assert.ok(cfg.height > 0);
  }
});

test("AD_PRESETS: every placement has its id matching the placement", () => {
  for (const placement of Object.keys(AD_PRESETS) as Placement[]) {
    const cfg = AD_PRESETS[placement];
    assert.equal(cfg.placement, placement);
  }
});

test("Source scan: no live ad-network code in AdSlot module", () => {
  // The slice ships no third-party ad network code. Verify by
  // scanning the source for forbidden tokens.
  const here = fileURLToPath(import.meta.url);
  const modulePath = resolve(
    here.replace(/[\\/]+__tests__[\\/]+.*$/, ""),
    "ad-slot.tsx",
  );
  const src = readFileSync(modulePath, "utf8");
  const forbidden = [
    "googletagmanager",
    "googlesyndication",
    "adsbygoogle",
    "doubleclick",
    "gtag(",
    'iframe src=',
  ];
  for (const tok of forbidden) {
    assert.equal(
      src.includes(tok),
      false,
      `AdSlot source must not contain "${tok}"`,
    );
  }
});

test("Source scan: no live GA4 code in provider module", () => {
  const here = fileURLToPath(import.meta.url);
  const modulePath = resolve(
    here.replace(/[\\/]+__tests__[\\/]+.*$/, ""),
    "provider.tsx",
  );
  const src = readFileSync(modulePath, "utf8");
  // The provider module is allowed to read NEXT_PUBLIC_GA4_MEASUREMENT_ID
  // as a string — but no gtag(), googletagmanager, etc.
  const forbidden = [
    "googletagmanager",
    "googlesyndication",
    "adsbygoogle",
    "doubleclick",
    "gtag(",
    'iframe src=',
  ];
  for (const tok of forbidden) {
    assert.equal(
      src.includes(tok),
      false,
      `Analytics provider source must not contain "${tok}"`,
    );
  }
});

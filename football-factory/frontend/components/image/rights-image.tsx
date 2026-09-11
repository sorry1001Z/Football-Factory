// Football Factory — Image presentation components (R2 Wave 1).
//
// Adapted from the external Football Image System R2 pack (src/components.tsx)
// to the live repo's CSS-variable approach (app/globals.css).
//
// Required adaptations applied:
//   - aria-label on the no-use fallback div (was missing in R2)
//   - source-page link / caption when license_notes or source_page is set
//   - license link wrapping the attribution text
//   - specific alt text fallback (player/team/competition or author)
//   - loading="lazy" (kept from R2)
//   - responsive sizing via CSS (figure { width: 100% } and img { max-width:100% })
//   - unresolved-rights "no-use" state shown with role="img" and aria-label
//
// All classes use CSS variables already defined in app/globals.css
// (--bg, --surface, --ink, --muted, --line, --blue, --radius). No new
// CSS framework introduced.

import type { Asset } from "@/lib/image-system/types";
import { requiresAttribution } from "@/lib/image-system/policy";

export interface ImageAttributionProps {
  asset: Asset;
}

/**
 * Caption block for an asset. Renders attribution with optional
 * license link, and a source-page link when one is available.
 *
 * Renders NOTHING when there is no attribution at all (matches the
 * R2 behavior but with caption added when source_page is set).
 */
export function ImageAttribution({ asset }: ImageAttributionProps): React.JSX.Element | null {
  if (!asset.attribution && !asset.source_page) return null;
  const licenseLinked = asset.attribution && asset.license_url;
  return (
    <figcaption className="rights-figcaption">
      {asset.attribution ? (
        licenseLinked ? (
          <a
            href={asset.license_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rights-license-link"
          >
            {asset.attribution}
          </a>
        ) : (
          <span className="rights-attrib-text">{asset.attribution}</span>
        )
      ) : null}
      {asset.source_page ? (
        <>
          {" · "}
          <a
            href={asset.source_page}
            target="_blank"
            rel="noopener noreferrer"
            className="rights-source-link"
          >
            Source
          </a>
        </>
      ) : null}
    </figcaption>
  );
}

interface RightsImageProps {
  asset?: Asset;
  kind: "hero" | "cover" | "article";
  sourcePolicy?: { attribution_required: boolean };
}

/**
 * Build a specific alt-text fallback. Priority:
 *   1. asset.author + asset.team + asset.competition
 *   2. asset.author alone
 *   3. asset.player + asset.team
 *   4. asset.license (last-resort identifier; safe — never empty)
 *   5. literal "Football editorial image"
 */
function buildAlt(a: Asset | undefined): string {
  if (!a) return "Football editorial image";
  const parts: string[] = [];
  if (a.player) parts.push(a.player);
  if (a.team) parts.push(a.team);
  if (a.competition) parts.push(a.competition);
  if (!parts.length && a.author) parts.push(a.author);
  if (!parts.length && a.license) parts.push(a.license);
  if (!parts.length) return "Football editorial image";
  return parts.join(" — ");
}

/**
 * The R2 RightsImage pattern adapted. Three observable states:
 *   - asset undefined                              -> "Image unavailable"
 *   - asset.state !== ACTIVE OR no license          -> "Image withheld — rights unresolved"
 *   - otherwise                                     -> figure with img + caption
 *
 * The first two states are the no-use fallback. The third NEVER
 * bypasses the rights stack: callers must have already passed
 * publicationDecision() before this component receives an Asset.
 */
function RightsImage({
  asset,
  kind,
  sourcePolicy,
}: RightsImageProps): React.JSX.Element {
  const klass = `rights-figure rights-${kind}`;

  if (!asset) {
    return (
      <div
        className={`rights-fallback rights-${kind}-fallback`}
        role="img"
        aria-label="Football image unavailable"
      >
        Image unavailable
      </div>
    );
  }

  const showImage =
    asset.state === "ACTIVE" &&
    Boolean(asset.license) &&
    Boolean(asset.license_url);

  if (!showImage) {
    return (
      <div
        className={`rights-fallback rights-${kind}-fallback rights-no-use`}
        role="img"
        aria-label={`Football image withheld for ${kind}; rights unresolved`}
      >
        Image withheld — rights unresolved
      </div>
    );
  }

  // belt-and-suspenders: refuse to render anything that the policy layer
  // has not blessed with attribution-required-without-attribution
  if (sourcePolicy && requiresAttribution({ attribution_required: sourcePolicy.attribution_required } as never, asset) && !asset.attribution) {
    return (
      <div
        className={`rights-fallback rights-${kind}-fallback rights-no-use`}
        role="img"
        aria-label={`Football image withheld for ${kind}; attribution missing`}
      >
        Image withheld — attribution missing
      </div>
    );
  }

  return (
    <figure className={klass}>
      <img
        src={asset.image_url}
        alt={buildAlt(asset)}
        loading="lazy"
        decoding="async"
        width={asset.width}
        height={asset.height}
        className={`rights-img rights-${kind}-img`}
      />
      <ImageAttribution asset={asset} />
    </figure>
  );
}

export function HeroNewsImage({
  asset,
  sourcePolicy,
}: Pick<RightsImageProps, "asset" | "sourcePolicy">): React.JSX.Element {
  return <RightsImage asset={asset} kind="hero" sourcePolicy={sourcePolicy} />;
}

export function NewsCoverImage({
  asset,
  sourcePolicy,
}: Pick<RightsImageProps, "asset" | "sourcePolicy">): React.JSX.Element {
  return <RightsImage asset={asset} kind="cover" sourcePolicy={sourcePolicy} />;
}

export function ArticleEditorialImage({
  asset,
  sourcePolicy,
}: Pick<RightsImageProps, "asset" | "sourcePolicy">): React.JSX.Element {
  return <RightsImage asset={asset} kind="article" sourcePolicy={sourcePolicy} />;
}

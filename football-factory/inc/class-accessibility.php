<?php
/**
 * Football Factory — Accessibility
 *
 * Site-wide accessibility behavior. Targets WCAG 2.1 AA
 * (with selected AAA where reasonable), matching
 * Blueprint v1.1 ACCESSIBILITY.md.
 *
 * Phase 6B only wires behaviors that are safe without
 * any business logic. Concrete component-level a11y
 * will be added when template parts land in later phases.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

namespace FootballFactory\Theme;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Accessibility behaviors.
 */
final class Accessibility {

	/**
	 * Hook registration.
	 *
	 * @return void
	 */
	public static function register(): void {
		// `wp_resource_hints` is preferred to raw output.
		add_action( 'wp_resource_hints', array( self::class, 'dns_prefetch' ), 10, 2 );

		// Mark the html element with a lang dir attribute when
		// the language is RTL. (Default LTR is the WP default.)
		add_action( 'wp_head', array( self::class, 'rtl_dir_attribute' ), 1 );

		// Skip-link target. The actual skip-link element lives in
		// header.php; this filter lets us ensure the target id
		// always matches the focusable element in <main>.
		add_filter( 'football_factory_skip_link_target', array( self::class, 'skip_link_target' ) );
	}

	/**
	 * Skip-link target id filter.
	 *
	 * @return string
	 */
	public static function skip_link_target(): string {
		return 'main-content';
	}

	/**
	 * Hint DNS prefetch for the theme's static asset origin.
	 *
	 * No third-party hosts are added here. The only entry is
	 * the site's own static origin, used when assets live on
	 * a separate subdomain.
	 *
	 * @param array  $hints Existing resource hints.
	 * @param string $relation_type Relation type (e.g. 'dns-prefetch').
	 * @return array
	 */
	public static function dns_prefetch( array $hints, string $relation_type ): array {
		if ( 'dns-prefetch' !== $relation_type ) {
			return $hints;
		}
		// Intentionally empty in Phase 6B. The Theme does not
		// depend on external origins. Future CDN additions go
		// here behind a filter.
		return $hints;
	}

	/**
	 * If the site is in an RTL locale, set `dir="rtl"` on <html>.
	 *
	 * This is a fallback only. theme.json + WP_RTL languages
	 * already handle this for most cases, but we belt-and-brace.
	 *
	 * @return void
	 */
	public static function rtl_dir_attribute(): void {
		if ( is_rtl() ) {
			echo '<meta name="theme-direction" content="rtl">' . "\n";
		}
	}
}

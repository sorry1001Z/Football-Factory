<?php
/**
 * Football Factory — Compatibility
 *
 * Compatibility helpers for older WordPress versions
 * and well-known plugins.
 *
 * This module is intentionally small in Phase 6B. We
 * only add guards that we actually rely on. Real
 * compatibility work happens in later phases when
 * the production templates land.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

namespace FootballFactory\Theme;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Compatibility helpers.
 */
final class Compatibility {

	/**
	 * Hook registration.
	 *
	 * @return void
	 */
	public static function register(): void {
		// Phase 6B: no compat shims needed. The function body
		// intentionally exists so that future phases can add
		// guards without touching the module loader.
	}

	/**
	 * Whether the running WordPress version is at least the
	 * minimum declared in `style.css` and `functions.php`.
	 *
	 * @return bool
	 */
	public static function meets_wp_minimum(): bool {
		return version_compare( (string) get_bloginfo( 'version' ), (string) FOOTBALL_FACTORY_MIN_WP, '>=' );
	}

	/**
	 * Whether the running PHP version is at least the
	 * minimum declared in `style.css` and `functions.php`.
	 *
	 * @return bool
	 */
	public static function meets_php_minimum(): bool {
		return version_compare( (string) PHP_VERSION, (string) FOOTBALL_FACTORY_MIN_PHP, '>=' );
	}
}

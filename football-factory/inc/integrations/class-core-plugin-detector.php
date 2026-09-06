<?php
/**
 * Football Factory — Core Plugin Detector
 *
 * Determines whether the Football Factory Core Plugin is
 * active and healthy, WITHOUT instantiating any of its
 * classes. The detector is intentionally light:
 *
 *   - Checks function existence (function_exists) for the
 *     stable public function list.
 *   - Does NOT call any function. The Theme is not allowed
 *     to invoke Core Plugin logic during request bootstrap
 *     (that would couple Theme render time to Core Plugin
 *     performance).
 *
 * Results are stored in a static cache so the detector
 * is O(1) after the first call.
 *
 * File name uses kebab-case segments to match the Theme's
 * PSR-4 path convention (see inc/class-bootstrap.php). The
 * WPCS InvalidClassFileName rule assumes global-namespace
 * single-word class names; for our multi-word namespaced
 * classes the rule produces a demonstrable false positive.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

namespace FootballFactory\Theme\integrations;

use FootballFactory\Theme\contracts\CorePluginContract;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Detector.
 */
final class CorePluginDetector {

	/**
	 * Cached availability result.
	 *
	 * @var bool|null
	 */
	private static ?bool $available = null;

	/**
	 * Cached health result.
	 *
	 * @var string|null
	 */
	private static ?string $health = null;

	/**
	 * Direct construction is not allowed.
	 */
	private function __construct() {}

	/**
	 * Hook registration. This module has no side effects; it
	 * only registers an init-priority filter so other modules
	 * can override the result.
	 *
	 * @return void
	 */
	public static function register(): void {
		// No-op in Phase 6B. The detector is consulted lazily.
	}

	/**
	 * Is the Core Plugin available?
	 *
	 * Detection is by function existence for the public
	 * function list. If the Core Plugin is not active,
	 * the Theme must still render correctly.
	 *
	 * @return bool
	 */
	public static function is_available(): bool {
		if ( null !== self::$available ) {
			return self::$available;
		}

		$available = true;
		foreach ( CorePluginContract::public_functions() as $fn ) {
			if ( ! function_exists( $fn ) ) {
				$available = false;
				break;
			}
		}

		/**
		 * Filter the detected Core Plugin availability.
		 *
		 * Allows other code (e.g. a maintenance-mode plugin)
		 * to override the result.
		 *
		 * @param bool $available Whether Core Plugin is available.
		 */
		$available = (bool) apply_filters( 'football_factory_core_available', $available );

		self::$available = $available;
		return $available;
	}

	/**
	 * Is the Core Plugin stale (declared, but no recent
	 * handshake)? In Phase 6B, stale = same as unavailable.
	 *
	 * Future versions may use a transient to mark staleness.
	 *
	 * @return bool
	 */
	public static function is_stale(): bool {
		// Reserved for Phase 6C. Always false in Phase 6B.
		return false;
	}

	/**
	 * Is the Core Plugin in maintenance mode?
	 *
	 * Detection: a transient `ff_core_maintenance` set by
	 * the Core Plugin. Theme code can use this to render
	 * a maintenance banner.
	 *
	 * @return bool
	 */
	public static function is_maintenance(): bool {
		return (bool) get_transient( 'ff_core_maintenance' );
	}

	/**
	 * Get a short health string for display in admin or
	 * debug contexts. Never echo this to public visitors.
	 *
	 * @return string
	 */
	public static function health(): string {
		if ( null !== self::$health ) {
			return self::$health;
		}

		if ( self::is_maintenance() ) {
			self::$health = 'maintenance';
		} elseif ( ! self::is_available() ) {
			self::$health = 'unavailable';
		} elseif ( self::is_stale() ) {
			self::$health = 'stale';
		} else {
			self::$health = 'ok';
		}

		return self::$health;
	}

	/**
	 * Reset the cached state. Used by tests.
	 *
	 * @return void
	 */
	public static function reset(): void {
		self::$available = null;
		self::$health    = null;
	}
}

<?php
/**
 * Football Factory — Navigation
 *
 * Registers the navigation locations required by the
 * global shell. Each location is approved by Blueprint
 * v1.1 (TEMPLATE-PARTS.md, navigation locations table).
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

namespace FootballFactory\Theme;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the approved navigation locations.
 */
final class Navigation {

	/**
	 * Approved navigation locations.
	 *
	 * Each location is a slot where a menu can be assigned
	 * in the Customizer / Menus screen. The key is the
	 * internal slug; the value is the human-readable label
	 * (must be wrapped in `__()` for translation).
	 *
	 * @return array<string,string>
	 */
	public static function locations(): array {
		return array(
			'primary'       => __( 'Primary', 'football-factory' ),
			'utility'       => __( 'Utility', 'football-factory' ),
			'footer'        => __( 'Footer', 'football-factory' ),
			'mobile'        => __( 'Mobile', 'football-factory' ),
			'bottom-mobile' => __( 'Bottom Mobile', 'football-factory' ),
		);
	}

	/**
	 * Hook registration.
	 *
	 * @return void
	 */
	public static function register(): void {
		add_action( 'after_setup_theme', array( self::class, 'register_locations' ) );
	}

	/**
	 * Register the approved locations.
	 *
	 * @return void
	 */
	public static function register_locations(): void {
		register_nav_menus( self::locations() );
	}
}

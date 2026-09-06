<?php
/**
 * Football Factory — Theme Bootstrap
 *
 * This file is intentionally a thin bootstrap. All real
 * logic lives in namespaced modules under `FootballFactory\Theme\`
 * (loaded by `inc/bootstrap.php`).
 *
 * Responsibilities of this file:
 *   1. Guard against direct access.
 *   2. Define theme version, paths, and URIs.
 *   3. Load `inc/bootstrap.php` and let it register modules.
 *   4. Catch only safe bootstrap failures (developer log only,
 *      no public output).
 *
 * What this file does NOT do:
 *   - No HTML output.
 *   - No CPT or taxonomy registration.
 *   - No REST endpoint registration.
 *   - No football business logic.
 *   - No external API calls.
 *   - No large anonymous callbacks.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

// Guard against direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Theme version. Bumped per release; used for asset cache busting.
if ( ! defined( 'FOOTBALL_FACTORY_VERSION' ) ) {
	define( 'FOOTBALL_FACTORY_VERSION', '0.3.2' );
}

// Theme minimum runtime contract (read from style.css header at build time).
if ( ! defined( 'FOOTBALL_FACTORY_MIN_WP' ) ) {
	define( 'FOOTBALL_FACTORY_MIN_WP', '6.5' );
}
if ( ! defined( 'FOOTBALL_FACTORY_MIN_PHP' ) ) {
	define( 'FOOTBALL_FACTORY_MIN_PHP', '8.0' );
}

// Paths and URIs.
if ( ! defined( 'FOOTBALL_FACTORY_DIR' ) ) {
	define( 'FOOTBALL_FACTORY_DIR', trailingslashit( get_stylesheet_directory() ) );
}
if ( ! defined( 'FOOTBALL_FACTORY_URI' ) ) {
	define( 'FOOTBALL_FACTORY_URI', trailingslashit( get_stylesheet_directory_uri() ) );
}
if ( ! defined( 'FOOTBALL_FACTORY_INC_DIR' ) ) {
	define( 'FOOTBALL_FACTORY_INC_DIR', FOOTBALL_FACTORY_DIR . 'inc/' );
}
if ( ! defined( 'FOOTBALL_FACTORY_TEMPLATE_PARTS_DIR' ) ) {
	define( 'FOOTBALL_FACTORY_TEMPLATE_PARTS_DIR', FOOTBALL_FACTORY_DIR . 'template-parts/' );
}
if ( ! defined( 'FOOTBALL_FACTORY_ASSETS_URI' ) ) {
	define( 'FOOTBALL_FACTORY_ASSETS_URI', FOOTBALL_FACTORY_URI . 'assets/' );
}
if ( ! defined( 'FOOTBALL_FACTORY_ASSETS_DIR' ) ) {
	define( 'FOOTBALL_FACTORY_ASSETS_DIR', FOOTBALL_FACTORY_DIR . 'assets/' );
}

// Text domain (matches style.css header).
if ( ! defined( 'FOOTBALL_FACTORY_TEXT_DOMAIN' ) ) {
	define( 'FOOTBALL_FACTORY_TEXT_DOMAIN', 'football-factory' );
}

// Load the deterministic module loader. This is the only file
// functions.php requires directly.
require_once FOOTBALL_FACTORY_INC_DIR . 'class-bootstrap.php';

// Bootstrap modules. Failures here are developer-only: logged, never
// echoed to visitors.
try {
	\FootballFactory\Theme\Bootstrap::instance()->boot();
} catch ( \Throwable $e ) {
	if ( defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log( '[football-factory] bootstrap failed: ' . $e->getMessage() );
	}
	// Intentionally silent on the front-end. The site continues to
	// render with whatever default WordPress provides.
}

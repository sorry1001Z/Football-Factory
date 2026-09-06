<?php
/**
 * Football Factory — Core Plugin Contract
 *
 * A read-only interface for the Theme to detect whether the
 * Football Factory Core Plugin is present and healthy.
 *
 * This file is the THEME's view of the contract; the
 * authoritative contract lives in the Core Plugin and in
 * Blueprint v1.1 (CORE-PLUGIN-CONTRACT.md). If the two
 * ever drift, the Blueprint is the source of truth.
 *
 * The Theme must never instantiate Core Plugin classes.
 * It must only call the public, stable functions exposed
 * by the Core Plugin (e.g. `ff_get_view_model()`).
 *
 * File name uses kebab-case segments to match the Theme's
 * PSR-4 path convention (see inc/class-bootstrap.php). The
 * WPCS InvalidClassFileName rule assumes global-namespace
 * single-word class names; for our multi-word namespaced
 * classes the rule produces a demonstrable false positive.
 *
 * @package Football_Factory
 */

// phpcs:disable WordPress.Files.FileName.InvalidClassFileName

declare( strict_types = 1 );

namespace FootballFactory\Theme\contracts;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The contract as the Theme sees it.
 */
final class CorePluginContract {

	/**
	 * Direct construction is not allowed.
	 */
	private function __construct() {}

	/**
	 * Constants the Theme uses to read Core Plugin state.
	 * The actual class lives in the Core Plugin; the Theme
	 * only consumes these names via the detector module.
	 */
	public const FUNCTION_GET_VIEW_MODEL = 'ff_get_view_model';
	public const FUNCTION_BREADCRUMB     = 'ff_breadcrumb_chain';
	public const FUNCTION_SEO_META       = 'ff_seo_meta';
	public const FUNCTION_LOG_EVENT      = 'ff_log_event';
	public const FUNCTION_CORE_AVAILABLE = 'ff_core_available';

	/**
	 * The stable public function names that the Theme may
	 * call. Listed here so the Theme can use a single
	 * `defined( 'FUNCTION_NAME' )` check via the detector.
	 *
	 * @return list<string>
	 */
	public static function public_functions(): array {
		return array(
			self::FUNCTION_GET_VIEW_MODEL,
			self::FUNCTION_BREADCRUMB,
			self::FUNCTION_SEO_META,
			self::FUNCTION_LOG_EVENT,
			self::FUNCTION_CORE_AVAILABLE,
		);
	}

	/**
	 * Capability name constant for Core Plugin admin pages.
	 * (Theme does not enforce it; it just reads the value.)
	 */
	public const CAP_MANAGE = 'manage_football_data';
	public const CAP_READ   = 'read_football_data';
}

<?php
/**
 * Football Factory — Helpers
 *
 * Pure utility functions for the Theme. No side effects.
 * No business logic. No external calls.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

namespace FootballFactory\Theme\helpers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Pure helpers.
 */
final class Helpers {

	/**
	 * Direct construction is not allowed.
	 */
	private function __construct() {}

	/**
	 * Whether the current request is in the WordPress admin
	 * context. This is the single, safe way to check.
	 *
	 * @return bool
	 */
	public static function is_admin_context(): bool {
		return is_admin();
	}

	/**
	 * Whether the current request is a REST API request.
	 *
	 * @return bool
	 */
	public static function is_rest_request(): bool {
		if ( ! defined( 'REST_REQUEST' ) ) {
			return false;
		}
		return (bool) REST_REQUEST;
	}

	/**
	 * Whether the current request is a WP-CLI command.
	 *
	 * @return bool
	 */
	public static function is_cli(): bool {
		return defined( 'WP_CLI' ) && WP_CLI;
	}

	/**
	 * Get a theme mod with a default. Pure function, no side effects.
	 *
	 * @param string $name       Theme mod name.
	 * @param mixed  $fallback   Default value if the mod is not set.
	 * @return mixed
	 */
	public static function theme_mod( string $name, $fallback = null ) {
		return get_theme_mod( $name, $fallback );
	}

	/**
	 * Format a number for the current locale. Uses WordPress's
	 * built-in number formatting so it follows the site's
	 * locale (LTR/RTL + thousands separator).
	 *
	 * @param int|float $number Number to format.
	 * @return string
	 */
	public static function format_number( $number ): string {
		return number_format_i18n( $number );
	}

	/**
	 * Format a date for the current locale using the WordPress
	 * date format option. Do not hardcode date strings.
	 *
	 * @param string|int $date   Date string or Unix timestamp.
	 * @param string     $format Optional. PHP date format. Default
	 *                           `get_option('date_format')`.
	 * @return string
	 */
	public static function format_date( $date, string $format = '' ): string {
		if ( '' === $format ) {
			$format = (string) get_option( 'date_format', 'F j, Y' );
		}
		if ( is_numeric( $date ) ) {
			return wp_date( $format, (int) $date );
		}
		return wp_date( $format, strtotime( (string) $date ) );
	}

	/**
	 * Safe asset URL builder. Returns the absolute URL to a
	 * file under `assets/`. Used by templates that need a
	 * static asset (e.g. favicon fallback) outside the
	 * enqueue pipeline.
	 *
	 * @param string $relative Path relative to `assets/`.
	 * @return string
	 */
	public static function asset_url( string $relative ): string {
		return FOOTBALL_FACTORY_ASSETS_URI . ltrim( $relative, '/' );
	}
}

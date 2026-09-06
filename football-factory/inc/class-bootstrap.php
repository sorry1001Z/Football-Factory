<?php
/**
 * Football Factory — Deterministic Module Loader
 *
 * Loads namespaced modules in a fixed, explicit order.
 * No filesystem globbing at runtime; the module list is
 * declared here as a class constant.
 *
 * The order matters:
 *   1. helpers     — pure utility functions
 *   2. contracts   — interfaces and value objects (no side effects)
 *   3. integrations — optional compatibility adapters (Core Plugin, etc.)
 *   4. theme-setup, accessibility, navigation, images, editor,
 *      assets, compatibility — runtime feature registration
 *
 * Each module is loaded with `require_once` so re-entry
 * is safe (test suites, plugin reloads, etc.).
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

namespace FootballFactory\Theme;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Bootstrap {

	/**
	 * Singleton instance holder.
	 *
	 * @var Bootstrap|null
	 */
	private static ?Bootstrap $instance = null;

	/**
	 * Module load order.
	 *
	 * Each entry is a class name under the FootballFactory\Theme\
	 * namespace. Classes must define a public static `register(): void`
	 * method that performs all side effects (hook registration, etc.).
	 *
	 * Note: `Helpers` and `CorePluginContract` are pure-utility
	 * classes with no `register()`. They are loaded directly by
	 * the bootstrap (autoload) but not in this list.
	 *
	 * @var list<class-string>
	 */
	private const MODULES = array(
		// Optional integrations. These are activation-safe when their
		// dependency (e.g. Core Plugin) is absent.
		'FootballFactory\\Theme\\integrations\\CorePluginDetector',

		// Runtime feature registration.
		'FootballFactory\\Theme\\Theme_Setup',
		'FootballFactory\\Theme\\Accessibility',
		'FootballFactory\\Theme\\Navigation',
		'FootballFactory\\Theme\\Images',
		'FootballFactory\\Theme\\Editor',
		'FootballFactory\\Theme\\Assets',
		'FootballFactory\\Theme\\Compatibility',
	);

	/**
	 * Whether modules have already been booted.
	 *
	 * @var bool
	 */
	private bool $booted = false;

	/**
	 * Get or create the singleton.
	 *
	 * @return self
	 */
	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Prevent direct construction.
	 */
	private function __construct() {}

	/**
	 * Load all modules in declared order.
	 *
	 * Each module's `register()` is wrapped in a try/catch so a
	 * single broken module cannot prevent the rest from loading.
	 * Failures are logged when WP_DEBUG_LOG is enabled.
	 *
	 * @return void
	 */
	public function boot(): void {
		if ( $this->booted ) {
			return;
		}
		$this->booted = true;

		// First, load pure-utility classes (no register()).
		// These are referenced by other modules and must be
		// available before any registration runs.
		$utilities = array(
			'FootballFactory\\Theme\\helpers\\Helpers' => 'helpers/class-helpers.php',
			'FootballFactory\\Theme\\contracts\\CorePluginContract' => 'contracts/class-core-plugin-contract.php',
		);
		foreach ( $utilities as $class => $path ) {
			if ( is_readable( FOOTBALL_FACTORY_INC_DIR . $path ) ) {
				require_once FOOTBALL_FACTORY_INC_DIR . $path;
			}
		}

		// Then, load and register the real modules.
		foreach ( self::MODULES as $module_class ) {
			$this->load_module( $module_class );
		}
	}

	/**
	 * Load a single module if it exists.
	 *
	 * The file must live at `inc/<class_basename_lower>.php`
	 * (e.g. `FootballFactory\Theme\Theme_Setup` lives in
	 * `inc/theme-setup.php`). We resolve deterministically
	 * rather than via glob.
	 *
	 * @param class-string $class_name FQCN of the module.
	 * @return void
	 */
	private function load_module( string $class_name ): void {
		$relative = $this->module_path( $class_name );
		$path     = FOOTBALL_FACTORY_INC_DIR . $relative;

		if ( ! is_readable( $path ) ) {
			$this->log( sprintf( 'module file missing: %s (%s)', $class_name, $relative ) );
			return;
		}

		require_once $path;

		if ( ! class_exists( $class_name ) ) {
			$this->log( sprintf( 'class not declared in %s: %s', $relative, $class_name ) );
			return;
		}

		if ( ! method_exists( $class_name, 'register' ) ) {
			$this->log( sprintf( 'register() missing on %s', $class_name ) );
			return;
		}

		try {
			$class_name::register();
		} catch ( \Throwable $e ) {
			$this->log(
				sprintf(
					'register() failed on %s: %s',
					$class_name,
					$e->getMessage()
				)
			);
		}
	}

	/**
	 * Resolve a module class to its inc/ relative path.
	 *
	 * Naming: `FootballFactory\Theme\Theme_Setup` → `class-theme-setup.php`
	 * Naming: `FootballFactory\Theme\helpers\Helpers` → `helpers/class-helpers.php`
	 *
	 * The `class-` prefix is the WPCS-recommended naming for class
	 * files in this project; it is required for PHPCS closure.
	 *
	 * @param string $class_name FQCN.
	 * @return string
	 */
	private function module_path( string $class_name ): string {
		$short = str_replace( 'FootballFactory\\Theme\\', '', $class_name );
		$parts = explode( '\\', $short );
		$last  = array_pop( $parts );

		// Convert PascalCase / snake_case to kebab-case.
		// Insert - before each uppercase (except at the start),
		// replace underscores with dashes, lowercase, then
		// collapse any doubled dashes.
		$kebab = preg_replace( '/(?<!^)([A-Z])/', '-$1', $last );
		$kebab = str_replace( '_', '-', $kebab );
		$kebab = strtolower( $kebab );
		$kebab = preg_replace( '/-+/', '-', $kebab );
		$file  = 'class-' . $kebab . '.php';

		if ( empty( $parts ) ) {
			return $file;
		}

		return strtolower( implode( '/', $parts ) ) . '/' . $file;
	}

	/**
	 * Developer-only error log.
	 *
	 * @param string $message Message to log.
	 * @return void
	 */
	private function log( string $message ): void {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log( '[football-factory] ' . $message );
		}
	}
}

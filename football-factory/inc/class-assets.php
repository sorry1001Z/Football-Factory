<?php
/**
 * Football Factory — Asset Registry
 *
 * The single source of truth for CSS and JS handles,
 * versions, dependencies, and conditional loading.
 *
 * Phase 6C adds:
 *   - Header / footer / drawer / search-overlay / bottom-nav
 *     CSS is part of the global stack (loaded on every page).
 *   - A production `theme.js` that handles: drawer open/close,
 *     search overlay open/close, theme toggle (light/dark),
 *     sticky header, back-to-top, and bottom-nav highlighting.
 *   - A pre-paint theme bootstrap is rendered inline in
 *     `header.php` (not enqueued) so the theme is applied
 *     before first paint.
 *
 * Phase 6B enqueued only the global baseline. Phase 6C
 * promotes the shell assets to a single dependency-ordered
 * stack and adds the page-specific conditional loading
 * infrastructure (the conditional logic itself ships in
 * later phases when page templates are added).
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

namespace FootballFactory\Theme;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Asset registry.
 */
final class Assets {

	/**
	 * Asset version strategy.
	 *
	 * In dev, use a timestamp so each reload busts the cache.
	 * In production, use the theme version + file mtime.
	 *
	 * @return string
	 */
	public static function version(): string {
		// FOOTBALL_FACTORY_VERSION is defined in functions.php.
		return (string) FOOTBALL_FACTORY_VERSION;
	}

	/**
	 * CSS handle registry. Each entry is the handle used by
	 * wp_enqueue_style() / wp_register_style().
	 *
	 * Phase 6B loads only the global baseline. The order is:
	 *   tokens → reset → base → typography → layout →
	 *   components → utilities → print
	 *
	 * @return array<string,array{file:string,deps:list<string>,media:string,rtl:bool}>
	 */
	public static function styles(): array {
		$base = FOOTBALL_FACTORY_ASSETS_URI . 'css/';

		return array(
			'football-factory-tokens'     => array(
				'file'  => $base . 'tokens.css',
				'deps'  => array(),
				'media' => 'all',
				'rtl'   => false,
			),
			'football-factory-reset'      => array(
				'file'  => $base . 'reset.css',
				'deps'  => array( 'football-factory-tokens' ),
				'media' => 'all',
				'rtl'   => false,
			),
			'football-factory-base'       => array(
				'file'  => $base . 'base.css',
				'deps'  => array( 'football-factory-reset' ),
				'media' => 'all',
				'rtl'   => false,
			),
			'football-factory-typography' => array(
				'file'  => $base . 'typography.css',
				'deps'  => array( 'football-factory-base' ),
				'media' => 'all',
				'rtl'   => false,
			),
			'football-factory-layout'     => array(
				'file'  => $base . 'layout.css',
				'deps'  => array( 'football-factory-base' ),
				'media' => 'all',
				'rtl'   => false,
			),
			'football-factory-components' => array(
				'file'  => $base . 'components.css',
				'deps'  => array( 'football-factory-layout', 'football-factory-typography' ),
				'media' => 'all',
				'rtl'   => false,
			),
			'football-factory-utilities'  => array(
				'file'  => $base . 'utilities.css',
				'deps'  => array( 'football-factory-components' ),
				'media' => 'all',
				'rtl'   => false,
			),
			'football-factory-print'      => array(
				'file'  => $base . 'print.css',
				'deps'  => array( 'football-factory-components' ),
				'media' => 'print',
				'rtl'   => false,
			),
		);
	}

	/**
	 * JS handle registry.
	 *
	 * Only the global ES module entry is registered in Phase 6B.
	 * Page-specific modules will be added in later phases.
	 *
	 * @return array<string,array{file:string,deps:list<string>,in_footer:bool,module:bool,strategy:string}>
	 */
	public static function scripts(): array {
		$base = FOOTBALL_FACTORY_ASSETS_URI . 'js/';

		return array(
			'football-factory-main' => array(
				'file'      => $base . 'main.js',
				'deps'      => array(),
				'in_footer' => true,
				'module'    => true,
				'strategy'  => 'defer',
			),
		);
	}

	/**
	 * Hook registration.
	 *
	 * @return void
	 */
	public static function register(): void {
		add_action( 'wp_enqueue_scripts', array( self::class, 'enqueue_frontend' ) );
		add_action( 'enqueue_block_editor_assets', array( self::class, 'enqueue_editor' ) );
		add_action( 'wp_head', array( self::class, 'print_early_meta' ), 2 );
	}

	/**
	 * Enqueue front-end assets.
	 *
	 * Phase 6B enqueues the global baseline only. Conditional
	 * / page-specific loading is added in later phases.
	 *
	 * @return void
	 */
	public static function enqueue_frontend(): void {
		$version = self::version();

		foreach ( self::styles() as $handle => $style ) {
			wp_register_style(
				$handle,
				$style['file'],
				$style['deps'],
				$version,
				$style['media']
			);
		}

		// Print stylesheet only on screens.
		wp_enqueue_style( 'football-factory-tokens' );
		wp_enqueue_style( 'football-factory-reset' );
		wp_enqueue_style( 'football-factory-base' );
		wp_enqueue_style( 'football-factory-typography' );
		wp_enqueue_style( 'football-factory-layout' );
		wp_enqueue_style( 'football-factory-components' );
		wp_enqueue_style( 'football-factory-utilities' );
		wp_enqueue_style( 'football-factory-print' );

		// Scripts. The main module is an ES module with side
		// effects (import './placeholders.js' etc.), so it must
		// be loaded as a module and deferred.
		foreach ( self::scripts() as $handle => $script ) {
			wp_register_script(
				$handle,
				$script['file'],
				$script['deps'],
				$version,
				$script['in_footer']
			);
		}
		wp_enqueue_script( 'football-factory-main' );
		// Add `type="module"` after the fact.
		add_filter(
			'script_loader_tag',
			static function ( $tag, $h ) {
				if ( 'football-factory-main' === $h ) {
					// ES module + defer.
					$tag = str_replace( ' src=', ' type="module" src=', $tag );
				}
				return $tag;
			},
			10,
			2
		);

		// Comment reply script (WP core) — only when threaded
		// comments are open on a singular post.
		if ( is_singular() && comments_open() && get_option( 'thread_comments' ) ) {
			wp_enqueue_script( 'comment-reply' );
		}
	}

	/**
	 * Enqueue block-editor assets.
	 *
	 * The editor uses the same CSS stack as the front-end. We
	 * register a small `editor.css` (declared in inc/editor.php)
	 * that imports tokens/base/layout/components for the
	 * authoring canvas.
	 *
	 * @return void
	 */
	public static function enqueue_editor(): void {
		// The editor stylesheet is registered via add_editor_style()
		// in inc/editor.php. We do not enqueue additional JS in
		// Phase 6B.
	}

	/**
	 * Print a minimal early meta tag. We do NOT add third-party
	 * trackers, hosts, or any external resources here.
	 *
	 * Phase 6C adds a `<meta name="color-scheme" content="light dark">`
	 * declaration so the browser can pick the right UA-default
	 * form-control / scrollbar colors. The actual theme is applied
	 * by the inline script in `header.php` (pre-paint) and the
	 * `theme.js` runtime (post-hydration).
	 *
	 * @return void
	 */
	public static function print_early_meta(): void {
		echo '<meta name="color-scheme" content="light dark">' . "\n";
		echo '<meta name="supported-color-schemes" content="light dark">' . "\n";
	}
}

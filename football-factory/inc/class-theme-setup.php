<?php
/**
 * Football Factory — Theme Setup
 *
 * Registers standard WordPress presentation features.
 * Does NOT register domain custom post types, taxonomies,
 * or any business logic. Those belong to the Core Plugin
 * (per Blueprint v1.1 / CORE-PLUGIN-CONTRACT.md).
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

namespace FootballFactory\Theme;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the standard presentation capabilities required
 * by the Hybrid Theme. Loaded by Bootstrap.
 */
final class Theme_Setup {

	/**
	 * Hook into `after_setup_theme`. Idempotent.
	 *
	 * @return void
	 */
	public static function register(): void {
		add_action( 'after_setup_theme', array( self::class, 'after_setup_theme' ) );
		add_action( 'after_setup_theme', array( self::class, 'load_textdomain' ), 5 );
		add_action( 'after_setup_theme', array( self::class, 'register_content_width' ), 0 );
		add_action( 'widgets_init', array( self::class, 'widgets_init' ) );
	}

	/**
	 * Load the text domain early (priority 5 on after_setup_theme).
	 *
	 * @return void
	 */
	public static function load_textdomain(): void {
		load_theme_textdomain(
			FOOTBALL_FACTORY_TEXT_DOMAIN,
			FOOTBALL_FACTORY_DIR . 'languages'
		);
	}

	/**
	 * Set the content width global.
	 *
	 * Linked to the layout `contentSize` in theme.json (1440px).
	 * Used as a fallback when `$content_width` is needed by
	 * embeds and other WP internals.
	 *
	 * @return void
	 */
	public static function register_content_width(): void {
		// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		$GLOBALS['content_width'] = 1440;
	}

	/**
	 * Standard presentation supports.
	 *
	 * Each support listed here is approved by Blueprint v1.1
	 * for a hybrid theme. Domain-specific supports (e.g.
	 * `post-thumbnails` for football entities) are registered
	 * conditionally by the Core Plugin, not here.
	 *
	 * @return void
	 */
	public static function after_setup_theme(): void {
		// Required.
		add_theme_support( 'automatic-feed-links' );
		add_theme_support( 'title-tag' );
		add_theme_support( 'post-thumbnails' );
		add_theme_support(
			'html5',
			array(
				'search-form',
				'comment-form',
				'comment-list',
				'gallery',
				'caption',
				'style',
				'script',
				'navigation-widgets',
			)
		);

		// Layout.
		add_theme_support( 'responsive-embeds' );
		add_theme_support( 'align-wide' );

		// Block editor.
		add_theme_support( 'editor-styles' );
		add_theme_support( 'wp-block-styles' );

		// Selective refresh is safe for any widget area we
		// may register later in the widget areas phase.
		add_theme_support( 'customize-selective-refresh-widgets' );

		// Custom logo is approved (used in the global header shell
		// in a later phase). Declaring the support now lets the
		// Customizer expose the control without breaking activation.
		add_theme_support(
			'custom-logo',
			array(
				'height'      => 60,
				'width'       => 200,
				'flex-height' => true,
				'flex-width'  => true,
				'header-text' => array( 'site-title', 'site-description' ),
			)
		);

		// Note: we intentionally do NOT enable custom-header,
		// custom-background, or post-formats. They are not
		// approved by Blueprint v1.1 and would add a
		// Customizer surface we don't need.
	}

	/**
	 * Register widget areas.
	 *
	 * The Theme declares a single default sidebar
	 * (`sidebar-1`) so that `dynamic_sidebar( 'sidebar-1' )`
	 * in `sidebar.php` is paired with a real registered area.
	 * Theme Check requires a `register_sidebar` whenever
	 * `dynamic_sidebar` is used.
	 *
	 * @return void
	 */
	public static function widgets_init(): void {
		register_sidebar(
			array(
				'name'          => __( 'Primary Sidebar', 'football-factory' ),
				'id'            => 'sidebar-1',
				'description'   => __( 'Default sidebar area used by the Theme.', 'football-factory' ),
				'before_widget' => '<section id="%1$s" class="ff-widget %2$s">',
				'after_widget'  => '</section>',
				'before_title'  => '<h3 class="ff-widget__title">',
				'after_title'   => '</h3>',
			)
		);
	}
}

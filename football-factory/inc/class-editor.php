<?php
/**
 * Football Factory — Editor
 *
 * Editor stylesheet wiring. Declares the CSS file(s) used
 * by the block editor (Gutenberg) when authoring a post.
 *
 * The visual baseline is the Enterprise Frontend v1.0
 * CSS stack. The editor uses the same stack so the
 * authoring experience is visually identical to the
 * front-end.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

namespace FootballFactory\Theme;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Editor wiring.
 */
final class Editor {

	/**
	 * Hook registration.
	 *
	 * @return void
	 */
	public static function register(): void {
		add_action( 'after_setup_theme', array( self::class, 'add_editor_styles' ) );
	}

	/**
	 * Register the editor stylesheet.
	 *
	 * The asset registry in `inc/assets.php` is the single
	 * source of truth for handles. We just hand WordPress
	 * the same file the front-end uses.
	 *
	 * @return void
	 */
	public static function add_editor_styles(): void {
		add_editor_style( 'assets/css/editor.css' );
	}
}

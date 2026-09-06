<?php
/**
 * Football Factory — Image Sizes
 *
 * Registers the planned presentation image sizes.
 * Each size is approved by Blueprint v1.1 and is linked
 * to a specific component. No fictional sizes.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

namespace FootballFactory\Theme;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Image size registry. Each entry:
 *
 *   - slug:        internal name passed to add_image_size()
 *   - width:       integer pixels
 *   - height:      integer pixels (0 = proportional)
 *   - crop:        bool — true to hard-crop, false to soft-fit
 *   - component:   intended consuming component (TP-XXX)
 *   - responsive:  array<int> width hints for srcset
 *
 * @return array<int,array{slug:string,width:int,height:int,crop:bool,component:string,responsive:list<int>}>
 */
final class Images {

	/**
	 * The single source of truth for image sizes.
	 *
	 * This is a `private const` pattern: PHP doesn't have
	 * typed class constants yet, so we expose a static
	 * method that returns the same array.
	 *
	 * @return array<int,array{slug:string,width:int,height:int,crop:bool,component:string,responsive:list<int>}>
	 */
	public static function sizes(): array {
		return array(
			array(
				'slug'       => 'ff-hero',
				'width'      => 1280,
				'height'     => 720,
				'crop'       => true,
				'component'  => 'TP-038 (cards/hero) and TP-001 (header/site-header brand hero)',
				'responsive' => array( 640, 960, 1280, 1920 ),
			),
			array(
				'slug'       => 'ff-news-card',
				'width'      => 480,
				'height'     => 270,
				'crop'       => true,
				'component'  => 'TP-006 (news/news-card) and TP-009 (article/related-news)',
				'responsive' => array( 240, 360, 480, 720 ),
			),
			array(
				'slug'       => 'ff-thumbnail',
				'width'      => 120,
				'height'     => 120,
				'crop'       => true,
				'component'  => 'Default list thumbnail (used in news-list, search results)',
				'responsive' => array( 60, 120, 240 ),
			),
			array(
				'slug'       => 'ff-player',
				'width'      => 240,
				'height'     => 240,
				'crop'       => true,
				'component'  => 'TP-034 (player/card) and TP-031 (player/hero)',
				'responsive' => array( 120, 240, 480 ),
			),
			array(
				'slug'       => 'ff-team',
				'width'      => 320,
				'height'     => 320,
				'crop'       => true,
				'component'  => 'TP-030 (team/card) and TP-027 (team/hero)',
				'responsive' => array( 160, 320, 640 ),
			),
			array(
				'slug'       => 'ff-league',
				'width'      => 160,
				'height'     => 160,
				'crop'       => true,
				'component'  => 'TP-026 (league/card) and TP-024 (league/team-tags)',
				'responsive' => array( 80, 160, 320 ),
			),
		);
	}

	/**
	 * Hook registration.
	 *
	 * @return void
	 */
	public static function register(): void {
		add_action( 'after_setup_theme', array( self::class, 'register_sizes' ) );
	}

	/**
	 * Register all approved sizes.
	 *
	 * @return void
	 */
	public static function register_sizes(): void {
		foreach ( self::sizes() as $size ) {
			add_image_size(
				$size['slug'],
				$size['width'],
				$size['height'],
				$size['crop']
			);
		}
	}
}

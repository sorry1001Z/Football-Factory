<?php
/** Read/write tests exclusively for the isolated QA WordPress database. */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI || ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX ) { return; }
$checks = 0;
$assert = function ( $condition, $message ) use ( &$checks ) { if ( ! $condition ) { throw new RuntimeException( $message ); } ++$checks; echo "PASS: $message\n"; };
$assert( ff90_layout() === 'colormag-01', 'default layout B' );
foreach ( array( null, '', 'bad', '<script>alert(1)</script>', array(), '../../single.php' ) as $bad ) { $assert( ff90_sanitize_layout( $bad ) === 'colormag-01', 'invalid layout falls back safely' ); }
$assert( count( ff90_banner_kinds() ) === 13, '13 banner kinds' );
require_once ABSPATH . 'wp-includes/class-wp-customize-manager.php';
$setting_manager = new WP_Customize_Manager();
do_action( 'customize_register', $setting_manager );
$setting = $setting_manager->get_setting( 'ff90_home_layout' );
$assert( $setting->capability === 'edit_theme_options', 'Customizer edit_theme_options capability' );
$assert( $setting->sanitize_callback === 'ff90_sanitize_layout', 'Customizer allowlist sanitizer' );
$posts = ff90_news_query( array( 'posts_per_page' => -1 ) )->posts;
$before = array();
foreach ( $posts as $post ) { $before[ $post->ID ] = array( get_permalink( $post ), get_post_thumbnail_id( $post ), $post->post_content, get_post_meta( $post->ID ) ); $assert( $post->post_status === 'publish', 'only published query result' ); }
$initial = get_theme_mod( 'ff90_home_layout' );
foreach ( array( 'main-v2', 'colormag-01', 'main-v2', 'colormag-01' ) as $layout ) {
    set_theme_mod( 'ff90_home_layout', $layout );
    $assert( ff90_layout() === $layout, 'layout selection roundtrip ' . $layout );
    foreach ( $posts as $post ) { $now = get_post( $post ); $assert( $before[ $post->ID ] === array( get_permalink( $post ), get_post_thumbnail_id( $post ), $now->post_content, get_post_meta( $post->ID ) ), 'content/permalink/media/meta unchanged ' . $post->ID ); }
}
set_theme_mod( 'ff90_home_layout', $initial );
$assert( ff90_fixture_date()->format( 'Y-m-d' ) === wp_date( 'Y-m-d' ), 'today follows WP timezone' );
$_GET['ff90_date'] = '2026-10-18';
$assert( ff90_fixture_date()->format( 'Y-m-d' ) === '2026-10-18', 'ISO date accepted' );
$_GET['ff90_date'] = '2026-02-31';
$assert( ff90_fixture_date()->format( 'Y-m-d' ) === wp_date( 'Y-m-d' ), 'impossible date falls back' );
$_GET['ff90_date'] = array( 'x' );
$assert( ff90_fixture_date()->format( 'Y-m-d' ) === wp_date( 'Y-m-d' ), 'array input falls back' );
unset( $_GET['ff90_date'] );
echo "TOTAL: $checks checks passed\n";

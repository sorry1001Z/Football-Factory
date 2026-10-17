<?php
/**
 * Plugin Name: FF90 Featured Banner Renderer
 * Description: Theme-independent, uncropped native Featured Image presentation for thirteen banner categories. No image generation service.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * License: GPL-3.0-or-later
 * Text Domain: ff90-banner-renderer
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_banner_renderer_kinds() { return array( 'general', 'breaking', 'transfer', 'preview', 'result', 'standings', 'stats', 'tactics', 'team', 'competition', 'infographic', 'youth', 'feature' ); }
function ff90_banner_renderer_kind( $value ) {
    $aliases = array( 'transfers' => 'transfer', 'match-preview' => 'preview', 'statistics' => 'stats', 'tactical' => 'tactics', 'team-news' => 'team', 'features' => 'feature' );
    $value = is_string( $value ) ? sanitize_key( $value ) : ''; $value = $aliases[ $value ] ?? $value; return in_array( $value, ff90_banner_renderer_kinds(), true ) ? $value : 'general';
}
add_action( 'init', function () {
    register_post_meta( 'post', '_ff90_banner_kind', array( 'single' => true, 'type' => 'string', 'default' => '', 'sanitize_callback' => function ( $value ) { return '' === $value ? '' : ff90_banner_renderer_kind( $value ); }, 'auth_callback' => function ( $allowed, $key, $id ) { return current_user_can( 'edit_post', $id ); }, 'show_in_rest' => array( 'schema' => array( 'type' => 'string', 'enum' => array_merge( array( '' ), ff90_banner_renderer_kinds() ) ) ) ) );
} );
function ff90_banner_renderer_post_kind( $post_id, $override = '' ) {
    $raw = $override ?: get_post_meta( $post_id, '_ff90_banner_kind', true ); if ( is_string( $raw ) && '' !== $raw ) { return ff90_banner_renderer_kind( $raw ); }
    foreach ( get_the_category( $post_id ) as $term ) { $kind = ff90_banner_renderer_kind( $term->slug ); if ( 'general' !== $kind || 'general' === $term->slug ) { return $kind; } }
    return 'general';
}
function ff90_banner_renderer_render( $post_id = 0, $kind = '' ) {
    $post = get_post( $post_id ?: get_the_ID() );
    if ( ! $post || 'publish' !== $post->post_status || ! is_post_publicly_viewable( $post ) || $post->post_password ) { return ''; }
    $image = get_post_thumbnail_id( $post ); if ( ! $image || ! wp_attachment_is_image( $image ) ) { return ''; }
    $kind = ff90_banner_renderer_post_kind( $post->ID, $kind );
    $alt = trim( get_post_meta( $image, '_wp_attachment_image_alt', true ) ) ?: wp_strip_all_tags( get_the_title( $post ) );
    $html = wp_get_attachment_image( $image, 'full', false, array( 'alt' => $alt, 'class' => 'ff90-banner-image', 'style' => 'display:block;width:100%;max-width:100%;height:auto;object-fit:contain', 'loading' => 'lazy' ) );
    return '<figure class="ff90-featured-banner banner-kind-' . esc_attr( $kind ) . '" style="margin:0;max-width:100%">' . $html . '</figure>';
}
add_shortcode( 'ff90_featured_banner', function ( $args ) { $args = shortcode_atts( array( 'post_id' => 0, 'kind' => '' ), $args ); return ff90_banner_renderer_render( absint( $args['post_id'] ), $args['kind'] ); } );
add_action( 'ff90_featured_banner', function ( $post_id = 0 ) { echo ff90_banner_renderer_render( $post_id ); } );

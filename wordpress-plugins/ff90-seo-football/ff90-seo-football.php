<?php
/**
 * Plugin Name: FF90 SEO Football Adapter
 * Description: Optional football identities and intent rules for the reusable FF90 SEO engine. No live scores or invented routes.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Requires Plugins: ff90-seo
 * License: GPL-3.0-or-later
 * Text Domain: ff90-seo-football
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
add_action( 'plugins_loaded', function () {
    if ( ! interface_exists( '\FF90\SEO\DomainAdapter' ) || ! class_exists( '\FF90\SEO\Intent' ) ) { return; }
    require_once __DIR__ . '/includes/FootballAdapter.php';
    $registry = json_decode( file_get_contents( __DIR__ . '/data/registry.json' ), true );
    $registry = apply_filters( 'ff90_seo_football_registry', $registry );
    if ( ! is_array( $registry ) ) { return; }
    $adapter = new \FF90\SEO\Football\FootballAdapter( $registry, 'ff90_seo_football_route' );
    $GLOBALS['ff90_seo_football_adapter'] = $adapter;
    add_filter( 'ff90_seo_domain_adapter', function ( $existing ) use ( $adapter ) { return $existing ?: $adapter; } );
} );
function ff90_seo_football_route( $entity ) {
    $terms = get_terms( array( 'taxonomy' => get_taxonomies( array( 'public' => true ) ), 'hide_empty' => false, 'number' => 3, 'meta_query' => array( array( 'key' => '_ff90_seo_football_id', 'value' => $entity['id'] ), array( 'key' => '_ff90_seo_football_verified', 'value' => '1' ) ) ) );
    // Multiple mappings are ambiguous: never pick a landing page arbitrarily.
    if ( is_wp_error( $terms ) || 1 !== count( $terms ) ) { return ''; }
    $url = get_term_link( $terms[0] ); return is_wp_error( $url ) ? '' : $url;
}
add_action( 'init', function () {
    foreach ( get_taxonomies( array( 'public' => true ) ) as $taxonomy ) {
        add_action( $taxonomy . '_edit_form_fields', function ( $term ) {
            $adapter = $GLOBALS['ff90_seo_football_adapter'] ?? null; if ( ! $adapter ) { return; }
            $id = get_term_meta( $term->term_id, '_ff90_seo_football_id', true );
            echo '<tr class="form-field"><th><label for="ff90-football-entity">Football identity</label></th><td>'; wp_nonce_field( 'ff90_football_term_' . $term->term_id, 'ff90_football_nonce' );
            echo '<select name="ff90_football_id" id="ff90-football-entity"><option value="">None</option>';
            foreach ( $adapter->catalog() as $row ) { echo '<option value="' . esc_attr( $row['id'] ) . '" ' . selected( $id, $row['id'], false ) . '>' . esc_html( $row['name'] . ' — ' . $row['id'] ) . '</option>'; }
            echo '</select><p><label><input type="checkbox" name="ff90_football_verified" value="1" ' . checked( get_term_meta( $term->term_id, '_ff90_seo_football_verified', true ), '1', false ) . '> I verified this public archive is the correct entity landing page</label></p><p>Static identity seed only. Does not verify current squad, competition membership or match data.</p></td></tr>';
        } );
        add_action( 'edited_' . $taxonomy, function ( $id ) use ( $taxonomy ) {
            $tax = get_taxonomy( $taxonomy );
            if ( ! current_user_can( $tax->cap->edit_terms ) || ! isset( $_POST['ff90_football_nonce'] ) || ! is_string( $_POST['ff90_football_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['ff90_football_nonce'] ) ), 'ff90_football_term_' . $id ) ) { return; }
            $adapter = $GLOBALS['ff90_seo_football_adapter'] ?? null; $value = isset( $_POST['ff90_football_id'] ) && is_string( $_POST['ff90_football_id'] ) ? sanitize_text_field( wp_unslash( $_POST['ff90_football_id'] ) ) : '';
            if ( ! $adapter || ! isset( $adapter->catalog()[ $value ] ) ) { $value = ''; }
            update_term_meta( $id, '_ff90_seo_football_id', $value ); update_term_meta( $id, '_ff90_seo_football_verified', $value && ! empty( $_POST['ff90_football_verified'] ) ? '1' : '0' );
        } );
    }
}, 20 );

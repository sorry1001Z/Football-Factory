<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_seo_settings() {
    $saved = get_option( 'ff90_seo_settings', array() );
    return array_merge( array( 'owner' => 'advisory', 'gate' => false, 'title_h1' => true ), is_array( $saved ) ? $saved : array() );
}
function ff90_seo_foreign_owner() {
    return defined( 'WPSEO_VERSION' ) || defined( 'RANK_MATH_VERSION' ) || defined( 'AIOSEO_VERSION' ) || defined( 'SEOPRESS_VERSION' ) || apply_filters( 'ff90_seo_external_owner', false );
}
function ff90_seo_owns_output() { return 'standalone' === ff90_seo_settings()['owner'] && ! ff90_seo_foreign_owner(); }
function ff90_seo_analyze( $id, $draft = array() ) {
    $post = get_post( $id );
    if ( ! $post || ! in_array( $post->post_type, array( 'post', 'page' ), true ) ) { return new WP_Error( 'not_found', 'Supported post not found.', array( 'status' => 404 ) ); }
    $meta = get_post_meta( $id, '_ff90_seo', true ); $meta = is_array( $meta ) ? $meta : array();
    $values = array_merge( array( 'title' => $post->post_title, 'content' => $post->post_content, 'description' => $meta['description'] ?? '', 'canonical' => $meta['canonical'] ?? '' ), $draft );
    $canonical = trim( $values['canonical'] ) ?: get_permalink( $id );
    $valid = \FF90\SEO\Policy::canonical( home_url( '/' ), $canonical );
    $report = \FF90\SEO\Policy::analyze( array_merge( $values, array( 'canonical_valid' => $valid['ok'], 'theme_title_h1' => (bool) ff90_seo_settings()['title_h1'] ) ) );
    $report['canonical'] = $valid;
    $report['links'] = ff90_seo_link_suggestions( $id, $values['content'] );
    $adapter = apply_filters( 'ff90_seo_domain_adapter', null );
    $report['domain'] = array( 'connected' => $adapter instanceof \FF90\SEO\DomainAdapter, 'entities' => array(), 'suggested_schema' => array() );
    if ( $adapter instanceof \FF90\SEO\DomainAdapter ) {
        foreach ( array_slice( $adapter->resolveEntity( $values['title'] . ' ' . wp_strip_all_tags( $values['content'] ) ), 0, 40 ) as $entity ) {
            if ( ! is_array( $entity ) ) { continue; }
            $report['domain']['entities'][] = $entity;
            foreach ( $adapter->getSchemaExtensions( $entity ) as $schema ) { if ( is_array( $schema ) && ! empty( $schema['@type'] ) ) { $report['domain']['suggested_schema'][] = $schema; } }
        }
    }
    $report['gsc'] = array( 'connected' => false, 'reason' => 'connector_not_implemented' );
    return $report;
}
/** Suggestions only. No automatic link insertion, entity guessing or content mutation. */
function ff90_seo_link_suggestions( $id, $html ) {
    // Remove existing links, headings, attributes, scripts and comments before matching term labels.
    $safe = preg_replace( '~<(a|h[1-6]|script|style)\b[^>]*>.*?</\1>|<!--.*?-->~is', ' ', $html );
    $text = wp_strip_all_tags( $safe ); $candidates = array();
    $taxonomies = get_object_taxonomies( get_post_type( $id ), 'objects' );
    foreach ( $taxonomies as $taxonomy ) {
        if ( ! $taxonomy->public ) { continue; }
        $terms = wp_get_post_terms( $id, $taxonomy->name );
        if ( is_wp_error( $terms ) ) { continue; }
        foreach ( $terms as $term ) {
            if ( '' === trim( $term->name ) || ! preg_match( '/' . preg_quote( $term->name, '/' ) . '/iu', $text ) ) { continue; }
            $url = get_term_link( $term );
            if ( is_wp_error( $url ) ) { continue; }
            $key = function_exists( 'mb_strtolower' ) ? mb_strtolower( $term->name, 'UTF-8' ) : strtolower( $term->name );
            $candidates[ $key ][] = array( 'label' => $term->name, 'url' => $url, 'taxonomy' => $taxonomy->name, 'term_id' => $term->term_id, 'reason' => 'assigned_public_taxonomy' );
        }
    }
    $out = array();
    ksort( $candidates );
    foreach ( $candidates as $items ) { if ( 1 === count( $items ) && count( $out ) < 6 ) { $out[] = $items[0]; } }
    return $out;
}
function ff90_seo_clean_meta( $input ) {
    if ( ! is_array( $input ) ) { return array( 'description' => '', 'canonical' => '', 'noindex' => false ); }
    return array( 'description' => isset( $input['description'] ) && is_string( $input['description'] ) ? mb_substr( sanitize_text_field( $input['description'] ), 0, 320, 'UTF-8' ) : '', 'canonical' => isset( $input['canonical'] ) && is_string( $input['canonical'] ) ? mb_substr( sanitize_text_field( $input['canonical'] ), 0, 2000, 'UTF-8' ) : '', 'noindex' => ! empty( $input['noindex'] ) );
}
add_action( 'init', function () {
    foreach ( array( 'post', 'page' ) as $type ) {
        register_post_meta( $type, '_ff90_seo', array( 'single' => true, 'type' => 'object', 'default' => array( 'description' => '', 'canonical' => '', 'noindex' => false ), 'sanitize_callback' => 'ff90_seo_clean_meta', 'auth_callback' => function ( $allowed, $key, $id ) { return current_user_can( 'edit_post', $id ); }, 'show_in_rest' => array( 'schema' => array( 'type' => 'object', 'properties' => array( 'description' => array( 'type' => 'string' ), 'canonical' => array( 'type' => 'string' ), 'noindex' => array( 'type' => 'boolean' ) ), 'additionalProperties' => false ) ) ) );
    }
} );
add_action( 'rest_api_init', function () {
    register_rest_route( 'ff90-seo/v1', '/analyze/(?P<id>\d+)', array( 'methods' => 'POST', 'permission_callback' => function ( $r ) { return current_user_can( 'edit_post', (int) $r['id'] ); }, 'args' => array_fill_keys( array( 'title', 'content', 'description', 'canonical' ), array( 'type' => 'string', 'maxLength' => 200000 ) ), 'callback' => function ( $r ) {
        $draft = array();
        foreach ( array( 'title', 'content', 'description', 'canonical' ) as $key ) { if ( null !== $r->get_param( $key ) ) { $draft[ $key ] = $r->get_param( $key ); } }
        return ff90_seo_analyze( (int) $r['id'], $draft );
    } ) );
} );
add_action( 'admin_init', function () {
    register_setting( 'ff90_seo', 'ff90_seo_settings', array( 'type' => 'array', 'sanitize_callback' => function ( $value ) { $value = is_array( $value ) ? $value : array(); return array( 'owner' => 'standalone' === ( $value['owner'] ?? '' ) ? 'standalone' : 'advisory', 'gate' => ! empty( $value['gate'] ), 'title_h1' => ! empty( $value['title_h1'] ) ); } ) );
} );
add_action( 'admin_menu', function () {
    add_options_page( 'FF90 SEO', 'FF90 SEO', 'manage_options', 'ff90-seo', function () {
        if ( ! current_user_can( 'manage_options' ) ) { return; } $s = ff90_seo_settings();
        echo '<div class="wrap"><h1>FF90 Modular SEO</h1><p>Default: analysis only. GSC: not connected. No content is sent to an external analysis API.</p><p>Standalone mode owns singular metadata and coordinates the known Football Factory Core schema. Recognized SEO plugins take precedence. Test other plugins on staging before enabling.</p><form method="post" action="options.php">'; settings_fields( 'ff90_seo' );
        echo '<p><label>Metadata owner <select name="ff90_seo_settings[owner]"><option value="advisory" ' . selected( $s['owner'], 'advisory', false ) . '>Advisory — existing SEO owns output</option><option value="standalone" ' . selected( $s['owner'], 'standalone', false ) . '>FF90 standalone</option></select></label></p><p><label><input type="checkbox" name="ff90_seo_settings[gate]" value="1" ' . checked( $s['gate'], true, false ) . '> Enforce structural publish gate (invalid canonical, title and H1 only)</label></p><p><label><input type="checkbox" name="ff90_seo_settings[title_h1]" value="1" ' . checked( $s['title_h1'], true, false ) . '> Theme renders post title as H1</label></p><p>Thai length/readability signals are heuristic warnings. Scores do not verify facts or predict ranking. Google Indexing API is not enabled for ordinary news.</p>'; submit_button(); echo '</form></div>';
    } );
} );
add_action( 'add_meta_boxes', function () {
    foreach ( array( 'post', 'page' ) as $type ) {
        add_meta_box( 'ff90-seo-classic', 'FF90 SEO (saved article)', function ( $post ) {
            $meta = ff90_seo_clean_meta( get_post_meta( $post->ID, '_ff90_seo', true ) ); wp_nonce_field( 'ff90_seo_' . $post->ID, 'ff90_seo_nonce' );
            echo '<p><label>Description <textarea class="widefat" name="ff90_seo[description]">' . esc_textarea( $meta['description'] ) . '</textarea></label></p><p><label>Canonical override (leave empty for native permalink) <input type="url" class="widefat" name="ff90_seo[canonical]" value="' . esc_attr( $meta['canonical'] ) . '"></label></p><p><label><input type="checkbox" name="ff90_seo[noindex]" value="1" ' . checked( $meta['noindex'], true, false ) . '> Noindex</label></p>';
            $r = ff90_seo_analyze( $post->ID ); if ( ! is_wp_error( $r ) ) { echo '<p>Saved content score: ' . esc_html( (string) $r['score'] ) . '</p><p>' . esc_html( implode( ', ', array_merge( $r['blocking'], $r['warnings'] ) ) ) . '</p><ul>'; foreach ( $r['links'] as $link ) { echo '<li><a href="' . esc_url( $link['url'] ) . '">' . esc_html( $link['label'] ) . '</a></li>'; } echo '</ul>'; }
        }, $type, 'normal', 'default', array( '__back_compat_meta_box' => true ) );
    }
} );
add_action( 'save_post', function ( $id ) {
    if ( wp_is_post_revision( $id ) || wp_is_post_autosave( $id ) || ! current_user_can( 'edit_post', $id ) || ! isset( $_POST['ff90_seo_nonce'] ) || ! is_string( $_POST['ff90_seo_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['ff90_seo_nonce'] ) ), 'ff90_seo_' . $id ) ) { return; }
    update_post_meta( $id, '_ff90_seo', ff90_seo_clean_meta( isset( $_POST['ff90_seo'] ) && is_array( $_POST['ff90_seo'] ) ? wp_unslash( $_POST['ff90_seo'] ) : array() ) );
} );
add_action( 'enqueue_block_editor_assets', function () {
    $post = get_post(); if ( ! $post || ! in_array( $post->post_type, array( 'post', 'page' ), true ) ) { return; }
    wp_enqueue_script( 'ff90-seo-editor', plugins_url( '../assets/editor.js', __FILE__ ), array( 'wp-plugins', 'wp-editor', 'wp-element', 'wp-components', 'wp-data', 'wp-api-fetch' ), '0.1.0', true );
} );
/** Analysis gate is opt-in; never publishes content or overrides human review. */
add_filter( 'wp_insert_post_data', function ( $data, $postarr ) {
    if ( ! ff90_seo_settings()['gate'] || ! in_array( $data['post_type'], array( 'post', 'page' ), true ) || ! in_array( $data['post_status'], array( 'publish', 'future' ), true ) ) { return $data; }
    $id = (int) ( $postarr['ID'] ?? 0 );
    // Native new-post insert has no stable permalink yet; fail closed and let editor save a draft first.
    $r = $id ? ff90_seo_analyze( $id, array( 'title' => wp_unslash( $data['post_title'] ), 'content' => wp_unslash( $data['post_content'] ) ) ) : new WP_Error( 'save_first', 'Save draft first.' );
    if ( is_wp_error( $r ) || ! \FF90\SEO\Policy::gate( $r ) ) { $data['post_status'] = 'pending'; }
    return $data;
}, 90, 2 );
function ff90_seo_recheck( $id ) {
    if ( ! ff90_seo_settings()['gate'] ) { return; } $post = get_post( $id );
    if ( ! $post || ! in_array( $post->post_type, array( 'post', 'page' ), true ) || ! in_array( $post->post_status, array( 'publish', 'future' ), true ) ) { return; }
    $r = ff90_seo_analyze( $id ); if ( is_wp_error( $r ) || ! \FF90\SEO\Policy::gate( $r ) ) { wp_update_post( array( 'ID' => $id, 'post_status' => 'pending' ) ); }
}
add_action( 'transition_post_status', function ( $new, $old, $post ) { if ( 'publish' === $new || 'future' === $new ) { ff90_seo_recheck( $post->ID ); } }, 0, 3 );
add_action( 'rest_after_insert_post', function ( $post ) { ff90_seo_recheck( $post->ID ); }, 99 );
add_action( 'rest_after_insert_page', function ( $post ) { ff90_seo_recheck( $post->ID ); }, 99 );
foreach ( array( 'added_post_meta', 'updated_post_meta', 'deleted_post_meta' ) as $hook ) { add_action( $hook, function ( $mid, $id, $key ) { if ( '_ff90_seo' === $key ) { ff90_seo_recheck( $id ); } }, 99, 3 ); }
require_once __DIR__ . '/output.php';

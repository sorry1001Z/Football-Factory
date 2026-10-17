<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_qa_clean_sources( $raw ) {
    if ( is_array( $raw ) ) { return array_slice( array_values( array_unique( array_map( 'sanitize_text_field', $raw ) ) ), 0, 50 ); }
    if ( ! is_string( $raw ) ) { return array(); }
    return array_slice( array_values( array_unique( array_filter( array_map( 'sanitize_text_field', array_map( 'trim', preg_split( '/\R/', substr( $raw, 0, 20000 ) ) ) ) ) ) ), 0, 50 );
}
function ff90_qa_snapshot( $id ) {
    $post = get_post( $id ); if ( ! $post ) { return array(); }
    $sources = get_post_meta( $id, '_ff90_qa_sources', true );
    return array( 'title' => $post->post_title, 'content' => $post->post_content, 'excerpt' => $post->post_excerpt, 'image' => (int) get_post_thumbnail_id( $id ), 'image_hash' => function_exists( 'ff90_image_digest' ) ? ff90_image_digest( get_post_thumbnail_id( $id ) ) : '', 'author' => (int) $post->post_author, 'sources' => is_array( $sources ) ? array_values( $sources ) : array() );
}
function ff90_qa_fingerprint( $id, $overrides = array() ) { return hash( 'sha256', wp_json_encode( array_merge( ff90_qa_snapshot( $id ), $overrides ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ); }
function ff90_qa_can_review( $id ) {
    $post = get_post( $id ); return $post && 'post' === $post->post_type && current_user_can( 'edit_post', $id ) && current_user_can( 'edit_others_posts' ) && current_user_can( 'publish_posts' ) && (int) $post->post_author !== get_current_user_id();
}
function ff90_qa_structure( $id ) {
    $s = ff90_qa_snapshot( $id ); $errors = array();
    if ( ! $s ) { return array( 'post_not_found' ); }
    if ( '' === trim( wp_strip_all_tags( $s['title'] ) ) ) { $errors[] = 'missing_title'; }
    if ( '' === trim( wp_strip_all_tags( $s['content'] ) ) ) { $errors[] = 'missing_body'; }
    if ( preg_match( '/\b(?:TODO|Lorem ipsum)\b|\[INSERT[^\]]*\]/iu', $s['title'] . ' ' . wp_strip_all_tags( $s['content'] ) ) ) { $errors[] = 'placeholder_text'; }
    if ( ! $s['sources'] ) { $errors[] = 'missing_sources'; }
    foreach ( $s['sources'] as $url ) { $p = is_string( $url ) ? wp_parse_url( $url ) : false; if ( ! $p || empty( $p['host'] ) || ! in_array( $p['scheme'] ?? '', array( 'http', 'https' ), true ) || isset( $p['user'] ) || isset( $p['pass'] ) || ! filter_var( $url, FILTER_VALIDATE_URL ) ) { $errors[] = 'invalid_source_url'; break; } }
    return array_values( array_unique( apply_filters( 'ff90_qa_structural_errors', $errors, $id ) ) );
}
function ff90_qa_report( $id ) {
    $record = get_post_meta( $id, '_ff90_qa_review', true ); $current = ff90_qa_fingerprint( $id );
    $valid = is_array( $record ) && ! empty( $record['facts'] ) && ! empty( $record['rights'] ) && ! empty( $record['reviewer'] ) && isset( $record['fingerprint'] ) && hash_equals( $current, $record['fingerprint'] );
    return array( 'fingerprint' => $current, 'errors' => ff90_qa_structure( $id ), 'human_review_current' => $valid, 'fact_check' => $valid ? 'human_attested' : 'requires_human_review', 'automated_fact_verification' => false );
}
function ff90_qa_verify( $id, $fingerprint, $facts, $rights, $note = '' ) {
    if ( ! ff90_qa_can_review( $id ) ) { return new WP_Error( 'qa_forbidden', 'Independent editor review required.' ); }
    if ( ! is_string( $fingerprint ) || ! hash_equals( ff90_qa_fingerprint( $id ), $fingerprint ) ) { return new WP_Error( 'qa_stale', 'Saved content changed; review the current version.' ); }
    if ( ff90_qa_structure( $id ) || ! $facts || ! $rights ) { return new WP_Error( 'qa_incomplete', 'Fix structural issues and verify facts and image rights first.' ); }
    $record = array( 'fingerprint' => $fingerprint, 'facts' => true, 'rights' => true, 'reviewer' => get_current_user_id(), 'at' => gmdate( 'c' ), 'note' => sanitize_textarea_field( $note ) );
    update_post_meta( $id, '_ff90_qa_review', $record ); do_action( 'ff90_audit_event', 'qa_human_verified', $id ); return $record;
}
add_action( 'add_meta_boxes', function () {
    add_meta_box( 'ff90-content-qa', 'Content QA / แหล่งข้อมูล', function ( $post ) {
        wp_nonce_field( 'ff90_qa_' . $post->ID, 'ff90_qa_nonce' ); $s = ff90_qa_snapshot( $post->ID ); $r = ff90_qa_report( $post->ID );
        echo '<p><label for="ff90-qa-sources">Source URLs — หนึ่ง URL ต่อบรรทัด</label></p><textarea class="widefat" id="ff90-qa-sources" name="ff90_qa_sources" rows="4">' . esc_textarea( implode( "\n", $s['sources'] ) ) . '</textarea><p>' . esc_html( implode( ', ', $r['errors'] ) ?: $r['fact_check'] ) . '</p><p>ตรวจโครงสร้างอัตโนมัติ; ข้อเท็จจริงและสิทธิ์ภาพต้องให้คนตรวจ</p>';
        if ( ff90_qa_can_review( $post->ID ) ) { echo '<a class="button" href="' . esc_url( admin_url( 'admin.php?action=ff90_qa_review&post=' . $post->ID ) ) . '">Review saved facts and rights</a>'; }
    }, 'post', 'normal', 'default', array( '__back_compat_meta_box' => true ) );
} );
add_action( 'save_post_post', function ( $id ) {
    if ( wp_is_post_revision( $id ) || wp_is_post_autosave( $id ) || ! current_user_can( 'edit_post', $id ) || ! isset( $_POST['ff90_qa_nonce'] ) || ! is_string( $_POST['ff90_qa_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['ff90_qa_nonce'] ) ), 'ff90_qa_' . $id ) ) { return; }
    $raw = isset( $_POST['ff90_qa_sources'] ) && is_string( $_POST['ff90_qa_sources'] ) ? wp_unslash( $_POST['ff90_qa_sources'] ) : '';
    update_post_meta( $id, '_ff90_qa_sources', ff90_qa_clean_sources( $raw ) );
} );
add_action( 'admin_action_ff90_qa_review', function () {
    $id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0; if ( ! ff90_qa_can_review( $id ) ) { wp_die( 'Forbidden', '', array( 'response' => 403 ) ); }
    if ( 'POST' === ( $_SERVER['REQUEST_METHOD'] ?? '' ) ) {
        check_admin_referer( 'ff90_qa_review_' . $id );
        $fingerprint = isset( $_POST['fingerprint'] ) && is_string( $_POST['fingerprint'] ) ? sanitize_text_field( wp_unslash( $_POST['fingerprint'] ) ) : '';
        $note = isset( $_POST['note'] ) && is_string( $_POST['note'] ) ? wp_unslash( $_POST['note'] ) : '';
        $r = ff90_qa_verify( $id, $fingerprint, ! empty( $_POST['facts'] ), ! empty( $_POST['rights'] ), $note ); if ( is_wp_error( $r ) ) { wp_die( esc_html( $r->get_error_message() ), '', array( 'response' => 400 ) ); } wp_safe_redirect( get_edit_post_link( $id, 'raw' ) ); exit;
    }
    echo '<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Human QA</title><body><main><h1>Human fact and rights review</h1><h2>' . esc_html( get_the_title( $id ) ) . '</h2><p><a href="' . esc_url( get_preview_post_link( $id ) ) . '">Preview saved article</a></p><ul>';
    foreach ( ff90_qa_snapshot( $id )['sources'] as $url ) { echo '<li>' . esc_html( $url ) . '</li>'; } echo '</ul><form method="post">'; wp_nonce_field( 'ff90_qa_review_' . $id );
    echo '<input type="hidden" name="fingerprint" value="' . esc_attr( ff90_qa_fingerprint( $id ) ) . '"><p><label><input type="checkbox" name="facts" value="1" required> ฉันตรวจข้อเท็จจริงกับแหล่งอ้างอิงแล้ว</label></p><p><label><input type="checkbox" name="rights" value="1" required> ฉันตรวจสิทธิ์ภาพแล้ว</label></p><p><label>Review note <textarea name="note"></textarea></label></p><button type="submit">Record human verification</button></form></main></body></html>'; exit;
} );
add_action( 'rest_api_init', function () {
    register_rest_route( 'ff90-qa/v1', '/posts/(?P<id>\d+)', array( 'methods' => 'GET', 'permission_callback' => function ( $r ) { return current_user_can( 'edit_post', (int) $r['id'] ); }, 'callback' => function ( $r ) { return get_post( $r['id'] ) ? ff90_qa_report( (int) $r['id'] ) : new WP_Error( 'not_found', 'Post not found.', array( 'status' => 404 ) ); } ) );
} );

add_action( 'init', function () {
    register_post_meta( 'post', '_ff90_qa_sources', array( 'single' => true, 'type' => 'array', 'default' => array(), 'sanitize_callback' => 'ff90_qa_clean_sources', 'auth_callback' => function ( $allowed, $key, $id ) { return current_user_can( 'edit_post', $id ); }, 'show_in_rest' => array( 'schema' => array( 'type' => 'array', 'context' => array( 'edit' ), 'maxItems' => 50, 'items' => array( 'type' => 'string', 'maxLength' => 2000 ) ) ) ) );
} );

add_action( 'enqueue_block_editor_assets', function () {
    $post = get_post(); if ( ! $post || 'post' !== $post->post_type ) { return; }
    wp_enqueue_script( 'ff90-content-qa-editor', plugins_url( '../assets/editor.js', __FILE__ ), array( 'wp-plugins', 'wp-editor', 'wp-element', 'wp-data', 'wp-components', 'wp-api-fetch' ), '0.1.0', true );
    wp_add_inline_script( 'ff90-content-qa-editor', 'window.ff90QAPanel=' . wp_json_encode( array( 'canReview' => ff90_qa_can_review( $post->ID ), 'qaUrl' => admin_url( 'admin.php?action=ff90_qa_review&post=' . $post->ID ), 'approvalUrl' => function_exists( 'ff90_editorial_decide' ) ? admin_url( 'admin.php?action=ff90_editorial_review&post=' . $post->ID ) : '' ), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) . ';', 'before' );
} );

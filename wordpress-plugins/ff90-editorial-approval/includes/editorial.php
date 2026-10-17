<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_editorial_options() { return wp_parse_args( get_option( 'ff90_editorial_options', array() ), array( 'enforce' => false, 'paused' => false ) ); }
function ff90_editorial_permits( $id, $overrides = array() ) {
    if ( ! function_exists( 'ff90_qa_report' ) || ! function_exists( 'ff90_qa_fingerprint' ) ) { return false; }
    $r = get_post_meta( $id, '_ff90_editorial_review', true ); $qa = ff90_qa_report( $id );
    return is_array( $r ) && 'approved' === ( $r['state'] ?? '' ) && ! empty( $r['reviewer'] ) && isset( $r['fingerprint'] ) && hash_equals( ff90_qa_fingerprint( $id, $overrides ), $r['fingerprint'] ) && ! $qa['errors'] && $qa['human_review_current'];
}
function ff90_editorial_decide( $id, $decision, $expected, $note = '' ) {
    if ( ! function_exists( 'ff90_qa_can_review' ) || ! ff90_qa_can_review( $id ) ) { return new WP_Error( 'editorial_forbidden', 'An independent editor must review this article.' ); }
    if ( ! is_string( $expected ) || ! hash_equals( ff90_qa_fingerprint( $id ), $expected ) ) { return new WP_Error( 'editorial_stale', 'Content changed; review current saved content.' ); }
    if ( ! in_array( $decision, array( 'approved', 'rejected' ), true ) ) { return new WP_Error( 'editorial_decision', 'Invalid decision.' ); }
    $qa = ff90_qa_report( $id );
    if ( 'approved' === $decision && ( $qa['errors'] || ! $qa['human_review_current'] ) ) { return new WP_Error( 'editorial_qa_required', 'Complete independent source/fact/rights QA first.' ); }
    $record = array( 'state' => $decision, 'fingerprint' => $expected, 'reviewer' => get_current_user_id(), 'at' => gmdate( 'c' ), 'note' => sanitize_textarea_field( $note ) );
    update_post_meta( $id, '_ff90_editorial_review', $record ); add_post_meta( $id, '_ff90_editorial_history', $record ); do_action( 'ff90_audit_event', 'editorial_' . $decision, $id );
    return $record;
}
function ff90_editorial_publish( $id ) {
    if ( ! current_user_can( 'edit_post', $id ) || ! current_user_can( 'publish_posts' ) ) { return new WP_Error( 'editorial_forbidden', 'Publisher permission required.' ); }
    if ( ff90_editorial_options()['paused'] || ! ff90_editorial_permits( $id ) ) { return new WP_Error( 'editorial_not_approved', 'Paused, unapproved or reviewed content changed.' ); }
    $r = wp_update_post( array( 'ID' => $id, 'post_status' => 'publish' ), true );
    return is_wp_error( $r ) ? $r : ( 'publish' === get_post_status( $id ) ? $r : new WP_Error( 'editorial_publish_veto', 'Another active gate vetoed publication.' ) );
}
function ff90_editorial_should_hold( $id, $overrides = array() ) {
    $o = ff90_editorial_options(); return $o['enforce'] && ( $o['paused'] || ! ff90_editorial_permits( $id, $overrides ) );
}
add_filter( 'wp_insert_post_data', function ( $data, $postarr ) {
    if ( 'post' !== $data['post_type'] || ! in_array( $data['post_status'], array( 'publish', 'future' ), true ) ) { return $data; }
    $id = (int) ( $postarr['ID'] ?? 0 );
    $changed = array( 'title' => wp_unslash( $data['post_title'] ), 'content' => wp_unslash( $data['post_content'] ), 'excerpt' => wp_unslash( $data['post_excerpt'] ), 'author' => (int) $data['post_author'] );
    if ( function_exists( 'ff90_qa_clean_sources' ) ) {
        if ( isset( $postarr['meta_input']['_ff90_qa_sources'] ) ) { $changed['sources'] = ff90_qa_clean_sources( $postarr['meta_input']['_ff90_qa_sources'] ); }
        if ( isset( $_POST['ff90_qa_nonce'] ) && is_string( $_POST['ff90_qa_nonce'] ) && wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['ff90_qa_nonce'] ) ), 'ff90_qa_' . $id ) ) { $changed['sources'] = ff90_qa_clean_sources( isset( $_POST['ff90_qa_sources'] ) && is_string( $_POST['ff90_qa_sources'] ) ? wp_unslash( $_POST['ff90_qa_sources'] ) : '' ); }
    }
    if ( isset( $postarr['meta_input']['_thumbnail_id'] ) ) { $changed['image'] = (int) $postarr['meta_input']['_thumbnail_id']; }
    if ( ff90_editorial_should_hold( $id, $changed ) ) { $data['post_status'] = 'pending'; }
    return $data;
}, PHP_INT_MAX, 2 );
// Reject invalid REST attempts before WordPress dispatches publish hooks, including final media/meta.
add_filter( 'rest_pre_insert_post', function ( $prepared, $request ) {
    $o = ff90_editorial_options(); if ( ! $o['enforce'] ) { return $prepared; }
    $id = (int) $request['id']; $old = $id ? get_post_status( $id ) : '';
    $target = $prepared->post_status ?? $old;
    if ( ! in_array( $target, array( 'publish', 'future' ), true ) ) { return $prepared; }
    $changes = array(); foreach ( array( 'post_title' => 'title', 'post_content' => 'content', 'post_excerpt' => 'excerpt', 'post_author' => 'author' ) as $field => $key ) { if ( isset( $prepared->$field ) ) { $changes[ $key ] = 'author' === $key ? (int) $prepared->$field : $prepared->$field; } }
    if ( null !== $request['featured_media'] ) { $changes['image'] = (int) $request['featured_media']; }
    $meta = $request['meta']; if ( is_array( $meta ) && isset( $meta['_ff90_qa_sources'] ) && is_array( $meta['_ff90_qa_sources'] ) ) { $changes['sources'] = array_values( $meta['_ff90_qa_sources'] ); }
    if ( ff90_editorial_should_hold( $id, $changes ) ) { return new WP_Error( 'ff90_review_required', 'Publication paused or this exact saved version lacks current independent approval.', array( 'status' => 409 ) ); }
    return $prepared;
}, PHP_INT_MAX, 2 );
function ff90_editorial_recheck( $id ) {
    $post = get_post( $id ); if ( $post && 'post' === $post->post_type && in_array( $post->post_status, array( 'publish', 'future' ), true ) && ff90_editorial_should_hold( $id ) ) {
        wp_update_post( array( 'ID' => $id, 'post_status' => 'pending' ) ); do_action( 'ff90_audit_event', 'editorial_held_changed_version', $id );
    }
}
foreach ( array( 'added_post_meta', 'updated_post_meta', 'deleted_post_meta' ) as $hook ) {
    add_action( $hook, function ( $mid, $id, $key ) { if ( in_array( $key, array( '_thumbnail_id', '_ff90_qa_sources', '_ff90_qa_review', '_ff90_editorial_review' ), true ) ) { ff90_editorial_recheck( $id ); } }, 99, 3 );
}
add_action( 'rest_after_insert_post', function ( $post ) { ff90_editorial_recheck( $post->ID ); }, 99 );
// The native scheduled publisher has no content approval preflight; wrap that exact core callback.
add_action( 'init', function () {
    remove_action( 'publish_future_post', 'check_and_publish_future_post', 10 );
    add_action( 'publish_future_post', function ( $id ) { if ( ff90_editorial_should_hold( $id ) ) { wp_update_post( array( 'ID' => $id, 'post_status' => 'pending' ) ); do_action( 'ff90_audit_event', 'editorial_scheduled_held', $id ); return; } check_and_publish_future_post( $id ); }, 10 );
} );
add_action( 'add_meta_boxes', function () {
    add_meta_box( 'ff90-editorial', 'Editorial Approval', function ( $post ) {
        $record = get_post_meta( $post->ID, '_ff90_editorial_review', true );
        echo '<p>' . esc_html( ff90_editorial_permits( $post->ID ) ? 'Approved — current saved version' : 'Review required for current saved version' ) . '</p><p>' . esc_html( ff90_editorial_options()['enforce'] ? 'Publishing gate enabled' : 'Advisory mode — publishing gate disabled' ) . '</p>';
        if ( function_exists( 'ff90_qa_can_review' ) && ff90_qa_can_review( $post->ID ) ) { echo '<a class="button" href="' . esc_url( admin_url( 'admin.php?action=ff90_editorial_review&post=' . $post->ID ) ) . '">Approve / reject saved article</a>'; }
    }, 'post', 'side' );
} );
add_action( 'admin_action_ff90_editorial_review', function () {
    $id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0;
    if ( ! function_exists( 'ff90_qa_can_review' ) || ! ff90_qa_can_review( $id ) ) { wp_die( 'Forbidden', '', array( 'response' => 403 ) ); }
    if ( 'POST' === ( $_SERVER['REQUEST_METHOD'] ?? '' ) ) {
        check_admin_referer( 'ff90_editorial_' . $id );
        $decision = isset( $_POST['decision'] ) && is_string( $_POST['decision'] ) ? sanitize_key( $_POST['decision'] ) : '';
        $expected = isset( $_POST['fingerprint'] ) && is_string( $_POST['fingerprint'] ) ? sanitize_text_field( wp_unslash( $_POST['fingerprint'] ) ) : '';
        $note = isset( $_POST['note'] ) && is_string( $_POST['note'] ) ? wp_unslash( $_POST['note'] ) : '';
        $r = ff90_editorial_decide( $id, $decision, $expected, $note ); if ( is_wp_error( $r ) ) { wp_die( esc_html( $r->get_error_message() ), '', array( 'response' => 409 ) ); } wp_safe_redirect( get_edit_post_link( $id, 'raw' ) ); exit;
    }
    echo '<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Editorial review</title><body><main><h1>Editorial review</h1><h2>' . esc_html( get_the_title( $id ) ) . '</h2><p><a href="' . esc_url( get_preview_post_link( $id ) ) . '">Preview saved article</a></p><form method="post">'; wp_nonce_field( 'ff90_editorial_' . $id );
    echo '<input type="hidden" name="fingerprint" value="' . esc_attr( ff90_qa_fingerprint( $id ) ) . '"><p><label>Review note <textarea name="note"></textarea></label></p><button name="decision" value="approved">Approve saved version</button> <button name="decision" value="rejected">Reject</button></form></main></body></html>'; exit;
} );
add_action( 'admin_init', function () { register_setting( 'ff90_editorial', 'ff90_editorial_options', array( 'sanitize_callback' => function ( $v ) { return array( 'enforce' => ! empty( $v['enforce'] ), 'paused' => ! empty( $v['paused'] ) ); } ) ); } );
add_action( 'admin_menu', function () {
    add_options_page( 'Editorial Approval', 'FF90 Editorial', 'manage_options', 'ff90-editorial', function () {
        if ( ! current_user_can( 'manage_options' ) ) { return; } $o = ff90_editorial_options(); echo '<div class="wrap"><h1>Editorial Approval</h1><p>Activation is advisory. Save drafts, complete independent human QA, then approve the exact saved version. Changes invalidate approval. Existing published content is not bulk-modified.</p><form method="post" action="options.php">'; settings_fields( 'ff90_editorial' );
        foreach ( array( 'enforce' => 'Enforce approval on ordinary publishing and scheduling', 'paused' => 'Pause publication (effective when enforcement is enabled)' ) as $key => $label ) { echo '<p><label><input type="checkbox" name="ff90_editorial_options[' . esc_attr( $key ) . ']" value="1" ' . checked( $o[ $key ], true, false ) . '> ' . esc_html( $label ) . '</label></p>'; } submit_button(); echo '</form></div>';
    } );
} );

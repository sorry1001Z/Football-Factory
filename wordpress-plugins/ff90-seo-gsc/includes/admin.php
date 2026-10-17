<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
add_filter( 'ff90_seo_gsc_status', function () { return array( 'connected' => ! is_wp_error( ff90_gsc_tokens() ), 'configured' => (bool) ( ff90_gsc_config( 'client_id' ) && ff90_gsc_config( 'client_secret' ) ), 'property_selected' => (bool) get_option( 'ff90_gsc_property', '' ), 'live_verification' => 'not_implied_by_connection_status' ); } );
function ff90_gsc_admin_result( $result ) {
    if ( is_wp_error( $result ) ) { wp_die( esc_html( $result->get_error_message() ), 'Search Console', array( 'response' => 400 ) ); }
    wp_safe_redirect( admin_url( 'options-general.php?page=ff90-seo-gsc' ) ); exit;
}
add_action( 'admin_post_ff90_gsc_connect', function () {
    if ( 'POST' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) ) { wp_die( 'POST required', '', array( 'response' => 405 ) ); }
    if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Forbidden', '', array( 'response' => 403 ) ); } check_admin_referer( 'ff90_gsc_connect' );
    $url = ff90_gsc_begin(); if ( is_wp_error( $url ) ) { ff90_gsc_admin_result( $url ); } wp_redirect( $url ); exit;
} );
add_action( 'admin_post_ff90_gsc_callback', function () {
    $state = isset( $_GET['state'] ) && is_string( $_GET['state'] ) ? wp_unslash( $_GET['state'] ) : '';
    $code = isset( $_GET['code'] ) && is_string( $_GET['code'] ) ? wp_unslash( $_GET['code'] ) : '';
    ff90_gsc_admin_result( ff90_gsc_finish( $state, $code ) );
} );
add_action( 'admin_post_ff90_gsc_property', function () {
    if ( 'POST' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) ) { wp_die( 'POST required', '', array( 'response' => 405 ) ); }
    if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Forbidden', '', array( 'response' => 403 ) ); } check_admin_referer( 'ff90_gsc_property' );
    $property = isset( $_POST['property'] ) && is_string( $_POST['property'] ) ? wp_unslash( $_POST['property'] ) : '';
    $sites = ff90_gsc_sites(); if ( is_wp_error( $sites ) ) { ff90_gsc_admin_result( $sites ); }
    if ( ! in_array( $property, $sites, true ) ) { ff90_gsc_admin_result( ff90_gsc_error( 'property_access_denied', 403 ) ); }
    update_option( 'ff90_gsc_property', $property, false ); ff90_gsc_admin_result( true );
} );
add_action( 'admin_post_ff90_gsc_disconnect', function () {
    if ( 'POST' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) ) { wp_die( 'POST required', '', array( 'response' => 405 ) ); }
    if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Forbidden', '', array( 'response' => 403 ) ); } check_admin_referer( 'ff90_gsc_disconnect' );
    $r = ff90_gsc_disconnect();
    if ( is_array( $r ) && ! $r['remote_revocation_verified'] ) { wp_die( 'Local connection removed. Google revocation could not be verified; revoke app access in your Google account.', 'Search Console' ); }
    ff90_gsc_admin_result( $r );
} );
add_action( 'rest_api_init', function () {
    register_rest_route( 'ff90-gsc/v1', '/metrics', array( 'methods' => 'POST', 'permission_callback' => function () { return current_user_can( 'manage_options' ); }, 'args' => array( 'from' => array( 'type' => 'string', 'required' => true ), 'to' => array( 'type' => 'string', 'required' => true ), 'post_id' => array( 'type' => 'integer', 'minimum' => 1 ), 'limit' => array( 'type' => 'integer', 'minimum' => 1, 'maximum' => 10000, 'default' => 1000 ) ), 'callback' => function ( $r ) {
        $page = ''; if ( $r['post_id'] ) { if ( ! get_post( $r['post_id'] ) || ! current_user_can( 'edit_post', $r['post_id'] ) ) { return ff90_gsc_error( 'forbidden', 403 ); } $page = get_permalink( $r['post_id'] ); }
        return ff90_gsc_metrics( get_option( 'ff90_gsc_property', '' ), $r['from'], $r['to'], $page, $r['limit'] );
    } ) );
} );
add_action( 'admin_menu', function () {
    add_options_page( 'FF90 Search Console', 'FF90 Search Console', 'manage_options', 'ff90-seo-gsc', function () {
        if ( ! current_user_can( 'manage_options' ) ) { return; }
        echo '<div class="wrap"><h1>FF90 Search Console</h1><p>Read-only Google Search Console. No fabricated metrics, automatic indexing submission, or external content analysis.</p>';
        $connected = ! is_wp_error( ff90_gsc_tokens() );
        echo '<p>' . esc_html( $connected ? 'OAuth token stored. Select a property and fetch data to verify actual access.' : 'Not connected.' ) . '</p>';
        echo '<p>Configure FF90_GSC_CLIENT_ID and FF90_GSC_CLIENT_SECRET in server environment or wp-config.php. Do not paste credentials into article fields.</p><p>Exact OAuth redirect URI: <code>' . esc_html( admin_url( 'admin-post.php?action=ff90_gsc_callback' ) ) . '</code></p>';
        echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="ff90_gsc_connect">'; wp_nonce_field( 'ff90_gsc_connect' ); submit_button( $connected ? 'Reconnect Google' : 'Connect Google', 'primary', 'submit', false ); echo '</form>';
        if ( $connected ) {
            $sites = ff90_gsc_sites();
            if ( is_wp_error( $sites ) ) { echo '<p>' . esc_html( $sites->get_error_message() ) . '</p>'; }
            else {
                echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="ff90_gsc_property">'; wp_nonce_field( 'ff90_gsc_property' );
                echo '<p><label>Verified accessible property <select name="property">'; foreach ( $sites as $site ) { echo '<option value="' . esc_attr( $site ) . '" ' . selected( get_option( 'ff90_gsc_property', '' ), $site, false ) . '>' . esc_html( $site ) . '</option>'; } echo '</select></label></p>'; submit_button( 'Select property' ); echo '</form>';
            }
            $from = gmdate( 'Y-m-d', time() - 30 * DAY_IN_SECONDS ); $to = gmdate( 'Y-m-d', time() - 3 * DAY_IN_SECONDS );
            if ( 'POST' === ( $_SERVER['REQUEST_METHOD'] ?? '' ) && isset( $_POST['ff90_gsc_metrics_nonce'] ) ) {
                check_admin_referer( 'ff90_gsc_metrics', 'ff90_gsc_metrics_nonce' );
                $from = isset( $_POST['from'] ) && is_string( $_POST['from'] ) ? sanitize_text_field( wp_unslash( $_POST['from'] ) ) : '';
                $to = isset( $_POST['to'] ) && is_string( $_POST['to'] ) ? sanitize_text_field( wp_unslash( $_POST['to'] ) ) : '';
                $metrics = ff90_gsc_metrics( get_option( 'ff90_gsc_property', '' ), $from, $to );
                if ( is_wp_error( $metrics ) ) { echo '<p>' . esc_html( $metrics->get_error_message() ) . '</p>'; }
                else { echo '<p>' . esc_html( 'Source: Google Search Console; fetched ' . $metrics['fetchedAt'] . ( $metrics['truncated'] ? '; result limit reached — narrow the range' : '' ) ) . '</p><table class="widefat"><caption>Search Analytics — final data may lag publication</caption><thead><tr><th scope="col">Query</th><th scope="col">Page</th><th scope="col">Clicks</th><th scope="col">Impressions</th><th scope="col">CTR</th><th scope="col">Position</th></tr></thead><tbody>'; foreach ( $metrics['metrics'] as $row ) { echo '<tr>'; foreach ( array( 'query', 'page', 'clicks', 'impressions', 'ctr', 'position' ) as $key ) { echo '<td>' . esc_html( (string) $row[ $key ] ) . '</td>'; } echo '</tr>'; } echo '</tbody></table>'; }
            }
            echo '<form method="post">'; wp_nonce_field( 'ff90_gsc_metrics', 'ff90_gsc_metrics_nonce' ); echo '<p><label>From <input type="date" name="from" value="' . esc_attr( $from ) . '"></label> <label>To <input type="date" name="to" value="' . esc_attr( $to ) . '"></label></p>'; submit_button( 'Fetch real metrics' ); echo '</form>';
            echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="ff90_gsc_disconnect">'; wp_nonce_field( 'ff90_gsc_disconnect' ); submit_button( 'Disconnect and revoke', 'secondary' ); echo '</form>';
        }
        echo '</div>';
    } );
} );

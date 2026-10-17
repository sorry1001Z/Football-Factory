<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_security_install() {
    global $wpdb; require_once ABSPATH . 'wp-admin/includes/upgrade.php'; $charset = $wpdb->get_charset_collate();
    dbDelta( "CREATE TABLE {$wpdb->prefix}ff90_security_audit (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        recorded_at datetime NOT NULL,
        event_code varchar(80) NOT NULL,
        actor_id bigint(20) unsigned NOT NULL DEFAULT 0,
        object_id bigint(20) unsigned NOT NULL DEFAULT 0,
        PRIMARY KEY  (id),
        KEY recorded_at (recorded_at)
    ) $charset;" );
    dbDelta( "CREATE TABLE {$wpdb->prefix}ff90_login_buckets (
        bucket_key varchar(64) NOT NULL,
        window_start bigint(20) unsigned NOT NULL,
        failures int unsigned NOT NULL DEFAULT 0,
        PRIMARY KEY  (bucket_key,window_start)
    ) $charset;" );
}
/** Minimal audit record. No arbitrary payloads, request bodies, IPs or secrets persisted. */
add_action( 'ff90_audit_event', function ( $code, $object_id = 0 ) {
    global $wpdb;
    $wpdb->insert( $wpdb->prefix . 'ff90_security_audit', array( 'recorded_at' => gmdate( 'Y-m-d H:i:s' ), 'event_code' => substr( sanitize_key( $code ), 0, 80 ), 'actor_id' => get_current_user_id(), 'object_id' => absint( $object_id ) ), array( '%s', '%s', '%d', '%d' ) );
}, 10, 2 );
function ff90_security_bucket( $username, $now = null ) {
    $ip = isset( $_SERVER['REMOTE_ADDR'] ) && is_string( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    return array( hash_hmac( 'sha256', $ip . '|' . strtolower( trim( $username ) ), wp_salt( 'auth' ) ), (int) floor( ( null === $now ? time() : $now ) / 900 ) * 900 );
}
function ff90_security_failures( $username, $now = null ) {
    global $wpdb; $b = ff90_security_bucket( $username, $now );
    return (int) $wpdb->get_var( $wpdb->prepare( "SELECT failures FROM {$wpdb->prefix}ff90_login_buckets WHERE bucket_key=%s AND window_start=%d", $b[0], $b[1] ) );
}
add_filter( 'authenticate', function ( $user, $username ) {
    if ( ! is_string( $username ) || '' === trim( $username ) ) { return $user; }
    if ( ff90_security_failures( $username ) >= 5 ) { return new WP_Error( 'ff90_login_throttled', 'Too many unsuccessful attempts. Try again after the current 15-minute window.' ); }
    return $user;
}, 5, 2 );
// A blocked username must not be authenticated by a later provider that ignores WP_Error.
add_filter( 'authenticate', function ( $user, $username ) {
    return is_string( $username ) && '' !== trim( $username ) && ff90_security_failures( $username ) >= 5 ? new WP_Error( 'ff90_login_throttled', 'Too many unsuccessful attempts. Try again later.' ) : $user;
}, PHP_INT_MAX, 2 );
add_action( 'wp_login_failed', function ( $username ) {
    global $wpdb; if ( ! is_string( $username ) ) { return; } $b = ff90_security_bucket( $username );
    $wpdb->query( $wpdb->prepare( "INSERT INTO {$wpdb->prefix}ff90_login_buckets (bucket_key,window_start,failures) VALUES (%s,%d,1) ON DUPLICATE KEY UPDATE failures=failures+1", $b[0], $b[1] ) );
    do_action( 'ff90_audit_event', 'security_login_failed' );
    // Retain no long-lived visitor identifiers; housekeeping is local and bounded by time.
    $wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}ff90_login_buckets WHERE window_start < %d", time() - DAY_IN_SECONDS ) );
    $wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}ff90_security_audit WHERE recorded_at < %s", gmdate( 'Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS ) ) );
} );
add_action( 'wp_login', function ( $username, $user ) {
    global $wpdb; $b = ff90_security_bucket( $username ); $wpdb->delete( $wpdb->prefix . 'ff90_login_buckets', array( 'bucket_key' => $b[0] ) ); do_action( 'ff90_audit_event', 'security_login_succeeded', $user->ID );
}, 10, 2 );
add_action( 'send_headers', function () {
    if ( headers_sent() || ! apply_filters( 'ff90_security_headers_enabled', true ) ) { return; }
    $existing = array(); foreach ( headers_list() as $header ) { $existing[] = strtolower( explode( ':', $header, 2 )[0] ); }
    foreach ( array( 'X-Content-Type-Options' => 'nosniff', 'Referrer-Policy' => 'strict-origin-when-cross-origin', 'X-Frame-Options' => 'SAMEORIGIN' ) as $name => $value ) { if ( ! in_array( strtolower( $name ), $existing, true ) ) { header( $name . ': ' . $value ); } }
} );
add_action( 'rest_api_init', function () {
    register_rest_route( 'ff90-security/v1', '/audit', array( 'methods' => 'GET', 'permission_callback' => function () { return current_user_can( 'manage_options' ); }, 'callback' => function () { global $wpdb; return $wpdb->get_results( "SELECT id,recorded_at,event_code,actor_id,object_id FROM {$wpdb->prefix}ff90_security_audit ORDER BY id DESC LIMIT 100", ARRAY_A ); } ) );
} );

<?php
/**
 * Plugin Name: FF90 News Insights
 * Description: First-party aggregate page views and source-backed daily/weekly news badges for FF90.
 * Version: 1.0.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Author: FF90 Contributors
 * License: GPL-3.0-or-later
 * Text Domain: ff90-news-insights
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

function ff90_insights_install() {
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $table = $wpdb->prefix . 'ff90_views_daily';
    $charset = $wpdb->get_charset_collate();
    dbDelta( "CREATE TABLE $table (
        post_id bigint(20) unsigned NOT NULL,
        view_day date NOT NULL,
        views bigint(20) unsigned NOT NULL DEFAULT 0,
        PRIMARY KEY  (post_id,view_day),
        KEY view_day (view_day)
    ) $charset;" );
}
register_activation_hook( __FILE__, 'ff90_insights_install' );

function ff90_insights_window( $period, $now = null ) {
    $time = ( new DateTimeImmutable( '@' . ( null === $now ? time() : (int) $now ) ) )->setTimezone( wp_timezone() );
    $today = $time->format( 'Y-m-d' );
    $start = 'week' === $period ? $time->modify( 'monday this week' )->format( 'Y-m-d' ) : $today;
    return array( $start, $today );
}
function ff90_insights_cache_key( $period, $now = null ) {
    return 'ranking_' . $period . '_' . implode( '_', ff90_insights_window( $period, $now ) );
}
function ff90_insights_public_post( $post_id ) {
    $post = get_post( $post_id );
    return $post && 'post' === $post->post_type && 'publish' === $post->post_status && '' === $post->post_password;
}
/** Aggregate one trusted event. No public write API, IP storage or external service. */
function ff90_insights_record_view( $post_id, $now = null ) {
    global $wpdb;
    $post_id = absint( $post_id );
    if ( ! ff90_insights_public_post( $post_id ) ) { return false; }
    $window = ff90_insights_window( 'today', $now );
    $table = $wpdb->prefix . 'ff90_views_daily';
    $result = $wpdb->query( $wpdb->prepare( "INSERT INTO $table (post_id, view_day, views) VALUES (%d, %s, 1) ON DUPLICATE KEY UPDATE views = views + 1", $post_id, $window[1] ) );
    if ( false === $result ) { return false; }
    foreach ( array( 'today', 'week' ) as $period ) { $limit = 'today' === $period ? 5 : max( 1, min( 20, (int) apply_filters( 'ff90_insights_weekly_limit', 5 ) ) ); wp_cache_delete( ff90_insights_cache_key( $period, $now ) . '_' . $limit, 'ff90_insights' ); }
    unset( $GLOBALS['ff90_insights_category_flags'] );
    return true;
}
function ff90_insights_rank_ids( $period, $now = null ) {
    global $wpdb;
    if ( ! in_array( $period, array( 'today', 'week' ), true ) ) { return array(); }
    $window = ff90_insights_window( $period, $now );
    $limit = 'today' === $period ? 5 : max( 1, min( 20, (int) apply_filters( 'ff90_insights_weekly_limit', 5 ) ) );
    $key = ff90_insights_cache_key( $period, $now ) . '_' . $limit;
    $ids = wp_cache_get( $key, 'ff90_insights' );
    if ( false === $ids ) {
        $table = $wpdb->prefix . 'ff90_views_daily';
        $ids = $wpdb->get_col( $wpdb->prepare( "SELECT v.post_id FROM $table v INNER JOIN {$wpdb->posts} p ON p.ID = v.post_id WHERE v.view_day >= %s AND v.view_day <= %s AND v.views > 0 AND p.post_status = 'publish' AND p.post_type = 'post' AND p.post_password = '' GROUP BY v.post_id, p.post_date_gmt, p.ID ORDER BY SUM(v.views) DESC, p.post_date_gmt DESC, p.ID DESC LIMIT %d", $window[0], $window[1], $limit ) );
        $ids = array_map( 'intval', $ids );
        wp_cache_set( $key, $ids, 'ff90_insights', 60 );
    }
    // Real analytics adapters may replace these IDs; always validate public posts.
    $ids = apply_filters( 'ff90_insights_ranking_ids', $ids, $period, $window[0], $window[1] );
    if ( ! is_array( $ids ) ) { return array(); }
    return array_slice( array_values( array_unique( array_filter( array_map( 'absint', $ids ), 'ff90_insights_public_post' ) ) ), 0, $limit );
}
function ff90_insights_is_new( $post_id, $now = null ) {
    if ( ! ff90_insights_public_post( $post_id ) ) { return false; }
    $published = get_post_timestamp( $post_id, 'date' );
    $age = ( null === $now ? time() : (int) $now ) - $published;
    return $published && $age >= 0 && $age < 3 * HOUR_IN_SECONDS;
}
add_filter( 'ff90_post_badges', function ( $badges, $post_id ) {
    if ( ! ff90_insights_public_post( $post_id ) ) { return array(); }
    if ( in_array( (int) $post_id, ff90_insights_rank_ids( 'today' ), true ) ) { $badges[] = 'hot'; }
    if ( in_array( (int) $post_id, ff90_insights_rank_ids( 'week' ), true ) ) { $badges[] = 'best'; }
    if ( ff90_insights_is_new( $post_id ) ) { $badges[] = 'new'; }
    return array_values( array_unique( $badges ) );
}, 10, 2 );
add_filter( 'ff90_category_badges', function ( $badges, $term_id ) {
    if ( ! isset( $GLOBALS['ff90_insights_category_flags'] ) ) {
        $flags = array();
        $recent = get_posts( array( 'post_type' => 'post', 'post_status' => 'publish', 'has_password' => false, 'posts_per_page' => -1, 'fields' => 'ids', 'date_query' => array( array( 'column' => 'post_date_gmt', 'after' => gmdate( 'Y-m-d H:i:s', time() - 3 * HOUR_IN_SECONDS + 1 ), 'before' => gmdate( 'Y-m-d H:i:s' ), 'inclusive' => true ) ) ) );
        foreach ( array( 'hot' => ff90_insights_rank_ids( 'today' ), 'best' => ff90_insights_rank_ids( 'week' ), 'new' => $recent ) as $badge => $ids ) {
            foreach ( $ids as $post_id ) {
                foreach ( wp_get_post_categories( $post_id ) as $id ) {
                    foreach ( array_merge( array( $id ), get_ancestors( $id, 'category', 'taxonomy' ) ) as $category ) { $flags[ $category ][ $badge ] = true; }
                }
            }
        }
        $GLOBALS['ff90_insights_category_flags'] = $flags;
    }
    return isset( $GLOBALS['ff90_insights_category_flags'][ $term_id ] ) ? array_keys( $GLOBALS['ff90_insights_category_flags'][ $term_id ] ) : $badges;
}, 10, 2 );

/** Count public human-like document requests, once per signed browser/post/site-day. */
add_action( 'template_redirect', function () {
    if ( is_admin() || ! is_singular( 'post' ) || is_preview() || is_feed() || is_user_logged_in() || 'GET' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) || '1' === ( $_SERVER['HTTP_DNT'] ?? '' ) ) { return; }
    if ( ! apply_filters( 'ff90_insights_tracking_allowed', true ) || ! ff90_insights_public_post( get_queried_object_id() ) ) { return; }
    $agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '';
    if ( ! $agent || preg_match( '/bot|spider|crawl|slurp|curl|wget|headless/i', $agent ) ) { return; }
    $raw = isset( $_COOKIE['ff90_reader'] ) && is_string( $_COOKIE['ff90_reader'] ) ? wp_unslash( $_COOKIE['ff90_reader'] ) : '';
    $parts = explode( '.', $raw );
    $valid = 2 === count( $parts ) && preg_match( '/^[a-f0-9-]{36}$/', $parts[0] ) && hash_equals( hash_hmac( 'sha256', $parts[0], wp_salt( 'auth' ) ), $parts[1] );
    if ( ! $valid ) {
        if ( headers_sent() ) { return; }
        $token = wp_generate_uuid4();
        $raw = $token . '.' . hash_hmac( 'sha256', $token, wp_salt( 'auth' ) );
        setcookie( 'ff90_reader', $raw, array( 'expires' => time() + 31 * DAY_IN_SECONDS, 'path' => COOKIEPATH ? COOKIEPATH : '/', 'secure' => is_ssl(), 'httponly' => true, 'samesite' => 'Lax' ) );
    }
    $post_id = get_queried_object_id();
    $window = ff90_insights_window( 'today' );
    $key = 'ff90_seen_' . hash_hmac( 'sha256', $raw . '|' . $post_id . '|' . $window[1], wp_salt( 'auth' ) );
    if ( get_transient( $key ) ) { return; }
    if ( ff90_insights_record_view( $post_id ) ) { set_transient( $key, 1, 2 * DAY_IN_SECONDS ); }
}, 20 );

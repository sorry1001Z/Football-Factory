<?php
/** Isolated synthetic fixtures only; never execute against a production database. */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI || ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX ) { return; }
global $wpdb;
$checks = 0; $ids = array(); $timezone = get_option( 'timezone_string' );
$assert = function ( $ok, $message ) use ( &$checks ) { if ( ! $ok ) { throw new RuntimeException( $message ); } ++$checks; echo "PASS: $message\n"; };
$seven = function () { return 7; };
try {
    update_option( 'timezone_string', 'Asia/Bangkok' );
    $sunday = strtotime( '2026-10-18T12:00:00Z' );
    $monday = strtotime( '2026-10-12T12:00:00Z' );
    $assert( ff90_insights_window( 'week', $sunday ) === array( '2026-10-12', '2026-10-18' ), 'week is Monday through Sunday in site timezone' );
    $assert( ff90_insights_window( 'today', strtotime( '2026-10-18T23:30:00Z' ) ) === array( '2026-10-19', '2026-10-19' ), 'UTC midnight boundary converted to Asia/Bangkok' );
    $assert( ff90_insights_rank_ids( 'invalid' ) === array(), 'invalid ranking period rejected' );
    for ( $i = 0; $i < 7; ++$i ) {
        $timestamp = time() - 30 * DAY_IN_SECONDS + $i * 60;
        $id = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'FF90 QA rank fixture ' . $i, 'post_date' => wp_date( 'Y-m-d H:i:s', $timestamp ), 'post_date_gmt' => gmdate( 'Y-m-d H:i:s', $timestamp ) ) );
        $ids[] = $id;
    }
    $assert( ! array_intersect( $ids, ff90_insights_rank_ids( 'today', $sunday ) ), 'no HOT ranking without recorded views' );
    foreach ( $ids as $i => $id ) {
        for ( $n = 0; $n <= $i; ++$n ) { $assert( ff90_insights_record_view( $id, $sunday ), 'record synthetic test event' ); }
    }
    $assert( ff90_insights_rank_ids( 'today', $sunday ) === array_reverse( array_slice( $ids, 2 ) ), 'daily HOT returns exactly top five nonzero view totals' );
    for ( $i = 0; $i < 20; ++$i ) { ff90_insights_record_view( $ids[0], $monday ); }
    $assert( ff90_insights_rank_ids( 'week', $sunday ) === array( $ids[0], $ids[6], $ids[5], $ids[4], $ids[3] ), 'weekly BEST includes earlier weekdays but daily HOT does not' );
    $assert( ff90_insights_rank_ids( 'today', $sunday )[0] === $ids[6], 'earlier week events excluded from current day' );
    ff90_insights_record_view( $ids[1], $sunday );
    add_filter( 'ff90_insights_weekly_limit', $seven );
    $week = ff90_insights_rank_ids( 'week', $sunday );
    $assert( count( $week ) === 7, 'weekly limit adapter supported' );
    $assert( array_search( $ids[2], $week, true ) < array_search( $ids[1], $week, true ), 'ties resolved by newer publication date' );
    remove_filter( 'ff90_insights_weekly_limit', $seven );
    for ( $i = 0; $i < 15; ++$i ) { ff90_insights_record_view( $ids[1], $sunday ); }
    $assert( ff90_insights_rank_ids( 'today', $sunday )[0] === $ids[1], 'cached ranking invalidated when a view changes the leader' );
    $private = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'private', 'post_title' => 'FF90 QA private' ) ); $ids[] = $private;
    $protected = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'FF90 QA protected', 'post_password' => 'test-only' ) ); $ids[] = $protected;
    $assert( ! ff90_insights_record_view( $private, $sunday ), 'private posts cannot accrue views' );
    $assert( ! ff90_insights_record_view( $protected, $sunday ), 'password-protected posts cannot accrue views' );
    $assert( ! ff90_insights_record_view( 0, $sunday ), 'invalid post cannot accrue views' );
    $now = time();
    $new = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'FF90 QA NEW boundary', 'post_date' => wp_date( 'Y-m-d H:i:s', $now - 10799 ), 'post_date_gmt' => gmdate( 'Y-m-d H:i:s', $now - 10799 ) ) ); $ids[] = $new;
    $assert( ff90_insights_is_new( $new, $now ), 'NEW at two hours 59 minutes 59 seconds' );
    $assert( ! ff90_insights_is_new( $new, $now + 1 ), 'NEW expires exactly at three hours' );
    $assert( ! ff90_insights_is_new( $new, $now - 10800 ), 'negative publication age cannot be NEW' );
    $assert( ! ff90_insights_is_new( $private, $now ), 'private posts cannot be NEW' );
    $adapter = function () use ( $private ) { return array( $private, 0 ); };
    add_filter( 'ff90_insights_ranking_ids', $adapter );
    $assert( ff90_insights_rank_ids( 'today', $sunday ) === array(), 'external ranking adapter cannot expose private/invalid posts' );
    remove_filter( 'ff90_insights_ranking_ids', $adapter );
    $assert( ff90_sanitize_social_url( 'javascript:alert(1)', (object) array( 'id' => 'ff90_social_facebook' ) ) === '', 'social JavaScript URL rejected' );
    $assert( ff90_sanitize_social_url( 'https://facebook.com.evil.test/a', (object) array( 'id' => 'ff90_social_facebook' ) ) === '', 'lookalike social host rejected' );
    $assert( ff90_sanitize_social_url( array(), (object) array( 'id' => 'ff90_social_facebook' ) ) === '', 'array social value rejected' );
    $assert( ff90_sanitize_social_url( 'https://user:pass@www.facebook.com/a', (object) array( 'id' => 'ff90_social_facebook' ) ) === '', 'credential-bearing URL rejected' );
    $assert( ff90_sanitize_social_url( 'https://www.youtube.com/', (object) array( 'id' => 'ff90_social_youtube' ) ) === 'https://www.youtube.com/', 'genuine HTTPS social host accepted' );
    echo "TOTAL: $checks checks passed; all statistics above are synthetic QA fixtures, not audience claims.\n";
} finally {
    remove_filter( 'ff90_insights_weekly_limit', $seven );
    foreach ( $ids as $id ) { $wpdb->delete( $wpdb->prefix . 'ff90_views_daily', array( 'post_id' => $id ), array( '%d' ) ); wp_delete_post( $id, true ); }
    wp_cache_flush();
    update_option( 'timezone_string', $timezone );
}

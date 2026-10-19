<?php
/** No external traffic and no real key access. Disposable sandbox only. */
if ( ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX || ff90_football_token() || ff90_af_token() ) { throw new RuntimeException( 'Requires sandbox without real credentials.' ); }
global $wpdb;
$options = get_option( 'ff90_football_options', null );
$quota = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}ff90_football_quota WHERE quota_day=%s AND provider IN ('football-data.org','api-football')", gmdate( 'Y-m-d' ) ), ARRAY_A );
$saved = $wpdb->get_results( "SELECT option_name,option_value,autoload FROM {$wpdb->options} WHERE option_name LIKE '%ff90_fd_%' OR option_name LIKE '%ff90_af_%'", ARRAY_A );
$clear = function () use ( $wpdb ) { foreach ( $wpdb->get_col( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE '%ff90_fd_%' OR option_name LIKE '%ff90_af_%'" ) as $name ) { delete_option( $name ); } };
$clear(); foreach ( array( 'football-data.org', 'api-football' ) as $p ) { $wpdb->delete( $wpdb->prefix . 'ff90_football_quota', array( 'provider' => $p, 'quota_day' => gmdate( 'Y-m-d' ) ) ); }
putenv( 'FF90_FOOTBALL_DATA_TOKEN=synthetic-fd-split' ); putenv( 'API_FOOTBALL_KEY=synthetic-af-split' );
$counts = array( 'fd' => 0, 'af' => 0 ); $mode = 'normal'; $checks = 0; $date = wp_date( 'Y-m-d' );
$assert = function ( $yes, $name ) use ( &$checks ) { if ( ! $yes ) { throw new RuntimeException( 'FAIL: ' . $name ); } ++$checks; echo "PASS: $name\n"; };
$http = function ( $pre, $args, $url ) use ( &$counts, &$mode, $date, $assert ) {
    $host = wp_parse_url( $url, PHP_URL_HOST ); $status = 200;
    if ( 'api.football-data.org' === $host ) {
        ++$counts['fd']; $assert( 'synthetic-fd-split' === $args['headers']['X-Auth-Token'] && ! isset( $args['headers']['x-apisports-key'] ), 'FD request uses only its own private key' );
        if ( 'network' === $mode ) { return new WP_Error( 'synthetic_network', 'Synthetic failure' ); }
        if ( 'denied' === $mode ) { $status = 403; }
        preg_match( '~/competitions/([A-Z0-9]+)/standings~', $url, $m );
        $row = array( 'team' => array( 'name' => 'Synthetic Team' ), 'position' => 1, 'playedGames' => 3, 'won' => 2, 'draw' => 1, 'lost' => 0, 'goalsFor' => 5, 'goalsAgainst' => 1, 'goalDifference' => 4, 'points' => 7 );
        $body = array( 'competition' => array( 'code' => 'wrong' === $mode ? 'WRONG' : ( $m[1] ?? '' ) ), 'season' => array( 'startDate' => '2026-08-01', 'endDate' => '2027-06-01' ), 'standings' => array( array( 'type' => 'TOTAL', 'stage' => 'REGULAR_SEASON', 'table' => array( $row ) ) ) );
        if ( 'metadata' === $mode ) { unset( $body['season'] ); }
    } elseif ( 'v3.football.api-sports.io' === $host ) {
        ++$counts['af']; $assert( 'synthetic-af-split' === $args['headers']['x-apisports-key'] && ! isset( $args['headers']['X-Auth-Token'] ), 'API-Football request uses only its own private key' );
        $body = array( 'errors' => array(), 'paging' => array( 'current' => 1, 'total' => 1 ), 'response' => array( array( 'fixture' => array( 'id' => 1, 'date' => $date . 'T12:00:00+07:00', 'status' => array( 'short' => 'FT' ) ), 'league' => array( 'id' => 39 ), 'teams' => array( 'home' => array( 'name' => 'Synthetic A' ), 'away' => array( 'name' => 'Synthetic B' ) ), 'goals' => array( 'home' => 1, 'away' => 0 ) ) ) );
        if ( '/status' === wp_parse_url( $url, PHP_URL_PATH ) ) { $body['response'] = array( 'subscription' => array( 'active' => false, 'plan' => 'Free' ), 'requests' => array( 'current' => 0, 'limit_day' => 100 ) ); }
    } else { return new WP_Error( 'test_external_blocked', 'External access prohibited.' ); }
    $assert( true === $args['sslverify'] && 0 === $args['redirection'], 'both providers retain TLS verification and prohibit redirects' );
    return array( 'headers' => array(), 'response' => array( 'code' => $status ), 'body' => wp_json_encode( $body ) );
};
add_filter( 'pre_http_request', $http, 1, 3 );
try {
    update_option( 'ff90_football_options', array( 'provider' => 'api-football', 'standings_provider' => 'football-data.org', 'enabled' => true, 'season' => 2026, 'competition' => 'PL', 'auto_refresh' => false ) );
    $a = ff90_football_get( 'matches', 'PL' ); $d = ff90_football_get( 'standings', 'PL' );
    $assert( ! is_wp_error( $a ) && ! is_wp_error( $d ) && 'API-Football' === $a['provider'] && 'football-data.org' === $d['provider'] && 1 === $counts['af'] && 1 === $counts['fd'], 'native getter routes fixtures and standings to independent providers' );
    $assert( '2026/2027' === $d['season_label'] && 7 === $d['data'][0]['rows'][0]['points'], 'standings retain source season and points without recomputing' );
    $html = ff90_football_render( 'standings', array( 'competition' => 'PL' ) );
    $assert( false !== strpos( $html, '2026/2027' ) && false !== strpos( $html, 'football-data.org' ), 'widget exposes actual source and season label' );
    $before = $counts; for ( $i = 0; $i < 10; ++$i ) { ff90_football_get( 'standings', 'PL' ); ff90_football_get( 'matches', 'PL' ); }
    $assert( $before === $counts, 'repeated requests share provider-specific caches without spending more quota' );
    $assert( is_wp_error( ff90_football_get( 'standings', 'CL' ) ) && $before === $counts, 'split standings only allows the five intended leagues' );
    $key = ff90_football_cache_key( 'standings', 'PL', $date ); delete_transient( $key ); $mode = 'network';
    $d = ff90_football_get( 'standings', 'PL' );
    $assert( ! is_wp_error( $d ) && $d['stale'] && 'football-data.org' === $d['provider'], 'failed refresh retains last-good standings labelled stale with original source' );
    $before = $counts; ff90_football_get( 'standings', 'PL' ); $assert( $before === $counts, 'negative cache bounds retries under visitor traffic' );
    $clear(); $mode = 'wrong'; $d = ff90_football_get( 'standings', 'PL' );
    $assert( is_wp_error( $d ) && 'football_payload' === $d->get_error_code(), 'wrong competition cannot become the displayed standings' );
    $clear(); $mode = 'metadata'; $d = ff90_football_get( 'standings', 'PL' );
    $assert( is_wp_error( $d ) && 'football_payload' === $d->get_error_code(), 'missing season metadata cannot masquerade as current standings' );
    $clear(); $mode = 'denied'; $before = $counts['af']; $d = ff90_football_get( 'standings', 'PL' );
    $assert( is_wp_error( $d ) && 'football_authorization' === $d->get_error_code() && $before === $counts['af'], 'denied FD access does not silently substitute historical API-Football data' );
    $clear(); $mode = 'normal'; $o = ff90_football_options(); $o['auto_refresh'] = true; update_option( 'ff90_football_options', $o );
    $before = $counts; do_action( 'ff90_af_refresh' );
    $assert( 5 === $counts['fd'] - $before['fd'] && 1 === $counts['af'] - $before['af'], 'FD standings refresh independently even when API-Football status is inactive' );
    echo "TOTAL: $checks split-provider assertions passed; HTTP DOUBLES only.\n";
} finally {
    remove_filter( 'pre_http_request', $http, 1 ); putenv( 'FF90_FOOTBALL_DATA_TOKEN' ); putenv( 'API_FOOTBALL_KEY' ); $clear();
    foreach ( $saved as $r ) { $wpdb->insert( $wpdb->options, $r ); } wp_cache_flush();
    if ( null === $options ) { delete_option( 'ff90_football_options' ); } else { update_option( 'ff90_football_options', $options ); }
    foreach ( array( 'football-data.org', 'api-football' ) as $p ) { $wpdb->delete( $wpdb->prefix . 'ff90_football_quota', array( 'provider' => $p, 'quota_day' => gmdate( 'Y-m-d' ) ) ); }
    foreach ( $quota as $r ) { $wpdb->insert( $wpdb->prefix . 'ff90_football_quota', $r ); }
}

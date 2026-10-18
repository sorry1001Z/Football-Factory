<?php
/** Disposable WordPress only; never reads the supplied real key. */
if ( ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX || ff90_af_token() ) { throw new RuntimeException( 'Requires sandbox without a real API-Football key.' ); }
global $wpdb;
$old_options = get_option( 'ff90_football_options', null );
$old_quota = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}ff90_football_quota WHERE provider='api-football' AND quota_day=%s", gmdate( 'Y-m-d' ) ), ARRAY_A );
$snapshot = $wpdb->get_results( "SELECT option_name,option_value,autoload FROM {$wpdb->options} WHERE option_name LIKE '%ff90_af_%'", ARRAY_A );
$cleanup = function () use ( $wpdb ) { $names = $wpdb->get_col( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE '%ff90_af_%'" ); foreach ( $names as $name ) { delete_option( $name ); } };
$cleanup(); $wpdb->delete( $wpdb->prefix . 'ff90_football_quota', array( 'provider' => 'api-football', 'quota_day' => gmdate( 'Y-m-d' ) ) );
putenv( 'API_FOOTBALL_KEY=synthetic-test-only' );
$calls = 0; $mode = 'normal'; $passed = 0;
$assert = function ( $ok, $name ) use ( &$passed ) { if ( ! $ok ) { throw new RuntimeException( 'FAIL: ' . $name ); } ++$passed; echo "PASS: $name\n"; };
$today = wp_date( 'Y-m-d' );
$fixture = array( 'fixture' => array( 'id' => 1, 'date' => $today . 'T12:00:00+07:00', 'status' => array( 'short' => 'FT' ) ), 'league' => array( 'id' => 39 ), 'teams' => array( 'home' => array( 'name' => 'Synthetic A' ), 'away' => array( 'name' => 'Synthetic B' ) ), 'goals' => array( 'home' => 2, 'away' => null ) );
$row = array( 'rank' => 1, 'team' => array( 'name' => 'Synthetic A' ), 'points' => 12, 'goalsDiff' => 5, 'group' => 'Synthetic table', 'all' => array( 'played' => 5, 'win' => 4, 'draw' => 0, 'lose' => 1, 'goals' => array( 'for' => 10, 'against' => 5 ) ) );
$http = function ( $pre, $args, $url ) use ( &$calls, &$mode, $fixture, $row, $assert ) {
    if ( 'v3.football.api-sports.io' !== wp_parse_url( $url, PHP_URL_HOST ) ) { return new WP_Error( 'test_blocked', 'No external network in this suite.' ); }
    ++$calls;
    $assert( true === $args['sslverify'] && 0 === $args['redirection'] && 'synthetic-test-only' === $args['headers']['x-apisports-key'], 'fixed HTTPS provider and private server header' );
    if ( 'network' === $mode ) { return new WP_Error( 'synthetic', 'Synthetic network failure' ); }
    if ( 'rate' === $mode ) { return array( 'response' => array( 'code' => 429 ), 'headers' => array(), 'body' => '{}' ); }
    $endpoint = basename( wp_parse_url( $url, PHP_URL_PATH ) );
    $body = array( 'errors' => array(), 'paging' => array( 'current' => 1, 'total' => 1 ), 'response' => array( $fixture ) );
    if ( 'entitlement' === $mode ) { $body['errors'] = array( 'plan' => 'Synthetic season restriction' ); $body['response'] = array(); }
    if ( 'pagination' === $mode ) { $body['paging']['total'] = 2; }
    if ( 'standings' === $endpoint ) { $body['response'] = array( array( 'league' => array( 'id' => 39, 'season' => 2024, 'standings' => array( array( $row ) ) ) ) ); }
    if ( 'status' === $endpoint ) { $body['response'] = array( 'account' => array( 'email' => 'not-for-storage.invalid' ), 'subscription' => array( 'plan' => 'paid' === $mode ? 'Pro' : 'Free', 'active' => true ), 'requests' => array( 'current' => 1, 'limit_day' => 100 ) ); }
    return array( 'response' => array( 'code' => 200 ), 'headers' => array(), 'body' => wp_json_encode( $body ) );
};
add_filter( 'pre_http_request', $http, 1, 3 );
try {
    update_option( 'ff90_football_options', array( 'provider' => 'api-football', 'enabled' => false, 'competition' => 'PL', 'season' => 2024 ) );
    $assert( is_wp_error( ff90_football_get( 'matches' ) ) && 0 === $calls, 'disabled API-Football does not call provider' );
    update_option( 'ff90_football_options', array( 'provider' => 'api-football', 'enabled' => true, 'competition' => 'PL', 'season' => 2024 ) );
    $data = ff90_football_get( 'matches', 'PL', $today );
    $assert( ! is_wp_error( $data ) && 1 === count( $data['data'] ) && 'finished' === $data['data'][0]['status'] && null === $data['data'][0]['score']['away'], 'native provider selection, FT and unknown score normalize correctly' );
    $before = $calls; ff90_football_get( 'matches', 'PD', $today ); ff90_football_get( 'matches', 'BL1', $today );
    $assert( $calls === $before, 'multiple leagues/pages share one upstream daily-fixtures snapshot' );
    $assert( is_wp_error( ff90_football_get( 'matches', '../bad', $today ) ) && is_wp_error( ff90_football_get( 'matches', 'PL', '2001-01-01' ) ) && $calls === $before, 'invalid competition and arbitrary historical dates make no request' );
    $standings = ff90_football_get( 'standings', 'PL', $today );
    $assert( ! is_wp_error( $standings ) && 5 === $standings['data'][0]['rows'][0]['playedGames'] && 2024 === $standings['season'], 'real API-Sports nested all/goals standings shape and selected season' );
    $assert( false !== strpos( ff90_football_render( 'standings', array( 'competition' => 'PL' ) ), '2024' ), 'widget visibly labels selected season rather than claiming current table' );
    $status = ff90_af_request( 'status' );
    $assert( ! is_wp_error( $status ) && 'Free' === $status['data']['subscription']['plan'] && ! isset( $status['data']['account'] ), 'status keeps plan/quota only and strips account data' );
    $before = $calls; $assert( is_wp_error( ff90_af_request( 'https://evil.invalid' ) ) && is_wp_error( ff90_af_request( 'fixtures', array( 'secret' => 'bad' ) ) ) && $calls === $before, 'request helper rejects arbitrary endpoints and parameters' );
    $normal = ff90_af_normalize( 'matches', array( $fixture ), 39, $today, 2024 );
    $invalid = $fixture; $invalid['fixture']['date'] = '2026-02-31T12:00:00+07:00';
    $assert( 1 === count( $normal ) && array() === ff90_af_normalize( 'matches', array( $invalid ), 39, $today, 2024 ), 'invalid calendar date cannot become a fabricated fixture' );
    $key = 'ff90_af_v2_' . hash( 'sha256', hash( 'sha256', ff90_af_token() ) . 'fixtures' . wp_json_encode( array( 'date' => $today, 'timezone' => wp_timezone_string() ) ) . 'today' );
    delete_transient( $key ); $mode = 'network';
    $stale = ff90_football_get( 'matches', 'PL', $today );
    $assert( ! is_wp_error( $stale ) && $stale['stale'] && 'football_network' === $stale['error_code'], 'network error retains labelled last-good snapshot' );
    $before = $calls; ff90_football_get( 'matches', 'PL', $today );
    $assert( $before === $calls, 'negative cache prevents page traffic from draining error retries' );
    $cleanup(); $mode = 'entitlement'; $error = ff90_football_get( 'matches', 'PL', $today );
    $assert( is_wp_error( $error ) && 'football_entitlement' === $error->get_error_code(), 'HTTP 200 plan restriction is a failure, never successful empty fixtures' );
    $cleanup(); $mode = 'pagination'; $error = ff90_football_get( 'matches', 'PL', $today );
    $assert( is_wp_error( $error ) && 'football_payload' === $error->get_error_code(), 'incomplete paginated global snapshot is not silently accepted' );
    $cleanup(); $mode = 'rate'; ff90_football_get( 'matches', 'PL', $today ); $before = $calls; ff90_football_get( 'matches', 'PD', $today );
    $assert( $before === $calls && 'football_rate_limited' === get_transient( 'ff90_af_backoff' ), '429 activates shared bounded backoff' );
    $cleanup(); $mode = 'paid';
    $o = ff90_football_options(); $o['auto_refresh'] = true; update_option( 'ff90_football_options', $o );
    $before = $calls; do_action( 'ff90_af_refresh' );
    $assert( $calls === $before + 1, 'scheduled refresh stops after status when plan is not Free' );
    $o['auto_refresh'] = false; update_option( 'ff90_football_options', $o );
    $before = $calls; do_action( 'ff90_af_refresh' );
    $assert( $before === $calls, 'disabled scheduler never performs provider requests' );
    $badrow = $row; unset( $badrow['all']['goals'] );
    $assert( is_wp_error( ff90_af_normalize( 'standings', array( array( 'league' => array( 'id' => 39, 'season' => 2024, 'standings' => array( array( $badrow ) ) ) ) ), 39, $today, 2024 ) ), 'malformed standing metrics are rejected rather than converted to zeros' );
    $cleanup(); $mode = 'normal';
    $wpdb->update( $wpdb->prefix . 'ff90_football_quota', array( 'requests' => 80 ), array( 'provider' => 'api-football', 'quota_day' => gmdate( 'Y-m-d' ) ) );
    $before = $calls; $error = ff90_football_get( 'matches', 'PL', $today );
    $assert( is_wp_error( $error ) && 'football_quota_exceeded' === $error->get_error_code() && $before === $calls && 80 === ff90_af_usage(), 'atomic hard 80/day cap prevents the 81st network attempt' );
    echo "TOTAL: $passed assertions passed; HTTP DOUBLES only, no live key read.\n";
} finally {
    remove_filter( 'pre_http_request', $http, 1 ); putenv( 'API_FOOTBALL_KEY' ); $cleanup();
    foreach ( $snapshot as $saved ) { $wpdb->insert( $wpdb->options, $saved ); } wp_cache_flush();
    if ( null === $old_options ) { delete_option( 'ff90_football_options' ); } else { update_option( 'ff90_football_options', $old_options ); }
    $wpdb->delete( $wpdb->prefix . 'ff90_football_quota', array( 'provider' => 'api-football', 'quota_day' => gmdate( 'Y-m-d' ) ) ); if ( $old_quota ) { $wpdb->insert( $wpdb->prefix . 'ff90_football_quota', $old_quota ); }
}

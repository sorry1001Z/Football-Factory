<?php
if ( ! defined( 'WP_CLI' ) || ! WP_CLI || ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX ) { throw new RuntimeException( 'Disposable sandbox required.' ); }
if ( ff90_gsc_config( 'client_id' ) || ff90_gsc_config( 'client_secret' ) || get_option( 'ff90_gsc_tokens' ) ) { throw new RuntimeException( 'Refusing to overwrite an existing connection/configuration.' ); }
define( 'FF90_GSC_CLIENT_ID', 'synthetic-qa-client.apps.googleusercontent.com' ); define( 'FF90_GSC_CLIENT_SECRET', 'synthetic-qa-secret-not-a-real-credential' );
$checks = 0; $requests = 0; $mode = 'normal'; $saved = array(); $original_user = get_current_user_id();
foreach ( array( 'ff90_gsc_tokens', 'ff90_gsc_property', 'ff90_gsc_refresh_lock' ) as $key ) { $saved[ $key ] = get_option( $key, null ); }
$cookie_before = $_COOKIE[ LOGGED_IN_COOKIE ] ?? null;
$assert = function ( $ok, $message ) use ( &$checks ) { if ( ! $ok ) { throw new RuntimeException( $message ); } ++$checks; echo 'PASS: ' . $message . "\n"; };
$mock = function ( $pre, $args, $url ) use ( &$requests, &$mode ) {
    if ( ! preg_match( '~^https://(?:oauth2|www)\.googleapis\.com/~', $url ) ) { return $pre; }
    ++$requests; $status = 200; $data = array();
    if ( 'network' === $mode ) { return new WP_Error( 'synthetic_network', 'Synthetic failure with sensitive-provider-detail' ); }
    if ( 'denied' === $mode ) { $status = 403; $data = array( 'error' => 'sensitive-provider-detail' ); }
    elseif ( 'https://oauth2.googleapis.com/token' === $url ) {
        if ( 'refresh_token' === ( $args['body']['grant_type'] ?? '' ) ) {
            if ( 'disconnect_race' === $mode ) { delete_option( 'ff90_gsc_tokens' ); }
            $data = array( 'access_token' => 'synthetic-refreshed-access', 'expires_in' => 3600 );
        } else { $data = array( 'access_token' => 'synthetic-access', 'refresh_token' => 'synthetic-refresh', 'expires_in' => 3600, 'scope' => 'wrong_scope' === $mode ? 'https://www.googleapis.com/auth/webmasters' : 'https://www.googleapis.com/auth/webmasters.readonly' ); }
    } elseif ( 'https://www.googleapis.com/webmasters/v3/sites' === $url ) {
        $data = array( 'siteEntry' => array( array( 'siteUrl' => 'sc-domain:example.org', 'permissionLevel' => 'siteOwner' ), array( 'siteUrl' => 'sc-domain:unverified.example', 'permissionLevel' => 'siteUnverifiedUser' ) ) );
    } elseif ( false !== strpos( $url, '/searchAnalytics/query' ) ) {
        $body = json_decode( $args['body'], true );
        if ( $body['dimensions'] !== array( 'query', 'page' ) || ( $body['dataState'] ?? '' ) !== 'final' ) { throw new RuntimeException( 'Invalid Search Analytics request shape.' ); }
        $data = array( 'rows' => array( array( 'keys' => array( 'synthetic query', 'https://example.org/news/' ), 'clicks' => 12, 'impressions' => 100, 'ctr' => 0.12, 'position' => 4.5 ) ) );
    }
    return array( 'headers' => array(), 'body' => wp_json_encode( $data ), 'response' => array( 'code' => $status, 'message' => 'Synthetic HTTP contract fixture' ), 'cookies' => array() );
};
add_filter( 'pre_http_request', $mock, 10, 3 );
try {
    wp_set_current_user( 0 ); $assert( is_wp_error( ff90_gsc_begin() ), 'anonymous OAuth denied' );
    $request = new WP_REST_Request( 'POST', '/ff90-gsc/v1/metrics' ); $request->set_param( 'from', '2026-01-01' ); $request->set_param( 'to', '2026-01-02' ); $r = rest_do_request( $request ); $assert( 401 === $r->get_status(), 'anonymous metrics denied' );
    wp_set_current_user( get_users( array( 'role' => 'administrator', 'number' => 1 ) )[0]->ID );
    $assert( is_wp_error( ff90_gsc_tokens() ), 'not connected returns error, no fake metrics' );
    $assert( is_wp_error( ff90_gsc_http( 'https://attacker.example/token', array() ) ) && 0 === $requests, 'HTTP transport rejects arbitrary hosts' );
    $seal1 = ff90_gsc_seal( array( 'refresh_token' => 'synthetic-secret' ) ); $seal2 = ff90_gsc_seal( array( 'refresh_token' => 'synthetic-secret' ) );
    $assert( $seal1 !== $seal2 && false === strpos( $seal1, 'synthetic-secret' ), 'tokens encrypted with random authenticated nonce' );
    update_option( 'ff90_gsc_tokens', base64_encode( 'bad' ) ); $assert( is_wp_error( ff90_gsc_tokens() ), 'truncated ciphertext rejected without exception' ); delete_option( 'ff90_gsc_tokens' );
    $url = ff90_gsc_begin(); parse_str( parse_url( $url, PHP_URL_QUERY ), $q );
    $assert( 'https://www.googleapis.com/auth/webmasters.readonly' === $q['scope'] && 'S256' === $q['code_challenge_method'], 'OAuth requests readonly scope with PKCE' );
    $assert( ! isset( $q['client_secret'], $q['code_verifier'] ), 'authorization URL excludes client secret and verifier' );
    $state_record = get_transient( 'ff90_gsc_state_' . hash( 'sha256', $q['state'] ) );
    $assert( $q['code_challenge'] === rtrim( strtr( base64_encode( hash( 'sha256', $state_record['verifier'], true ) ), '+/', '-_' ), '=' ), 'PKCE challenge binds stored verifier' );
    $_COOKIE[ LOGGED_IN_COOKIE ] = 'qa|' . ( time() + 300 ) . '|different-session|synthetic';
    $assert( is_wp_error( ff90_gsc_finish( $q['state'], 'synthetic-code' ) ) && 0 === $requests, 'callback rejects a different login session' );
    if ( null === $cookie_before ) { unset( $_COOKIE[ LOGGED_IN_COOKIE ] ); } else { $_COOKIE[ LOGGED_IN_COOKIE ] = $cookie_before; }
    $url = ff90_gsc_begin(); parse_str( parse_url( $url, PHP_URL_QUERY ), $q );
    $assert( true === ff90_gsc_finish( $q['state'], 'synthetic-code' ), 'valid OAuth contract stores encrypted grant' );
    $assert( 'synthetic-refresh' === ff90_gsc_tokens()['refresh_token'], 'encrypted grant round trips' );
    $before = $requests; $assert( is_wp_error( ff90_gsc_finish( $q['state'], 'synthetic-code' ) ) && $requests === $before, 'OAuth state cannot replay' );
    $assert( 'synthetic-access' === ff90_gsc_access_token() && $requests === $before, 'unexpired access token reused without provider call' );
    $assert( array( 'sc-domain:example.org' ) === ff90_gsc_sites(), 'unverified properties excluded from selection' );
    update_option( 'ff90_gsc_property', 'sc-domain:example.org' );
    $from = gmdate( 'Y-m-d', time() - 10 * DAY_IN_SECONDS ); $to = gmdate( 'Y-m-d', time() - 3 * DAY_IN_SECONDS );
    $metrics = ff90_gsc_metrics( 'sc-domain:example.org', $from, $to, '', 1 );
    $assert( 12.0 === $metrics['metrics'][0]['clicks'] && 100.0 === $metrics['metrics'][0]['impressions'] && 4.5 === $metrics['metrics'][0]['position'], 'Search Analytics response maps without invented metrics' );
    $assert( $metrics['truncated'] && 'google_search_console' === $metrics['source'] && isset( $metrics['fetchedAt'] ), 'bounded metrics identify source, timestamp and truncation' );
    $before = $requests;
    foreach ( array( array( '2026-02-30', $to, 1 ), array( $to, $from, 1 ), array( $from, $to, 10001 ) ) as $invalid ) { $assert( is_wp_error( ff90_gsc_metrics( 'sc-domain:example.org', $invalid[0], $invalid[1], '', $invalid[2] ) ) && $requests === $before, 'invalid date/range/limit rejected before network' ); }
    $assert( is_wp_error( ff90_gsc_metrics( 'sc-domain:attacker.example', $from, $to ) ) && $before === $requests, 'caller cannot override selected property' );
    $mode = 'denied'; $error = ff90_gsc_sites(); $assert( is_wp_error( $error ) && false === strpos( $error->get_error_message(), 'sensitive-provider-detail' ), 'provider authorization errors redact response payload' );
    $mode = 'network'; $assert( is_wp_error( ff90_gsc_sites() ), 'network errors remain errors rather than fake empty success' ); $mode = 'normal';
    $tokens = ff90_gsc_tokens(); $tokens['expires_at'] = time() - 1; ff90_gsc_store( $tokens );
    $assert( 'synthetic-refreshed-access' === ff90_gsc_access_token(), 'expired token refreshes through fixed token endpoint' );
    $assert( 'synthetic-refresh' === ff90_gsc_tokens()['refresh_token'], 'refresh token retained when provider omits rotation' );
    $tokens = ff90_gsc_tokens(); $tokens['expires_at'] = time() - 1; ff90_gsc_store( $tokens ); update_option( 'ff90_gsc_refresh_lock', array( 'id' => 'other-request', 'until' => time() + 30 ) );
    $before = $requests; $assert( is_wp_error( ff90_gsc_access_token() ) && $requests === $before, 'refresh lock prevents concurrent refresh storm' ); delete_option( 'ff90_gsc_refresh_lock' );
    $mode = 'disconnect_race'; $assert( is_wp_error( ff90_gsc_access_token() ) && ! get_option( 'ff90_gsc_tokens' ), 'concurrent disconnect cannot resurrect tokens during refresh' ); $mode = 'normal';
    ff90_gsc_store( array( 'access_token' => 'synthetic-access', 'refresh_token' => 'synthetic-refresh', 'expires_at' => time() + 3600 ) );
    $result = ff90_gsc_disconnect(); $assert( $result['disconnected'] && $result['remote_revocation_verified'] && ! get_option( 'ff90_gsc_tokens' ) && ! get_option( 'ff90_gsc_property' ), 'disconnect revokes and clears local grant/property' );
    $url = ff90_gsc_begin(); parse_str( parse_url( $url, PHP_URL_QUERY ), $q ); $mode = 'wrong_scope';
    $assert( is_wp_error( ff90_gsc_finish( $q['state'], 'synthetic-code' ) ) && ! get_option( 'ff90_gsc_tokens' ), 'insufficient/wrong OAuth scope is not stored as connection' );
    echo "TOTAL: $checks HTTP-DOUBLED checks passed; live Google NOT_RUN\n";
} finally {
    remove_filter( 'pre_http_request', $mock, 10 );
    foreach ( $saved as $key => $value ) { if ( null === $value ) { delete_option( $key ); } else { update_option( $key, $value, false ); } }
    if ( null === $cookie_before ) { unset( $_COOKIE[ LOGGED_IN_COOKIE ] ); } else { $_COOKIE[ LOGGED_IN_COOKIE ] = $cookie_before; }
    wp_set_current_user( $original_user );
}

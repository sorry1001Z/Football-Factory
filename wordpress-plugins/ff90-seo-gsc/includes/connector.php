<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_gsc_config( $key ) {
    $name = 'FF90_GSC_' . strtoupper( $key );
    return defined( $name ) ? (string) constant( $name ) : (string) ( getenv( $name ) ?: '' );
}
function ff90_gsc_error( $code, $status = 400 ) { return new WP_Error( 'ff90_gsc_' . $code, str_replace( '_', ' ', $code ), array( 'status' => $status ) ); }
function ff90_gsc_seal( array $tokens ) {
    if ( ! function_exists( 'sodium_crypto_secretbox' ) ) { return ff90_gsc_error( 'encryption_unavailable' ); }
    $nonce = random_bytes( SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
    $key = hash( 'sha256', wp_salt( 'auth' ) . '|ff90-gsc|' . get_current_blog_id(), true );
    return base64_encode( $nonce . sodium_crypto_secretbox( wp_json_encode( $tokens ), $nonce, $key ) );
}
function ff90_gsc_tokens() {
    $raw = get_option( 'ff90_gsc_tokens', '' ); if ( ! $raw ) { return ff90_gsc_error( 'not_connected' ); }
    $bytes = base64_decode( $raw, true );
    if ( ! function_exists( 'sodium_crypto_secretbox_open' ) || ! is_string( $bytes ) || strlen( $bytes ) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES + SODIUM_CRYPTO_SECRETBOX_MACBYTES ) { return ff90_gsc_error( 'invalid_token_storage' ); }
    $key = hash( 'sha256', wp_salt( 'auth' ) . '|ff90-gsc|' . get_current_blog_id(), true );
    $plain = sodium_crypto_secretbox_open( substr( $bytes, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ), substr( $bytes, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ), $key );
    $tokens = $plain ? json_decode( $plain, true ) : null;
    return is_array( $tokens ) ? $tokens : ff90_gsc_error( 'token_decryption_failed' );
}
function ff90_gsc_store( array $tokens ) { $sealed = ff90_gsc_seal( $tokens ); if ( is_wp_error( $sealed ) ) { return $sealed; } update_option( 'ff90_gsc_tokens', $sealed, false ); return true; }
/** Fixed Google endpoints only; no redirect following, secret logging or raw provider errors. */
function ff90_gsc_http( $url, array $args ) {
    if ( ! preg_match( '~^https://(?:oauth2\.googleapis\.com/(?:token|revoke)|www\.googleapis\.com/webmasters/v3/sites(?:/.*)?)$~D', $url ) ) { return ff90_gsc_error( 'disallowed_endpoint' ); }
    $response = wp_remote_request( $url, array_merge( array( 'timeout' => 15, 'redirection' => 0, 'sslverify' => true, 'limit_response_size' => 2 * MB_IN_BYTES ), $args ) );
    if ( is_wp_error( $response ) ) { return ff90_gsc_error( 'network_unavailable', 503 ); }
    $status = wp_remote_retrieve_response_code( $response );
    if ( $status < 200 || $status > 299 ) { return ff90_gsc_error( 401 === $status || 403 === $status ? 'authorization_required' : ( 429 === $status ? 'quota_exceeded' : 'provider_error' ), $status >= 500 ? 503 : 400 ); }
    $body = wp_remote_retrieve_body( $response ); if ( '' === $body ) { return array(); }
    $data = json_decode( $body, true ); return is_array( $data ) ? $data : ff90_gsc_error( 'invalid_provider_response', 502 );
}
function ff90_gsc_begin() {
    if ( ! current_user_can( 'manage_options' ) ) { return ff90_gsc_error( 'forbidden', 403 ); }
    if ( ! ff90_gsc_config( 'client_id' ) || ! ff90_gsc_config( 'client_secret' ) ) { return ff90_gsc_error( 'oauth_configuration_missing' ); }
    if ( ! is_ssl() && ! in_array( wp_parse_url( home_url(), PHP_URL_HOST ), array( 'localhost', '127.0.0.1' ), true ) ) { return ff90_gsc_error( 'https_required' ); }
    $state = bin2hex( random_bytes( 32 ) ); $verifier = bin2hex( random_bytes( 32 ) );
    set_transient( 'ff90_gsc_state_' . hash( 'sha256', $state ), array( 'user' => get_current_user_id(), 'session' => hash( 'sha256', wp_get_session_token() ), 'verifier' => $verifier ), 10 * MINUTE_IN_SECONDS );
    return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query( array( 'client_id' => ff90_gsc_config( 'client_id' ), 'redirect_uri' => admin_url( 'admin-post.php?action=ff90_gsc_callback' ), 'response_type' => 'code', 'scope' => 'https://www.googleapis.com/auth/webmasters.readonly', 'access_type' => 'offline', 'prompt' => 'consent', 'state' => $state, 'code_challenge' => rtrim( strtr( base64_encode( hash( 'sha256', $verifier, true ) ), '+/', '-_' ), '=' ), 'code_challenge_method' => 'S256' ) );
}
function ff90_gsc_finish( $state, $code ) {
    if ( ! current_user_can( 'manage_options' ) || ! is_string( $state ) || ! preg_match( '/^[a-f0-9]{64}$/D', $state ) || ! is_string( $code ) || '' === $code || strlen( $code ) > 4096 ) { return ff90_gsc_error( 'invalid_callback', 403 ); }
    $key = 'ff90_gsc_state_' . hash( 'sha256', $state ); $saved = get_transient( $key ); delete_transient( $key );
    if ( ! is_array( $saved ) || $saved['user'] !== get_current_user_id() || ! hash_equals( $saved['session'], hash( 'sha256', wp_get_session_token() ) ) ) { return ff90_gsc_error( 'invalid_state', 403 ); }
    $response = ff90_gsc_http( 'https://oauth2.googleapis.com/token', array( 'method' => 'POST', 'body' => array( 'client_id' => ff90_gsc_config( 'client_id' ), 'client_secret' => ff90_gsc_config( 'client_secret' ), 'code' => $code, 'code_verifier' => $saved['verifier'], 'grant_type' => 'authorization_code', 'redirect_uri' => admin_url( 'admin-post.php?action=ff90_gsc_callback' ) ) ) );
    if ( is_wp_error( $response ) ) { return $response; }
    if ( empty( $response['access_token'] ) || ! is_string( $response['access_token'] ) || empty( $response['refresh_token'] ) || ! is_string( $response['refresh_token'] ) || ( isset( $response['scope'] ) && ! in_array( 'https://www.googleapis.com/auth/webmasters.readonly', explode( ' ', $response['scope'] ), true ) ) ) { return ff90_gsc_error( 'incomplete_oauth_grant' ); }
    $expires = max( 60, min( 86400, (int) ( $response['expires_in'] ?? 3600 ) ) );
    $stored = ff90_gsc_store( array( 'access_token' => $response['access_token'], 'refresh_token' => $response['refresh_token'], 'expires_at' => time() + $expires ) );
    if ( ! is_wp_error( $stored ) ) { delete_option( 'ff90_gsc_property' ); }
    return $stored;
}
function ff90_gsc_access_token() {
    $tokens = ff90_gsc_tokens(); if ( is_wp_error( $tokens ) ) { return $tokens; }
    $original_sealed = get_option( 'ff90_gsc_tokens' );
    if ( ! empty( $tokens['access_token'] ) && (int) ( $tokens['expires_at'] ?? 0 ) > time() + 60 ) { return $tokens['access_token']; }
    if ( empty( $tokens['refresh_token'] ) || ! ff90_gsc_config( 'client_id' ) || ! ff90_gsc_config( 'client_secret' ) ) { return ff90_gsc_error( 'authorization_required' ); }
    $lock = get_option( 'ff90_gsc_refresh_lock' ); if ( is_array( $lock ) && ( $lock['until'] ?? 0 ) < time() ) { delete_option( 'ff90_gsc_refresh_lock' ); }
    $lock = array( 'id' => wp_generate_uuid4(), 'until' => time() + 30 );
    if ( ! add_option( 'ff90_gsc_refresh_lock', $lock, '', false ) ) { return ff90_gsc_error( 'refresh_busy', 503 ); }
    try {
        $response = ff90_gsc_http( 'https://oauth2.googleapis.com/token', array( 'method' => 'POST', 'body' => array( 'client_id' => ff90_gsc_config( 'client_id' ), 'client_secret' => ff90_gsc_config( 'client_secret' ), 'refresh_token' => $tokens['refresh_token'], 'grant_type' => 'refresh_token' ) ) );
        if ( is_wp_error( $response ) ) { return $response; }
        if ( empty( $response['access_token'] ) || ! is_string( $response['access_token'] ) ) { return ff90_gsc_error( 'invalid_token_response' ); }
        $tokens['access_token'] = $response['access_token']; $tokens['expires_at'] = time() + max( 60, min( 86400, (int) ( $response['expires_in'] ?? 3600 ) ) );
        if ( ! empty( $response['refresh_token'] ) && is_string( $response['refresh_token'] ) ) { $tokens['refresh_token'] = $response['refresh_token']; }
        if ( get_option( 'ff90_gsc_tokens' ) !== $original_sealed ) { return ff90_gsc_error( 'connection_changed', 409 ); }
        $stored = ff90_gsc_store( $tokens ); return is_wp_error( $stored ) ? $stored : $tokens['access_token'];
    } finally { if ( get_option( 'ff90_gsc_refresh_lock' ) === $lock ) { delete_option( 'ff90_gsc_refresh_lock' ); } }
}
function ff90_gsc_api( $suffix, $method = 'GET', $body = null ) {
    $token = ff90_gsc_access_token(); if ( is_wp_error( $token ) ) { return $token; }
    $args = array( 'method' => $method, 'headers' => array( 'Authorization' => 'Bearer ' . $token, 'Content-Type' => 'application/json' ) ); if ( null !== $body ) { $args['body'] = wp_json_encode( $body ); }
    return ff90_gsc_http( 'https://www.googleapis.com/webmasters/v3/sites' . $suffix, $args );
}
function ff90_gsc_sites() {
    $r = ff90_gsc_api( '' ); if ( is_wp_error( $r ) ) { return $r; } $sites = array();
    foreach ( $r['siteEntry'] ?? array() as $entry ) { if ( isset( $entry['siteUrl'], $entry['permissionLevel'] ) && in_array( $entry['permissionLevel'], array( 'siteOwner', 'siteFullUser', 'siteRestrictedUser' ), true ) ) { $sites[] = $entry['siteUrl']; } }
    return $sites;
}
function ff90_gsc_metrics( $property, $from, $to, $page = '', $limit = 1000 ) {
    if ( ! current_user_can( 'manage_options' ) ) { return ff90_gsc_error( 'forbidden', 403 ); }
    foreach ( array( $from, $to ) as $date ) { $d = is_string( $date ) ? DateTimeImmutable::createFromFormat( '!Y-m-d', $date, new DateTimeZone( 'UTC' ) ) : false; if ( ! $d || $d->format( 'Y-m-d' ) !== $date ) { return ff90_gsc_error( 'invalid_date' ); } }
    if ( $from > $to || $to > gmdate( 'Y-m-d' ) || strtotime( $to ) - strtotime( $from ) > 366 * DAY_IN_SECONDS || ! is_int( $limit ) || $limit < 1 || $limit > 10000 ) { return ff90_gsc_error( 'invalid_range_or_limit' ); }
    if ( ! is_string( $property ) || ! $property || $property !== get_option( 'ff90_gsc_property', '' ) ) { return ff90_gsc_error( 'property_not_selected', 403 ); }
    $sites = ff90_gsc_sites(); if ( is_wp_error( $sites ) ) { return $sites; } if ( ! in_array( $property, $sites, true ) ) { return ff90_gsc_error( 'property_access_denied', 403 ); }
    $body = array( 'startDate' => $from, 'endDate' => $to, 'dimensions' => array( 'query', 'page' ), 'rowLimit' => $limit, 'dataState' => 'final' );
    if ( $page ) { $valid = \FF90\SEO\Policy::canonical( home_url( '/' ), $page ); if ( ! $valid['ok'] ) { return ff90_gsc_error( 'invalid_page' ); } $body['dimensionFilterGroups'] = array( array( 'filters' => array( array( 'dimension' => 'page', 'operator' => 'equals', 'expression' => $page ) ) ) ); }
    $r = ff90_gsc_api( '/' . rawurlencode( $property ) . '/searchAnalytics/query', 'POST', $body ); if ( is_wp_error( $r ) ) { return $r; }
    $metrics = array(); foreach ( $r['rows'] ?? array() as $row ) {
        if ( ! isset( $row['keys'][0], $row['keys'][1] ) ) { continue; }
        $numbers = array(); foreach ( array( 'clicks', 'impressions', 'ctr', 'position' ) as $key ) { if ( ! isset( $row[ $key ] ) || ! is_numeric( $row[ $key ] ) || ! is_finite( (float) $row[ $key ] ) || $row[ $key ] < 0 ) { continue 2; } $numbers[ $key ] = (float) $row[ $key ]; }
        $numbers['ctr'] = min( 1, $numbers['ctr'] );
        $metrics[] = array_merge( $numbers, array( 'site' => $property, 'query' => $row['keys'][0], 'page' => $row['keys'][1], 'dateFrom' => $from, 'dateTo' => $to ) );
    }
    return array( 'metrics' => $metrics, 'truncated' => count( $r['rows'] ?? array() ) >= $limit, 'fetchedAt' => gmdate( 'c' ), 'source' => 'google_search_console' );
}
function ff90_gsc_disconnect() {
    if ( ! current_user_can( 'manage_options' ) ) { return ff90_gsc_error( 'forbidden', 403 ); }
    $tokens = ff90_gsc_tokens(); $revoked = true;
    if ( ! is_wp_error( $tokens ) && ! empty( $tokens['refresh_token'] ) ) { $revoked = ! is_wp_error( ff90_gsc_http( 'https://oauth2.googleapis.com/revoke', array( 'method' => 'POST', 'body' => array( 'token' => $tokens['refresh_token'] ) ) ) ); }
    delete_option( 'ff90_gsc_tokens' ); delete_option( 'ff90_gsc_property' );
    return array( 'disconnected' => true, 'remote_revocation_verified' => $revoked );
}

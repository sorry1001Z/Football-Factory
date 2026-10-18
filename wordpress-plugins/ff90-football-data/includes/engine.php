<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_football_install() {
    global $wpdb; require_once ABSPATH . 'wp-admin/includes/upgrade.php'; $charset = $wpdb->get_charset_collate();
    dbDelta( "CREATE TABLE {$wpdb->prefix}ff90_football_quota (
        provider varchar(32) NOT NULL,
        quota_day date NOT NULL,
        requests int unsigned NOT NULL DEFAULT 0,
        PRIMARY KEY  (provider,quota_day)
    ) $charset;" );
}
function ff90_football_token() { return defined( 'FF90_FOOTBALL_DATA_TOKEN' ) ? (string) FF90_FOOTBALL_DATA_TOKEN : (string) ( getenv( 'FF90_FOOTBALL_DATA_TOKEN' ) ?: '' ); }
function ff90_football_options() { return wp_parse_args( get_option( 'ff90_football_options', array() ), array( 'enabled' => false, 'competition' => 'PL', 'provider' => 'football-data.org', 'season' => 0, 'auto_refresh' => false ) ); }
function ff90_football_date_valid( $date ) { $d = is_string( $date ) ? DateTimeImmutable::createFromFormat( '!Y-m-d', $date, wp_timezone() ) : false; return $d && $d->format( 'Y-m-d' ) === $date; }
function ff90_football_cache_key( $kind, $competition, $date ) { return 'ff90_fd_' . hash( 'sha256', $kind . '|' . $competition . '|' . $date . '|' . wp_timezone_string() ); }
function ff90_football_take_quota() {
    global $wpdb; $day = gmdate( 'Y-m-d' ); $limit = max( 1, min( 10000, (int) apply_filters( 'ff90_football_daily_budget', 100 ) ) );
    $wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->prefix}ff90_football_quota (provider,quota_day,requests) VALUES ('football-data.org',%s,0)", $day ) );
    return 1 === $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}ff90_football_quota SET requests=requests+1 WHERE provider='football-data.org' AND quota_day=%s AND requests < %d", $day, $limit ) );
}
function ff90_football_normalize( $kind, $raw, $date ) {
    $out = array(); if ( ! is_array( $raw ) ) { return new WP_Error( 'football_payload', 'Invalid source response.' ); }
    if ( 'matches' === $kind ) {
        if ( ! isset( $raw['matches'] ) || ! is_array( $raw['matches'] ) ) { return new WP_Error( 'football_payload', 'Source match list missing.' ); }
        foreach ( array_slice( $raw['matches'], 0, 300 ) as $m ) {
            if ( empty( $m['id'] ) || ! is_string( $m['utcDate'] ?? null ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/D', $m['utcDate'] ) || empty( $m['homeTeam']['name'] ) || empty( $m['awayTeam']['name'] ) ) { continue; }
            try { $when = new DateTimeImmutable( $m['utcDate'] ); } catch ( Exception $e ) { continue; }
            $date_errors = DateTimeImmutable::getLastErrors(); if ( is_array( $date_errors ) && ( $date_errors['warning_count'] || $date_errors['error_count'] ) ) { continue; }
            if ( $when->setTimezone( wp_timezone() )->format( 'Y-m-d' ) !== $date ) { continue; }
            $score = array(); foreach ( array( 'home', 'away' ) as $side ) { $value = $m['score']['fullTime'][ $side ] ?? null; $score[ $side ] = is_int( $value ) && $value >= 0 ? $value : null; }
            $out[] = array( 'id' => (string) $m['id'], 'kickoff' => $when->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'c' ), 'status' => sanitize_key( $m['status'] ?? 'unknown' ), 'home' => sanitize_text_field( $m['homeTeam']['name'] ), 'away' => sanitize_text_field( $m['awayTeam']['name'] ), 'score' => $score );
        }
    } else {
        if ( ! isset( $raw['standings'] ) || ! is_array( $raw['standings'] ) ) { return new WP_Error( 'football_payload', 'Source standings missing.' ); }
        foreach ( $raw['standings'] as $group ) {
            if ( 'TOTAL' !== ( $group['type'] ?? '' ) ) { continue; } $rows = array();
            foreach ( array_slice( $group['table'] ?? array(), 0, 100 ) as $row ) {
                if ( empty( $row['team']['name'] ) ) { continue; }
                $r = array( 'team' => sanitize_text_field( $row['team']['name'] ) );
                foreach ( array( 'position', 'playedGames', 'won', 'draw', 'lost', 'goalsFor', 'goalsAgainst', 'goalDifference', 'points' ) as $field ) { if ( ! isset( $row[ $field ] ) || ! is_int( $row[ $field ] ) ) { continue 2; } $r[ $field ] = $row[ $field ]; }
                $rows[] = $r;
            }
            $out[] = array( 'group' => sanitize_text_field( $group['group'] ?? $group['stage'] ?? 'TOTAL' ), 'rows' => $rows );
        }
    }
    return $out;
}
function ff90_football_get( $kind, $competition = '', $date = '' ) {
    $options = ff90_football_options(); $competition = $competition ?: $options['competition']; $date = $date ?: wp_date( 'Y-m-d' );
    if ( ! in_array( $kind, array( 'matches', 'standings' ), true ) || ! is_string( $competition ) || ! preg_match( '/^[A-Z0-9_-]{1,20}$/D', $competition ) || ! ff90_football_date_valid( $date ) ) { return new WP_Error( 'football_validation', 'Invalid football request.' ); }
    if ( 'standings' === $kind && $date !== wp_date( 'Y-m-d' ) ) { return new WP_Error( 'football_validation', 'Historical standings are not supported by this current-table adapter.' ); }
    if ( 'api-football' === $options['provider'] ) { return ff90_af_get( $kind, $competition, $date ); }
    if ( ! $options['enabled'] || ! ff90_football_token() ) { return new WP_Error( 'football_not_connected', 'ยังไม่ได้เชื่อมผู้ให้บริการข้อมูลฟุตบอล' ); }
    $key = ff90_football_cache_key( $kind, $competition, $date ); $fresh = get_transient( $key ); if ( is_array( $fresh ) ) { return $fresh; }
    $history = get_transient( $key . '_last' );
    $failure = function ( $code ) use ( $history ) { if ( is_array( $history ) ) { $history['stale'] = true; $history['error_code'] = $code; return $history; } return new WP_Error( $code, 'Source unavailable; no verified data cached.' ); };
    if ( get_transient( 'ff90_fd_backoff' ) ) { return $failure( 'football_rate_limited' ); }
    $lock_key = $key . '_lock'; $lock = get_option( $lock_key ); if ( is_array( $lock ) && $lock['until'] < time() ) { delete_option( $lock_key ); }
    $lock = array( 'id' => wp_generate_uuid4(), 'until' => time() + 30 ); if ( ! add_option( $lock_key, $lock, '', false ) ) { return $failure( 'football_refresh_busy' ); }
    try {
        if ( ! ff90_football_take_quota() ) { return $failure( 'football_quota_exceeded' ); }
        $url = 'https://api.football-data.org/v4/competitions/' . rawurlencode( $competition ) . '/' . $kind;
        if ( 'matches' === $kind ) { $day = new DateTimeImmutable( $date, wp_timezone() ); $url = add_query_arg( array( 'dateFrom' => $day->modify( '-1 day' )->format( 'Y-m-d' ), 'dateTo' => $day->modify( '+1 day' )->format( 'Y-m-d' ) ), $url ); }
        $r = wp_remote_get( $url, array( 'timeout' => 12, 'redirection' => 0, 'sslverify' => true, 'limit_response_size' => 2 * MB_IN_BYTES, 'headers' => array( 'X-Auth-Token' => ff90_football_token() ) ) );
        if ( is_wp_error( $r ) ) { return $failure( 'football_network' ); }
        $status = wp_remote_retrieve_response_code( $r );
        if ( 429 === $status ) { set_transient( 'ff90_fd_backoff', 1, 300 ); return $failure( 'football_rate_limited' ); }
        if ( 200 !== $status ) { return $failure( in_array( $status, array( 401, 403 ), true ) ? 'football_authorization' : 'football_provider_error' ); }
        $data = ff90_football_normalize( $kind, json_decode( wp_remote_retrieve_body( $r ), true ), $date ); if ( is_wp_error( $data ) ) { return $failure( $data->get_error_code() ); }
        $result = array( 'data' => $data, 'provider' => 'football-data.org', 'source_url' => 'https://www.football-data.org/', 'fetched_at' => gmdate( 'c' ), 'stale' => false, 'competition' => $competition, 'date' => $date );
        set_transient( $key, $result, 'standings' === $kind ? 900 : 300 ); set_transient( $key . '_last', $result, DAY_IN_SECONDS ); do_action( 'ff90_audit_event', 'football_source_refreshed' ); return $result;
    } finally { if ( get_option( $lock_key ) === $lock ) { delete_option( $lock_key ); } }
}
add_action( 'admin_init', function () { register_setting( 'ff90_football', 'ff90_football_options', array( 'sanitize_callback' => function ( $v ) { $competition = isset( $v['competition'] ) && is_string( $v['competition'] ) && preg_match( '/^[A-Z0-9_-]{1,20}$/D', $v['competition'] ) ? $v['competition'] : 'PL'; return array( 'enabled' => ! empty( $v['enabled'] ), 'competition' => $competition, 'provider' => in_array( $v['provider'] ?? '', array( 'football-data.org', 'api-football' ), true ) ? $v['provider'] : 'football-data.org', 'season' => absint( $v['season'] ?? 0 ), 'auto_refresh' => ! empty( $v['auto_refresh'] ) ); } ) ); } );
add_action( 'admin_menu', function () {
    add_options_page( 'Football Data', 'FF90 Football Data', 'manage_options', 'ff90-football', function () {
        if ( ! current_user_can( 'manage_options' ) ) { return; } $o = ff90_football_options();
        echo '<div class="wrap"><h1>Football Data Engine</h1><p>Choose football-data.org v4 (FF90_FOOTBALL_DATA_TOKEN) or direct API-Football v3 (API_FOOTBALL_KEY) in server configuration. Keys are never stored here. API-Football: hard cap 80/day UTC, matches shared for 1 hour, standings 6 hours. Free plan entitlement/current seasons must be verified. No automatic paid upgrade. Set season start year only after confirming access; historical seasons are labelled.</p><form method="post" action="options.php">'; settings_fields( 'ff90_football' );
        echo '<p><label>Provider <select name="ff90_football_options[provider]"><option value="football-data.org" ' . selected( $o['provider'], 'football-data.org', false ) . '>football-data.org</option><option value="api-football" ' . selected( $o['provider'], 'api-football', false ) . '>API-Football (direct API-Sports)</option></select></label></p><p><label>API-Football season start year <input type="number" min="0" max="2100" name="ff90_football_options[season]" value="' . esc_attr( $o['season'] ) . '"></label> 0 = not selected; standings unavailable until access is verified.</p>';
        echo '<p><label><input type="checkbox" name="ff90_football_options[auto_refresh]" value="1" ' . checked( $o['auto_refresh'], true, false ) . '> Hourly refresh for five major leagues (requires a functioning WP-Cron runner and a verified active Free plan). Does not publish news.</label></p>';
        if ( 'api-football' === $o['provider'] ) { echo '<p>Local request attempts today (UTC): ' . esc_html( ff90_af_usage() ) . ' / 80. External usage of the same key is not included.</p>'; }
        echo '<p><label><input type="checkbox" name="ff90_football_options[enabled]" value="1" ' . checked( $o['enabled'], true, false ) . '> Enable configured provider requests</label></p><p><label>Competition code <input name="ff90_football_options[competition]" value="' . esc_attr( $o['competition'] ) . '"></label></p>'; submit_button(); echo '</form></div>';
    } );
} );

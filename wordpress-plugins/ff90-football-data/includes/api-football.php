<?php
/** Direct API-Sports v3 adapter. No browser keys, redirects or paid upgrade path. */
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_af_token() {
    return defined( 'API_FOOTBALL_KEY' ) ? (string) API_FOOTBALL_KEY : (string) ( getenv( 'API_FOOTBALL_KEY' ) ?: '' );
}
function ff90_af_leagues() { return array( 'PL' => 39, 'PD' => 140, 'BL1' => 78, 'SA' => 135, 'FL1' => 61, 'CL' => 2, 'EL' => 3, 'FAC' => 45, 'EFL' => 48, 'CDR' => 143, 'CI' => 137, 'DFB' => 81, 'CDF' => 66 ); }
function ff90_af_usage() {
    global $wpdb;
    return (int) $wpdb->get_var( $wpdb->prepare( "SELECT requests FROM {$wpdb->prefix}ff90_football_quota WHERE provider='api-football' AND quota_day=%s", gmdate( 'Y-m-d' ) ) );
}
function ff90_af_take_quota() {
    global $wpdb; $day = gmdate( 'Y-m-d' );
    $wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->prefix}ff90_football_quota (provider,quota_day,requests) VALUES ('api-football',%s,0)", $day ) );
    return 1 === $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}ff90_football_quota SET requests=requests+1 WHERE provider='api-football' AND quota_day=%s AND requests < 80", $day ) );
}
function ff90_af_error( $code ) {
    $messages = array(
        'football_network' => 'ติดต่อ API-Football ไม่ได้ ยังไม่มีข้อมูลใหม่ที่ยืนยันแล้ว',
        'football_authorization' => 'API-Football ไม่อนุญาตคำขอนี้ กรุณาตรวจคีย์และสิทธิ์แพ็กเกจ',
        'football_entitlement' => 'แพ็กเกจ API-Football ไม่รองรับคำขอหรือฤดูกาลนี้ ยังไม่เปลี่ยนไปใช้แพ็กเกจเสียเงิน',
        'football_quota_exceeded' => 'หยุดเรียก API-Football ตามเพดาน local 80 ครั้ง/วัน UTC',
        'football_season_required' => 'ยังไม่ได้เลือกฤดูกาลที่แพ็กเกจอนุญาตสำหรับตารางคะแนน',
    );
    return new WP_Error( $code, $messages[ $code ] ?? 'API-Football ยังไม่มีข้อมูลที่ยืนยันได้สำหรับคำขอนี้' );
}
/** A single shared cache/lock per upstream query, independent of requesting page. */
function ff90_af_request( $endpoint, $params = array() ) {
    $allowed = array( 'status', 'leagues', 'fixtures', 'standings' );
    if ( ! in_array( $endpoint, $allowed, true ) || ! is_array( $params ) ) { return ff90_af_error( 'football_validation' ); }
    // Callers construct all query parameters; prohibit arbitrary provider requests through this helper.
    $fields = array( 'status' => array(), 'leagues' => array( 'id' ), 'fixtures' => array( 'date', 'timezone' ), 'standings' => array( 'league', 'season' ) );
    if ( array_diff( array_keys( $params ), $fields[ $endpoint ] ) ) { return ff90_af_error( 'football_validation' ); }
    if ( ! ff90_af_token() ) { return ff90_af_error( 'football_authorization' ); }
    $day_scope = 'fixtures' === $endpoint && ( $params['date'] ?? '' ) === wp_date( 'Y-m-d' ) ? 'today' : 'other';
    ksort( $params ); $key = 'ff90_af_v2_' . hash( 'sha256', hash( 'sha256', ff90_af_token() ) . $endpoint . wp_json_encode( $params ) . $day_scope );
    $fresh = get_transient( $key ); if ( is_array( $fresh ) ) { return $fresh; }
    $history = get_transient( $key . '_last' );
    $fail = function ( $code ) use ( $history ) {
        if ( is_array( $history ) ) { $history['stale'] = true; $history['error_code'] = $code; return $history; }
        return ff90_af_error( $code );
    };
    $backoff = get_transient( 'ff90_af_backoff' ); if ( $backoff ) { return $fail( $backoff ); }
    $negative = get_transient( $key . '_error' ); if ( $negative ) { return $fail( $negative ); }
    $lock_key = $key . '_lock'; $old = get_option( $lock_key );
    if ( is_array( $old ) && ( $old['until'] ?? 0 ) < time() ) { delete_option( $lock_key ); }
    $lock = array( 'id' => wp_generate_uuid4(), 'until' => time() + 30 );
    if ( ! add_option( $lock_key, $lock, '', false ) ) { return $fail( 'football_refresh_busy' ); }
    try {
        if ( ! ff90_af_take_quota() ) { return $fail( 'football_quota_exceeded' ); }
        $r = wp_remote_get( add_query_arg( $params, 'https://v3.football.api-sports.io/' . $endpoint ), array(
            'timeout' => 12, 'redirection' => 0, 'sslverify' => true, 'limit_response_size' => 2 * MB_IN_BYTES,
            'headers' => array( 'x-apisports-key' => ff90_af_token() ),
        ) );
        $code = '';
        if ( is_wp_error( $r ) ) { $code = 'football_network'; }
        else {
            $status = wp_remote_retrieve_response_code( $r );
            $body = json_decode( wp_remote_retrieve_body( $r ), true );
            $remaining = wp_remote_retrieve_header( $r, 'x-ratelimit-requests-remaining' );
            if ( is_scalar( $remaining ) && '' !== (string) $remaining && ctype_digit( (string) $remaining ) && 0 === (int) $remaining ) {
                set_transient( 'ff90_af_backoff', 'football_rate_limited', max( 60, strtotime( 'tomorrow UTC' ) - time() ) );
            }
            if ( 429 === $status ) { $code = 'football_rate_limited'; }
            elseif ( in_array( $status, array( 401, 403 ), true ) ) { $code = 'football_authorization'; }
            elseif ( 200 !== $status ) { $code = 'football_provider_error'; }
            elseif ( ! is_array( $body ) || ! isset( $body['errors'], $body['response'] ) || ! is_array( $body['errors'] ) || ! is_array( $body['response'] ) ) { $code = 'football_payload'; }
            elseif ( $body['errors'] ) {
                // HTTP 200 can still be a failed request. Never expose arbitrary error payloads or cache as an empty success.
                $names = array_map( 'strtolower', array_map( 'strval', array_keys( $body['errors'] ) ) );
                $code = array_intersect( $names, array( 'rate_limit', 'requests', 'rate' ) ) ? 'football_rate_limited' : 'football_entitlement';
            }
            elseif ( 'fixtures' === $endpoint && ( ! isset( $body['paging']['current'], $body['paging']['total'] ) || (int) $body['paging']['total'] > (int) $body['paging']['current'] || count( $body['response'] ) > 3000 ) ) { $code = 'football_payload'; }
            elseif ( 'fixtures' === $endpoint ) {
                foreach ( $body['response'] as $row ) { if ( ! is_array( $row ) || empty( $row['fixture']['id'] ) || empty( $row['fixture']['date'] ) || empty( $row['league']['id'] ) || empty( $row['teams']['home']['name'] ) || empty( $row['teams']['away']['name'] ) ) { $code = 'football_payload'; break; } }
            }
        }
        if ( $code ) {
            set_transient( $key . '_error', $code, 'football_entitlement' === $code ? DAY_IN_SECONDS : 900 );
            if ( in_array( $code, array( 'football_rate_limited', 'football_authorization' ), true ) && ! get_transient( 'ff90_af_backoff' ) ) { set_transient( 'ff90_af_backoff', $code, 'football_rate_limited' === $code ? 300 : HOUR_IN_SECONDS ); }
            return $fail( $code );
        }
        if ( 'status' === $endpoint ) {
            $source = $body['response'];
            $data = array( 'subscription' => array( 'plan' => sanitize_text_field( $source['subscription']['plan'] ?? '' ), 'active' => ! empty( $source['subscription']['active'] ), 'end' => sanitize_text_field( $source['subscription']['end'] ?? '' ) ), 'requests' => array( 'current' => absint( $source['requests']['current'] ?? 0 ), 'limit_day' => absint( $source['requests']['limit_day'] ?? 0 ) ) );
        } else { $data = $body['response']; }
        $out = array( 'data' => $data, 'fetched_at' => gmdate( 'c' ), 'stale' => false );
        $ttl = 'fixtures' === $endpoint ? ( 'today' === $day_scope ? HOUR_IN_SECONDS : 6 * HOUR_IN_SECONDS ) : ( 'standings' === $endpoint ? 6 * HOUR_IN_SECONDS : DAY_IN_SECONDS );
        set_transient( $key, $out, $ttl ); set_transient( $key . '_last', $out, 3 * DAY_IN_SECONDS );
        return $out;
    } finally { if ( get_option( $lock_key ) === $lock ) { delete_option( $lock_key ); } }
}
/** Optional native hourly refresh, disabled by default and never a content publisher. */
add_action( 'init', function () {
    $o = ff90_football_options();
    if ( ! empty( $o['auto_refresh'] ) && $o['enabled'] && 'api-football' === $o['provider'] && ff90_af_token() ) {
        if ( ! wp_next_scheduled( 'ff90_af_refresh' ) ) { wp_schedule_event( time() + 60, 'hourly', 'ff90_af_refresh' ); }
    } elseif ( wp_next_scheduled( 'ff90_af_refresh' ) ) { wp_clear_scheduled_hook( 'ff90_af_refresh' ); }
} );
add_action( 'ff90_af_refresh', function () {
    $o = ff90_football_options();
    if ( empty( $o['auto_refresh'] ) || ! $o['enabled'] || 'api-football' !== $o['provider'] ) { return; }
    $status = ff90_af_request( 'status' );
    if ( is_wp_error( $status ) || $status['stale'] || empty( $status['data']['subscription']['active'] ) || 'free' !== strtolower( $status['data']['subscription']['plan'] ) || $status['data']['requests']['limit_day'] < 80 ) { return; }
    foreach ( array( 'PL', 'PD', 'BL1', 'SA', 'FL1' ) as $code ) {
        ff90_football_get( 'matches', $code );
        ff90_football_get( 'standings', $code );
    }
} );
function ff90_af_normalize( $kind, $rows, $league_id, $date, $season ) {
    $out = array();
    if ( ! is_array( $rows ) ) { return ff90_af_error( 'football_payload' ); }
    if ( 'matches' === $kind ) {
        $statuses = array( 'TBD' => 'scheduled', 'NS' => 'scheduled', '1H' => 'in_play', 'HT' => 'paused', '2H' => 'in_play', 'ET' => 'in_play', 'BT' => 'paused', 'P' => 'in_play', 'LIVE' => 'in_play', 'FT' => 'finished', 'AET' => 'finished', 'PEN' => 'finished', 'PST' => 'postponed', 'CANC' => 'cancelled', 'ABD' => 'suspended', 'SUSP' => 'suspended', 'INT' => 'suspended', 'AWD' => 'awarded', 'WO' => 'awarded' );
        foreach ( array_slice( $rows, 0, 3000 ) as $r ) {
            if ( ! is_array( $r ) || (int) ( $r['league']['id'] ?? 0 ) !== $league_id || empty( $r['fixture']['id'] ) || empty( $r['teams']['home']['name'] ) || empty( $r['teams']['away']['name'] ) ) { continue; }
            $iso = $r['fixture']['date'] ?? '';
            if ( ! is_string( $iso ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/D', $iso ) ) { continue; }
            try { $when = new DateTimeImmutable( $iso ); } catch ( Exception $e ) { continue; }
            $errors = DateTimeImmutable::getLastErrors(); if ( is_array( $errors ) && ( $errors['warning_count'] || $errors['error_count'] ) ) { continue; }
            if ( $when->setTimezone( wp_timezone() )->format( 'Y-m-d' ) !== $date ) { continue; }
            $score = array(); foreach ( array( 'home', 'away' ) as $side ) { $v = $r['goals'][ $side ] ?? null; $score[ $side ] = is_int( $v ) && $v >= 0 ? $v : null; }
            $out[] = array( 'id' => (string) $r['fixture']['id'], 'kickoff' => $when->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'c' ), 'status' => $statuses[ $r['fixture']['status']['short'] ?? '' ] ?? 'unknown', 'home' => sanitize_text_field( $r['teams']['home']['name'] ), 'away' => sanitize_text_field( $r['teams']['away']['name'] ), 'score' => $score );
        }
    } else {
        foreach ( $rows as $block ) {
            if ( (int) ( $block['league']['id'] ?? 0 ) !== $league_id || (int) ( $block['league']['season'] ?? 0 ) !== $season || ! is_array( $block['league']['standings'] ?? null ) ) { return ff90_af_error( 'football_payload' ); }
            foreach ( $block['league']['standings'] as $group ) {
                if ( ! is_array( $group ) ) { return ff90_af_error( 'football_payload' ); } $table = array();
                foreach ( array_slice( $group, 0, 100 ) as $row ) {
                    if ( empty( $row['team']['name'] ) ) { continue; }
                    $r = array( 'team' => sanitize_text_field( $row['team']['name'] ), 'position' => $row['rank'] ?? null, 'points' => $row['points'] ?? null, 'goalDifference' => $row['goalsDiff'] ?? null );
                    foreach ( array( 'playedGames' => 'played', 'won' => 'win', 'draw' => 'draw', 'lost' => 'lose' ) as $to => $from ) { $r[ $to ] = $row['all'][ $from ] ?? null; }
                    $r['goalsFor'] = $row['all']['goals']['for'] ?? null; $r['goalsAgainst'] = $row['all']['goals']['against'] ?? null;
                    foreach ( $r as $name => $v ) { if ( 'team' !== $name && ! is_int( $v ) ) { continue 2; } }
                    $table[] = $r;
                }
                if ( $group && ! $table ) { return ff90_af_error( 'football_payload' ); }
                $out[] = array( 'group' => sanitize_text_field( $group[0]['group'] ?? 'TOTAL' ), 'rows' => $table );
            }
        }
    }
    if ( $rows && ! $out && 'standings' === $kind ) { return ff90_af_error( 'football_payload' ); }
    return $out;
}
function ff90_af_get( $kind, $competition, $date ) {
    $o = ff90_football_options(); $leagues = ff90_af_leagues();
    if ( ! $o['enabled'] || ! ff90_af_token() ) { return new WP_Error( 'football_not_connected', 'ยังไม่ได้เชื่อม API-Football' ); }
    if ( ! isset( $leagues[ $competition ] ) ) { return ff90_af_error( 'football_validation' ); }
    $season = absint( $o['season'] );
    if ( 'standings' === $kind && ( $season < 2000 || $season > 2100 ) ) { return ff90_af_error( 'football_season_required' ); }
    // Restrict public query variety to yesterday/today/tomorrow, preventing date-based quota exhaustion.
    $today = new DateTimeImmutable( wp_date( 'Y-m-d' ), wp_timezone() );
    if ( ! in_array( $date, array( $today->modify( '-1 day' )->format( 'Y-m-d' ), $today->format( 'Y-m-d' ), $today->modify( '+1 day' )->format( 'Y-m-d' ) ), true ) ) { return ff90_af_error( 'football_validation' ); }
    $raw = 'matches' === $kind ? ff90_af_request( 'fixtures', array( 'date' => $date, 'timezone' => wp_timezone_string() ) ) : ff90_af_request( 'standings', array( 'league' => $leagues[ $competition ], 'season' => $season ) );
    if ( is_wp_error( $raw ) ) { return $raw; }
    $data = ff90_af_normalize( $kind, $raw['data'], $leagues[ $competition ], $date, $season ); if ( is_wp_error( $data ) ) { return $data; }
    return array( 'data' => $data, 'provider' => 'API-Football', 'source_url' => 'https://www.api-football.com/', 'fetched_at' => $raw['fetched_at'], 'stale' => $raw['stale'], 'error_code' => $raw['error_code'] ?? '', 'competition' => $competition, 'date' => $date, 'season' => 'standings' === $kind ? $season : null );
}

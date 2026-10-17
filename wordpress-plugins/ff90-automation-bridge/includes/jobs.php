<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_automation_install() {
    global $wpdb; require_once ABSPATH . 'wp-admin/includes/upgrade.php'; $charset = $wpdb->get_charset_collate();
    dbDelta( "CREATE TABLE {$wpdb->prefix}ff90_automation_jobs (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        job_key varchar(100) NOT NULL,
        request_hash varchar(64) NOT NULL,
        task varchar(32) NOT NULL,
        object_id bigint(20) unsigned NOT NULL DEFAULT 0,
        actor_id bigint(20) unsigned NOT NULL,
        payload longtext NOT NULL,
        state varchar(24) NOT NULL,
        attempts int unsigned NOT NULL DEFAULT 0,
        available_at bigint(20) unsigned NOT NULL,
        locked_until bigint(20) unsigned NOT NULL DEFAULT 0,
        lease_token varchar(64) NOT NULL DEFAULT '',
        error_code varchar(80) NOT NULL DEFAULT '',
        created_at datetime NOT NULL,
        PRIMARY KEY  (id),
        UNIQUE KEY job_key (job_key),
        KEY runnable (state,available_at)
    ) $charset;" );
}
function ff90_automation_get( $id ) { global $wpdb; return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}ff90_automation_jobs WHERE id=%d", $id ), ARRAY_A ); }
function ff90_automation_summary( $job ) { return array_intersect_key( $job, array_flip( array( 'id', 'task', 'object_id', 'state', 'attempts', 'available_at', 'error_code', 'created_at' ) ) ); }
function ff90_automation_enqueue( $key, $task, $payload ) {
    global $wpdb;
    if ( ! current_user_can( 'edit_posts' ) || ! is_string( $key ) || ! preg_match( '/^[A-Za-z0-9._:-]{8,100}$/D', $key ) || ! is_array( $payload ) || ! in_array( $task, array( 'content_qa', 'football_sync', 'handoff' ), true ) ) { return new WP_Error( 'automation_validation', 'Invalid job or permission.', array( 'status' => 400 ) ); }
    $clean = array(); $post_id = absint( $payload['post_id'] ?? 0 );
    if ( in_array( $task, array( 'content_qa', 'handoff' ), true ) ) {
        if ( ! $post_id || ! get_post( $post_id ) || ! current_user_can( 'edit_post', $post_id ) ) { return new WP_Error( 'automation_forbidden', 'Article permission required.', array( 'status' => 403 ) ); } $clean['post_id'] = $post_id;
    } else {
        if ( ! current_user_can( 'manage_options' ) ) { return new WP_Error( 'automation_forbidden', 'Football sync requires administrator.', array( 'status' => 403 ) ); }
        $competition = $payload['competition'] ?? ''; $date = $payload['date'] ?? '';
        if ( ! is_string( $competition ) || ! preg_match( '/^[A-Z0-9_-]{1,20}$/D', $competition ) || ! function_exists( 'ff90_football_date_valid' ) || ! ff90_football_date_valid( $date ) ) { return new WP_Error( 'automation_validation', 'Competition and date required.', array( 'status' => 400 ) ); }
        $clean = array( 'competition' => $competition, 'date' => $date );
    }
    $hash = hash( 'sha256', wp_json_encode( array( $task, $clean ) ) );
    $existing = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}ff90_automation_jobs WHERE job_key=%s", $key ), ARRAY_A );
    if ( $existing ) { return $existing['request_hash'] === $hash && (int) $existing['actor_id'] === get_current_user_id() ? ff90_automation_summary( $existing ) : new WP_Error( 'automation_idempotency_conflict', 'Idempotency key already used by another request.', array( 'status' => 409 ) ); }
    $pending = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}ff90_automation_jobs WHERE actor_id=%d AND state IN ('queued','running','retry')", get_current_user_id() ) );
    if ( $pending >= 50 ) { return new WP_Error( 'automation_queue_full', 'Pending job limit reached.', array( 'status' => 429 ) ); }
    $inserted = $wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->prefix}ff90_automation_jobs (job_key,request_hash,task,object_id,actor_id,payload,state,attempts,available_at,locked_until,lease_token,error_code,created_at) VALUES (%s,%s,%s,%d,%d,%s,'queued',0,%d,0,'','',%s)", $key, $hash, $task, $post_id, get_current_user_id(), wp_json_encode( $clean ), time(), gmdate( 'Y-m-d H:i:s' ) ) );
    $job = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}ff90_automation_jobs WHERE job_key=%s", $key ), ARRAY_A );
    if ( ! $job ) { return new WP_Error( 'automation_storage', 'Job persistence failed.', array( 'status' => 503 ) ); }
    if ( $job['request_hash'] !== $hash || (int) $job['actor_id'] !== get_current_user_id() ) { return new WP_Error( 'automation_idempotency_conflict', 'Concurrent key conflict.', array( 'status' => 409 ) ); }
    if ( 1 === $inserted ) { do_action( 'ff90_audit_event', 'automation_queued', $post_id ); }
    return ff90_automation_summary( $job );
}
function ff90_automation_retryable( $code ) { return in_array( $code, array( 'football_network', 'football_rate_limited', 'football_refresh_busy', 'football_quota_exceeded', 'football_provider_error', 'automation_transient' ), true ); }
function ff90_automation_run( $id ) {
    global $wpdb; $token = wp_generate_uuid4();
    $claim = $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}ff90_automation_jobs SET state='running',attempts=attempts+1,locked_until=%d,lease_token=%s WHERE id=%d AND state IN ('queued','retry') AND available_at<=%d AND attempts<3", time() + 120, $token, $id, time() ) );
    if ( 1 !== $claim ) { return new WP_Error( 'automation_not_claimed', 'Job unavailable, leased or exhausted.' ); }
    $job = ff90_automation_get( $id ); $payload = json_decode( $job['payload'], true );
    $owner_ok = 'football_sync' === $job['task'] ? user_can( (int) $job['actor_id'], 'manage_options' ) : user_can( (int) $job['actor_id'], 'edit_post', (int) $job['object_id'] );
    if ( ! $owner_ok ) { $result = new WP_Error( 'automation_permission_revoked', 'Owner permission no longer valid.' ); }
    else {
        $handlers = apply_filters( 'ff90_automation_handlers', array(
            'content_qa' => function ( $p ) { return function_exists( 'ff90_qa_report' ) ? ff90_qa_report( $p['post_id'] ) : new WP_Error( 'automation_qa_missing', 'Content QA plugin not active.' ); },
            'football_sync' => function ( $p ) { return function_exists( 'ff90_football_get' ) ? ff90_football_get( 'matches', $p['competition'], $p['date'] ) : new WP_Error( 'automation_football_missing', 'Football engine not active.' ); },
            'handoff' => function () { return new WP_Error( 'automation_connector_missing', 'n8n/Hermes delivery adapter not connected.' ); },
        ) );
        try { $result = isset( $handlers[ $job['task'] ] ) && is_callable( $handlers[ $job['task'] ] ) ? call_user_func( $handlers[ $job['task'] ], $payload, $job ) : new WP_Error( 'automation_handler_missing', 'No registered task handler.' ); }
        catch ( Throwable $e ) { $result = new WP_Error( 'automation_handler_exception', 'Handler failed; inspect trusted server logs without exposing secrets.' ); }
    }
    $error = ''; $next = time();
    if ( is_wp_error( $result ) ) {
        $error = substr( sanitize_key( $result->get_error_code() ), 0, 80 );
        $state = ff90_automation_retryable( $error ) && (int) $job['attempts'] < 3 ? 'retry' : ( false !== strpos( $error, 'missing' ) || 'football_not_connected' === $error ? 'blocked' : 'failed' );
        if ( 'retry' === $state ) { $delay = 'football_rate_limited' === $error ? 300 : ( 'football_quota_exceeded' === $error ? max( 60, strtotime( 'tomorrow UTC' ) - time() ) : min( 900, 30 * ( 2 ** ( (int) $job['attempts'] - 1 ) ) ) ); $next += $delay; }
    } else { $state = 'content_qa' === $job['task'] ? 'waiting_review' : 'succeeded'; }
    $saved = $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}ff90_automation_jobs SET state=%s,error_code=%s,available_at=%d,locked_until=0,lease_token='' WHERE id=%d AND state='running' AND lease_token=%s", $state, $error, $next, $id, $token ) );
    if ( 1 !== $saved ) { return new WP_Error( 'automation_lease_lost', 'Expired worker cannot overwrite another claim.' ); }
    do_action( 'ff90_audit_event', 'automation_' . $state, (int) $job['object_id'] ); return ff90_automation_summary( ff90_automation_get( $id ) );
}
function ff90_automation_recover() {
    global $wpdb;
    $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}ff90_automation_jobs SET state='retry',available_at=%d,locked_until=0,lease_token='',error_code='worker_lease_expired' WHERE state='running' AND locked_until<%d AND attempts<3", time(), time() ) );
    $wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}ff90_automation_jobs SET state='failed',locked_until=0,lease_token='',error_code='worker_attempts_exhausted' WHERE state='running' AND locked_until<%d AND attempts>=3", time() ) );
}
add_action( 'ff90_automation_tick', function () {
    if ( ! get_option( 'ff90_automation_worker_enabled', false ) ) { return; } global $wpdb; ff90_automation_recover();
    foreach ( $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}ff90_automation_jobs WHERE state IN ('queued','retry') AND available_at<=%d ORDER BY id LIMIT 10", time() ) ) as $id ) { ff90_automation_run( (int) $id ); }
} );
add_filter( 'cron_schedules', function ( $schedules ) { $schedules['ff90_every_five_minutes'] = array( 'interval' => 300, 'display' => 'FF90 every five minutes' ); return $schedules; } );
add_action( 'init', function () {
    if ( get_option( 'ff90_automation_worker_enabled', false ) ) { if ( ! wp_next_scheduled( 'ff90_automation_tick' ) ) { wp_schedule_event( time() + 300, 'ff90_every_five_minutes', 'ff90_automation_tick' ); } }
    else { wp_clear_scheduled_hook( 'ff90_automation_tick' ); }
} );
add_action( 'rest_api_init', function () {
    register_rest_route( 'ff90-automation/v1', '/jobs', array( 'methods' => 'POST', 'permission_callback' => function () { return current_user_can( 'edit_posts' ); }, 'args' => array( 'key' => array( 'type' => 'string', 'required' => true, 'maxLength' => 100 ), 'task' => array( 'type' => 'string', 'enum' => array( 'content_qa', 'football_sync', 'handoff' ), 'required' => true ), 'payload' => array( 'type' => 'object', 'required' => true ) ), 'callback' => function ( $r ) { return ff90_automation_enqueue( $r['key'], $r['task'], $r['payload'] ); } ) );
    register_rest_route( 'ff90-automation/v1', '/jobs/(?P<id>\d+)', array( 'methods' => 'GET', 'permission_callback' => function ( $r ) { $j = ff90_automation_get( (int) $r['id'] ); return $j && ( current_user_can( 'manage_options' ) || ( get_current_user_id() === (int) $j['actor_id'] && current_user_can( 'edit_post', (int) $j['object_id'] ) ) ); }, 'callback' => function ( $r ) { return ff90_automation_summary( ff90_automation_get( (int) $r['id'] ) ); } ) );
} );
add_action( 'admin_init', function () { register_setting( 'ff90_automation', 'ff90_automation_worker_enabled', array( 'sanitize_callback' => 'rest_sanitize_boolean' ) ); } );
add_action( 'admin_menu', function () {
    add_options_page( 'Automation Inbox', 'FF90 Automation', 'manage_options', 'ff90-automation', function () {
        if ( ! current_user_can( 'manage_options' ) ) { return; } global $wpdb;
        echo '<div class="wrap"><h1>Automation Inbox / Recovery</h1><p>Authenticated WordPress REST inbox. Use native Application Password credentials over HTTPS. This worker never publishes news. Existing Hermes/n8n workflows are unchanged. A real cron runner is required for scheduled processing.</p><form method="post" action="options.php">'; settings_fields( 'ff90_automation' ); echo '<input type="hidden" name="ff90_automation_worker_enabled" value="0"><label><input type="checkbox" name="ff90_automation_worker_enabled" value="1" ' . checked( get_option( 'ff90_automation_worker_enabled', false ), true, false ) . '> Enable five-minute worker (default off)</label>'; submit_button(); echo '</form><table class="widefat"><caption>Latest 30 jobs</caption><thead><tr><th>ID</th><th>Task</th><th>State</th><th>Attempts</th><th>Error code</th></tr></thead><tbody>';
        foreach ( $wpdb->get_results( "SELECT id,task,state,attempts,error_code FROM {$wpdb->prefix}ff90_automation_jobs ORDER BY id DESC LIMIT 30", ARRAY_A ) as $job ) { echo '<tr>'; foreach ( $job as $value ) { echo '<td>' . esc_html( (string) $value ) . '</td>'; } echo '</tr>'; } echo '</tbody></table></div>';
    } );
} );

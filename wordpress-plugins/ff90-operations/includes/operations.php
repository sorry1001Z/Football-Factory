<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_ops_health() {
    if ( ! current_user_can( 'manage_options' ) ) { return new WP_Error( 'ops_forbidden', 'Administrator required.', array( 'status' => 403 ) ); }
    global $wpdb; return array( 'database' => '1' === (string) $wpdb->get_var( 'SELECT 1' ), 'cron_disabled' => defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON, 'worker_enabled' => (bool) get_option( 'ff90_automation_worker_enabled', false ), 'modules' => array( 'seo' => function_exists( 'ff90_seo_analyze' ), 'security' => function_exists( 'ff90_security_install' ), 'qa' => function_exists( 'ff90_qa_report' ), 'editorial' => function_exists( 'ff90_editorial_permits' ), 'football' => function_exists( 'ff90_football_get' ), 'images' => function_exists( 'ff90_image_select' ), 'automation' => function_exists( 'ff90_automation_enqueue' ), 'insights' => function_exists( 'ff90_insights_record_view' ) ), 'backup_directory_configured' => (bool) ( defined( 'FF90_BACKUP_DIR' ) ? FF90_BACKUP_DIR : getenv( 'FF90_BACKUP_DIR' ) ), 'backup_scope' => 'content_wxr_only', 'full_restore_verified' => false );
}
function ff90_ops_backup_directory() {
    $dir = defined( 'FF90_BACKUP_DIR' ) ? (string) FF90_BACKUP_DIR : (string) ( getenv( 'FF90_BACKUP_DIR' ) ?: '' );
    if ( ! $dir || ! path_is_absolute( $dir ) || false !== strpos( $dir, "\0" ) ) { return new WP_Error( 'ops_private_directory_required', 'Configure FF90_BACKUP_DIR as an absolute private directory outside all webroots.' ); }
    $parent = realpath( dirname( $dir ) ); $candidate = file_exists( $dir ) ? realpath( $dir ) : ( $parent ? $parent . DIRECTORY_SEPARATOR . basename( $dir ) : false );
    if ( ! $candidate ) { return new WP_Error( 'ops_directory_parent_missing', 'Private directory parent must exist.' ); }
    $roots = array( realpath( ABSPATH ), realpath( wp_get_upload_dir()['basedir'] ) );
    if ( ! empty( $_SERVER['DOCUMENT_ROOT'] ) ) { $roots[] = realpath( $_SERVER['DOCUMENT_ROOT'] ); }
    foreach ( array_filter( $roots ) as $root ) { if ( $candidate === $root || 0 === strpos( $candidate, rtrim( $root, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR ) ) { return new WP_Error( 'ops_public_directory_refused', 'Backups must be outside all document/upload roots.' ); } }
    if ( ! is_dir( $candidate ) && ! mkdir( $candidate, 0700 ) ) { return new WP_Error( 'ops_directory_unavailable', 'Unable to create private backup directory.' ); }
    if ( ! is_writable( $candidate ) || ! chmod( $candidate, 0700 ) ) { return new WP_Error( 'ops_directory_permissions', 'Private writable directory permissions required.' ); }
    return $candidate;
}
function ff90_ops_create_content_export() {
    if ( ! current_user_can( 'manage_options' ) || ! current_user_can( 'export' ) ) { return new WP_Error( 'ops_forbidden', 'Administrator export permission required.' ); }
    $dir = ff90_ops_backup_directory(); if ( is_wp_error( $dir ) ) { return $dir; }
    require_once ABSPATH . 'wp-admin/includes/export.php';
    $id = bin2hex( random_bytes( 16 ) ); $tmp = tempnam( $dir, 'pending-' );
    if ( ! $tmp || realpath( dirname( $tmp ) ) !== realpath( $dir ) ) { if ( $tmp ) { unlink( $tmp ); } return new WP_Error( 'ops_temp_unavailable', 'Cannot create private temporary export.' ); }
    chmod( $tmp, 0600 ); $stream = fopen( $tmp, 'wb' ); if ( ! $stream ) { unlink( $tmp ); return new WP_Error( 'ops_write_failed', 'Cannot open private export.' ); }
    $bytes = 0; $failed = false; $level = ob_get_level();
    ob_start( function ( $chunk ) use ( $stream, &$bytes, &$failed ) {
        $bytes += strlen( $chunk ); if ( $bytes > 100 * MB_IN_BYTES ) { $failed = true; return ''; }
        if ( ! $failed && fwrite( $stream, $chunk ) !== strlen( $chunk ) ) { $failed = true; } return '';
    }, 65536 );
    try { export_wp( array( 'content' => 'all' ) ); ob_end_flush(); }
    catch ( Throwable $e ) { $failed = true; }
    finally { while ( ob_get_level() > $level ) { ob_end_clean(); } fclose( $stream ); }
    if ( $failed || ! filesize( $tmp ) ) { unlink( $tmp ); return new WP_Error( 'ops_export_failed', 'Content export failed or exceeded 100 MB safe request limit.' ); }
    $file = $dir . DIRECTORY_SEPARATOR . 'ff90-content-' . $id . '.xml';
    if ( ! rename( $tmp, $file ) ) { unlink( $tmp ); return new WP_Error( 'ops_write_failed', 'Unable to finalize content export.' ); }
    $manifest = array( 'id' => $id, 'scope' => 'content_wxr_only', 'created_at' => gmdate( 'c' ), 'bytes' => filesize( $file ), 'sha256' => hash_file( 'sha256', $file ), 'media_files_included' => false, 'full_database_account_tables_included' => false, 'restore_verified' => false );
    $json = wp_json_encode( $manifest );
    if ( file_put_contents( $file . '.json', $json, LOCK_EX ) !== strlen( $json ) || ! chmod( $file . '.json', 0600 ) ) { unlink( $file ); if ( file_exists( $file . '.json' ) ) { unlink( $file . '.json' ); } return new WP_Error( 'ops_manifest_failed', 'Export checksum manifest could not be stored safely.' ); }
    do_action( 'ff90_audit_event', 'ops_content_export_created' ); return $manifest;
}
function ff90_ops_verify_export( $id ) {
    if ( ! current_user_can( 'manage_options' ) || ! is_string( $id ) || ! preg_match( '/^[a-f0-9]{32}$/D', $id ) ) { return new WP_Error( 'ops_forbidden', 'Invalid export or permission.' ); }
    $dir = ff90_ops_backup_directory(); if ( is_wp_error( $dir ) ) { return $dir; }
    $file = $dir . DIRECTORY_SEPARATOR . 'ff90-content-' . $id . '.xml';
    if ( is_link( $file ) || is_link( $file . '.json' ) || ! is_file( $file ) || ! is_file( $file . '.json' ) ) { return new WP_Error( 'ops_export_missing', 'Export not found.' ); }
    $manifest = json_decode( file_get_contents( $file . '.json' ), true );
    if ( ! is_array( $manifest ) || ! isset( $manifest['sha256'], $manifest['bytes'] ) || ! hash_equals( $manifest['sha256'], hash_file( 'sha256', $file ) ) || (int) $manifest['bytes'] !== filesize( $file ) ) { return new WP_Error( 'ops_checksum_failed', 'Export checksum verification failed.' ); }
    $manifest['checksum_valid'] = true; return $manifest;
}
add_action( 'rest_api_init', function () { register_rest_route( 'ff90-operations/v1', '/health', array( 'methods' => 'GET', 'permission_callback' => function () { return current_user_can( 'manage_options' ); }, 'callback' => 'ff90_ops_health' ) ); } );
add_action( 'admin_post_ff90_ops_export', function () {
    if ( 'POST' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) || ! current_user_can( 'manage_options' ) ) { wp_die( 'Forbidden', '', array( 'response' => 403 ) ); } check_admin_referer( 'ff90_ops_export' );
    $r = ff90_ops_create_content_export(); if ( is_wp_error( $r ) ) { wp_die( esc_html( $r->get_error_message() ), '', array( 'response' => 400 ) ); }
    wp_safe_redirect( admin_url( 'options-general.php?page=ff90-operations&export=' . $r['id'] ) ); exit;
} );
add_action( 'admin_post_ff90_ops_download', function () {
    if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Forbidden', '', array( 'response' => 403 ) ); }
    $id = isset( $_GET['id'] ) && is_string( $_GET['id'] ) ? sanitize_key( $_GET['id'] ) : ''; check_admin_referer( 'ff90_ops_download_' . $id ); $r = ff90_ops_verify_export( $id );
    if ( is_wp_error( $r ) ) { wp_die( esc_html( $r->get_error_message() ), '', array( 'response' => 400 ) ); }
    $dir = ff90_ops_backup_directory(); nocache_headers(); header( 'Content-Type: application/xml; charset=UTF-8' ); header( 'Content-Disposition: attachment; filename="ff90-content-' . $id . '.xml"' ); readfile( $dir . DIRECTORY_SEPARATOR . 'ff90-content-' . $id . '.xml' ); exit;
} );
add_action( 'admin_menu', function () {
    add_options_page( 'Operations', 'FF90 Operations', 'manage_options', 'ff90-operations', function () {
        if ( ! current_user_can( 'manage_options' ) ) { return; }
        echo '<div class="wrap"><h1>Operations / Content Export</h1><pre>' . esc_html( wp_json_encode( ff90_ops_health(), JSON_PRETTY_PRINT ) ) . '</pre><p>Content WXR only: does not include media file bytes, full database/account tables, options or server configuration. Full backup/restore and external monitoring need the hosting/storage adapter. Configure FF90_BACKUP_DIR outside every webroot. No public backup URL.</p><form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="ff90_ops_export">'; wp_nonce_field( 'ff90_ops_export' ); submit_button( 'Create private content export' ); echo '</form>';
        if ( isset( $_GET['export'] ) && is_string( $_GET['export'] ) ) { $id = sanitize_key( $_GET['export'] ); $r = ff90_ops_verify_export( $id ); if ( ! is_wp_error( $r ) ) { echo '<p>Checksum verified. <a href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=ff90_ops_download&id=' . $id ), 'ff90_ops_download_' . $id ) ) . '">Download content export</a></p>'; } } echo '</div>';
    } );
} );

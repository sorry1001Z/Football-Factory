<?php
/** Destructive fixtures only inside the explicitly marked disposable local WP sandbox. */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI || ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX ) { throw new RuntimeException( 'Disposable sandbox required.' ); }
if ( ff90_football_token() || defined( 'FF90_BACKUP_DIR' ) || getenv( 'FF90_BACKUP_DIR' ) ) { throw new RuntimeException( 'Refusing to override real provider or private backup configuration.' ); }
define( 'FF90_FOOTBALL_DATA_TOKEN', 'synthetic-qa-provider-token-not-real' );
define( 'FF90_BACKUP_DIR', '/workspace/ff90-tools/qa-content-backup-' . wp_generate_uuid4() );
require_once ABSPATH . 'wp-admin/includes/image.php'; require_once ABSPATH . 'wp-admin/includes/user.php';
global $wpdb;
ob_start(); // Native export_wp must run before output is sent, as on admin-post.
$checks = 0; $created_terms = array(); $posts = array(); $users = array(); $attachments = array(); $jobs = array(); $cachekeys = array(); $backup_files = array();
$settings = array(); foreach ( array( 'ff90_editorial_options', 'ff90_football_options', 'ff90_automation_worker_enabled', 'ff90_seo_settings' ) as $key ) { $settings[ $key ] = get_option( $key, null ); }
$original_user = get_current_user_id(); $audit_start = (int) $wpdb->get_var( "SELECT COALESCE(MAX(id),0) FROM {$wpdb->prefix}ff90_security_audit" );
$old_quota = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}ff90_football_quota WHERE provider='football-data.org' AND quota_day=%s", gmdate( 'Y-m-d' ) ), ARRAY_A );
$assert = function ( $yes, $message ) use ( &$checks ) { if ( ! $yes ) { throw new RuntimeException( $message ); } ++$checks; echo 'PASS: ' . $message . "\n"; };
$make_post = function ( $author, $extra = array() ) use ( &$posts ) { $id = wp_insert_post( array_merge( array( 'post_type' => 'post', 'post_status' => 'draft', 'post_author' => $author, 'post_title' => 'QA — ข่าวทดสอบโมดูล ไม่ใช่ข่าวจริง', 'post_content' => '<p>Disposable module integration content for local tests.</p>' ), $extra ), true ); if ( is_wp_error( $id ) ) { throw new RuntimeException( $id->get_error_message() ); } $posts[] = $id; return $id; };
$make_image = function ( $color, $width = 12, $height = 8 ) use ( &$attachments ) { $im = imagecreatetruecolor( $width, $height ); imagefill( $im, 0, 0, $color ); ob_start(); imagepng( $im ); $bytes = ob_get_clean(); imagedestroy( $im ); $upload = wp_upload_bits( 'qa-module-' . wp_generate_uuid4() . '.png', null, $bytes ); $id = wp_insert_attachment( array( 'post_mime_type' => 'image/png', 'post_title' => 'Original generated QA image', 'post_status' => 'inherit' ), $upload['file'] ); wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $upload['file'] ) ); $attachments[] = $id; return $id; };
$http_calls = 0; $http_mode = 'normal'; $selected_date = wp_date( 'Y-m-d' );
$football_http = function ( $pre, $args, $url ) use ( &$http_calls, &$http_mode, &$selected_date ) {
    if ( 0 !== strpos( $url, 'https://api.football-data.org/' ) ) { return $pre; } ++$http_calls;
    if ( 'network' === $http_mode ) { return new WP_Error( 'synthetic_network', 'Provider fixture unavailable; sensitive-token-value' ); }
    $code = 'rate' === $http_mode ? 429 : ( 'denied' === $http_mode ? 403 : 200 );
    $when = ( new DateTimeImmutable( $selected_date . ' 12:00:00', wp_timezone() ) )->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'Y-m-d\TH:i:s\Z' );
    $other = ( new DateTimeImmutable( $selected_date . ' 12:00:00', wp_timezone() ) )->modify( '+2 days' )->setTimezone( new DateTimeZone( 'UTC' ) )->format( 'Y-m-d\TH:i:s\Z' );
    $match = array( 'id' => 987654, 'utcDate' => $when, 'status' => 'TIMED', 'homeTeam' => array( 'name' => 'Synthetic Home <script>alert(1)</script>' ), 'awayTeam' => array( 'name' => 'Synthetic Away' ), 'score' => array( 'fullTime' => array( 'home' => null, 'away' => null ) ) );
    $raw = false !== strpos( $url, '/standings' ) ? array( 'standings' => array( array( 'type' => 'TOTAL', 'stage' => 'REGULAR_SEASON', 'table' => array( array( 'team' => array( 'name' => 'Synthetic Home' ), 'position' => 1, 'playedGames' => 2, 'won' => 1, 'draw' => 1, 'lost' => 0, 'goalsFor' => 3, 'goalsAgainst' => 1, 'goalDifference' => 2, 'points' => 4 ) ) ) ) ) : array( 'matches' => array( $match, array_merge( $match, array( 'id' => 987655, 'utcDate' => $other ) ) ) );
    if ( 'invalid' === $http_mode ) { $raw = array( 'unexpected' => 'invalid fixture' ); }
    return array( 'headers' => array(), 'body' => wp_json_encode( $raw ), 'response' => array( 'code' => $code, 'message' => 'Synthetic provider fixture' ), 'cookies' => array() );
};
add_filter( 'pre_http_request', $football_http, 10, 3 );
try {
    update_option( 'ff90_editorial_options', array( 'enforce' => false, 'paused' => false ) ); update_option( 'ff90_football_options', array( 'enabled' => false, 'competition' => 'PL' ) ); update_option( 'ff90_seo_settings', array( 'owner' => 'advisory', 'gate' => false, 'title_h1' => true ) );
    foreach ( array( 'author', 'editor' ) as $role ) { $id = wp_insert_user( array( 'user_login' => 'module-qa-' . $role . '-' . wp_generate_uuid4(), 'user_pass' => wp_generate_password( 32 ), 'role' => $role, 'user_email' => 'qa-' . wp_generate_uuid4() . '@example.invalid' ) ); if ( is_wp_error( $id ) ) { throw new RuntimeException( $id->get_error_message() ); } $users[ $role ] = $id; }
    $admin = get_users( array( 'role' => 'administrator', 'number' => 1 ) )[0]->ID;
    wp_set_current_user( $users['author'] ); $story = $make_post( $users['author'] );
    $assert( in_array( 'missing_sources', ff90_qa_report( $story )['errors'], true ), 'QA refuses an article without declared sources' );
    $assert( is_wp_error( ff90_qa_verify( $story, ff90_qa_fingerprint( $story ), true, true ) ), 'author cannot self-verify facts and rights' );
    $r = new WP_REST_Request( 'POST', '/wp/v2/posts/' . $story ); $r->set_param( 'meta', array( '_ff90_qa_sources' => array( 'https://example.org/qa-source' ) ) );
    $assert( 200 === rest_do_request( $r )->get_status(), 'native authorized REST can declare source URLs without human approval privileges' );
    wp_set_current_user( $users['editor'] ); $hash = ff90_qa_fingerprint( $story );
    $assert( ! is_wp_error( ff90_qa_verify( $story, $hash, true, true, 'Synthetic QA human attestation' ) ), 'independent editor records saved-version fact/rights attestation' );
    $assert( ! is_wp_error( ff90_editorial_decide( $story, 'approved', $hash ) ) && ff90_editorial_permits( $story ), 'editorial approval binds to reviewed content fingerprint' );
    update_option( 'ff90_editorial_options', array( 'enforce' => true, 'paused' => false ) );
    wp_set_current_user( $users['author'] ); $assert( ! is_wp_error( ff90_editorial_publish( $story ) ) && 'publish' === get_post_status( $story ), 'approved version publishes through the explicit publishing helper' );
    wp_update_post( array( 'ID' => $story, 'post_title' => 'Changed saved title requiring a new human review' ) );
    $assert( 'pending' === get_post_status( $story ) && ! ff90_editorial_permits( $story ), 'content change holds publication and invalidates prior approval' );
    wp_set_current_user( $users['editor'] ); $assert( is_wp_error( ff90_editorial_decide( $story, 'approved', $hash ) ), 'stale review form cannot approve a newer version' );
    $hash = ff90_qa_fingerprint( $story ); ff90_qa_verify( $story, $hash, true, true ); ff90_editorial_decide( $story, 'approved', $hash );
    update_option( 'ff90_editorial_options', array( 'enforce' => true, 'paused' => true ) ); $assert( is_wp_error( ff90_editorial_publish( $story ) ), 'publication pause vetoes even approved stories' );
    update_option( 'ff90_editorial_options', array( 'enforce' => true, 'paused' => false ) );
    $r = new WP_REST_Request( 'POST', '/wp/v2/posts/' . $story ); $r->set_param( 'status', 'publish' ); $r->set_param( 'content', '<p>New unreviewed REST content</p>' );
    $assert( 409 === rest_do_request( $r )->get_status() && 'pending' === get_post_status( $story ), 'REST changed-version publish denied before publication' );
    $r = new WP_REST_Request( 'POST', '/wp/v2/posts/' . $story ); $r->set_param( 'status', 'publish' ); $r->set_param( 'meta', array( '_ff90_qa_sources' => array( 'https://example.org/changed-source' ) ) );
    $assert( 409 === rest_do_request( $r )->get_status(), 'REST source mutation is checked in final proposed snapshot' );
    $r = new WP_REST_Request( 'POST', '/wp/v2/posts/' . $story ); $r->set_param( 'status', 'publish' ); $assert( 200 === rest_do_request( $r )->get_status(), 'ordinary REST can publish unchanged approved snapshot' );
    wp_set_current_user( 0 ); $public_post = rest_do_request( new WP_REST_Request( 'GET', '/wp/v2/posts/' . $story ) );
    $assert( 200 === $public_post->get_status() && ! isset( $public_post->get_data()['meta']['_ff90_qa_sources'] ), 'source declarations are edit-context only, not leaked by public native REST' ); wp_set_current_user( $users['editor'] );
    $old_post = $_POST;
    $_POST = array( 'ff90_qa_nonce' => wp_create_nonce( 'ff90_qa_' . $story ), 'ff90_qa_sources' => 'https://example.org/classic-source-change' );
    $classic_published = 0; $classic_watch = function ( $new, $old, $post ) use ( $story, &$classic_published ) { if ( $story === $post->ID && 'publish' === $new ) { ++$classic_published; } }; add_action( 'transition_post_status', $classic_watch, 999, 3 );
    wp_update_post( array( 'ID' => $story, 'post_status' => 'publish' ) ); remove_action( 'transition_post_status', $classic_watch, 999 ); $_POST = $old_post;
    $assert( 'pending' === get_post_status( $story ) && 0 === $classic_published, 'Classic source edit is checked before publication hooks, not only after metadata save' );
    $hash = ff90_qa_fingerprint( $story ); ff90_qa_verify( $story, $hash, true, true ); ff90_editorial_decide( $story, 'approved', $hash );
    $future = gmdate( 'Y-m-d H:i:s', time() + 3600 );
    wp_update_post( array( 'ID' => $story, 'post_status' => 'future', 'post_date_gmt' => $future, 'post_date' => get_date_from_gmt( $future ) ) );
    $assert( 'future' === get_post_status( $story ), 'current approved story can be scheduled normally' );
    $due = gmdate( 'Y-m-d H:i:s', time() - 60 );
    $wpdb->update( $wpdb->posts, array( 'post_content' => '<p>Changed fixture before scheduled publication</p>', 'post_date_gmt' => $due, 'post_date' => get_date_from_gmt( $due ) ), array( 'ID' => $story ) ); clean_post_cache( $story );
    $published_events = 0; $watch = function ( $new, $old, $post ) use ( $story, &$published_events ) { if ( $story === $post->ID && 'publish' === $new ) { ++$published_events; } }; add_action( 'transition_post_status', $watch, 999, 3 );
    do_action( 'publish_future_post', $story ); remove_action( 'transition_post_status', $watch, 999 );
    $assert( 'pending' === get_post_status( $story ) && 0 === $published_events, 'scheduled changed version held before any native publication event' );
    $hash = ff90_qa_fingerprint( $story ); ff90_qa_verify( $story, $hash, true, true ); ff90_editorial_decide( $story, 'approved', $hash ); ff90_editorial_publish( $story );
    $image1 = $make_image( 0x123456 ); $image2 = $make_image( 0x123456 ); $image3 = $make_image( 0x654321 ); $near_image = $make_image( 0x123456, 24, 16 );
    $assert( ff90_image_digest( $image1 ) === ff90_image_digest( $image2 ) && ff90_image_digest( $image1 ) !== ff90_image_digest( $image3 ), 'exact binary duplicates match across distinct attachment IDs' );
    $assert( ff90_image_digest( $image1 ) !== ff90_image_digest( $near_image ) && ff90_image_visual_similar( ff90_image_visual_hash( $image1 ), ff90_image_visual_hash( $near_image ) ), 'resized same visual has different bytes but matching advisory perceptual fingerprint' );
    set_post_thumbnail( $story, $image1 ); $assert( 'pending' === get_post_status( $story ) && ! ff90_qa_report( $story )['human_review_current'], 'Featured Image change invalidates QA and approval' );
    $assert( in_array( 'image_rights_unverified_or_changed', ff90_qa_structure( $story ), true ), 'image rights module feeds structural QA gate' );
    $rights = array( 'license_url' => 'https://example.org/qa-license', 'credit' => 'Original generated QA fixture', 'confirmed' => true, 'expires' => '' );
    foreach ( $attachments as $image ) { $assert( ! is_wp_error( ff90_image_declare( $image, $rights ) ), 'reviewer declares exact image bytes and source rights' ); }
    $assert( ff90_image_eligible( $image1, $story ), 'unused rights-declared image eligible' );
    $other = $make_post( $users['author'] );
    $assert( true === ff90_image_reserve( $image1, $story ), 'image reservation granted to permitted article' );
    $assert( is_wp_error( ff90_image_reserve( $image2, $other ) ), 'same image bytes cannot be concurrently leased by another article' );
    ff90_image_record_use( $image1, $story );
    $assert( ! ff90_image_eligible( $image2, $other ) && $image3 === ff90_image_select( array( $image2, $image3 ), $other ), 'recent-use history excludes duplicate asset and selects unused candidate' );
    $assert( ! ff90_image_eligible( $near_image, $other ), 'perceptual comparison rejects a resized variant used by recent news' );
    $assert( ff90_image_rights( $image1, strtotime( '2100-01-01' ) ), 'unlimited explicit rights have no invented expiry' );
    $expired = array_merge( $rights, array( 'expires' => '2000-01-01' ) ); ff90_image_declare( $image3, $expired ); $assert( ! ff90_image_rights( $image3 ), 'expired human image rights excluded' ); ff90_image_declare( $image3, $rights );
    update_option( 'ff90_editorial_options', array( 'enforce' => false, 'paused' => false ) ); wp_update_post( array( 'ID' => $story, 'post_status' => 'publish' ) );
    $preview = get_category_by_slug( 'preview' );
    if ( ! $preview ) { $term = wp_insert_term( 'QA Preview', 'category', array( 'slug' => 'preview' ) ); $created_terms[] = $term['term_id']; $preview = get_category( $term['term_id'] ); }
    wp_set_post_categories( $story, array( $preview->term_id ) );
    $assert( '' === get_post_meta( $story, '_ff90_banner_kind', true ) && 'preview' === ff90_banner_renderer_post_kind( $story ), 'unset renderer meta preserves native category banner fallback' );
    if ( function_exists( 'ff90_banner_kind' ) ) { $assert( 'preview' === ff90_banner_kind( $story ), 'existing FF90 theme category classification remains compatible' ); }
    foreach ( ff90_banner_renderer_kinds() as $kind ) { $html = ff90_banner_renderer_render( $story, $kind ); $assert( false !== strpos( $html, 'banner-kind-' . $kind ) && false !== strpos( $html, 'object-fit:contain' ) && false !== strpos( $html, 'height:auto' ), 'uncropped independent banner kind: ' . $kind ); }
    wp_update_post( array( 'ID' => $story, 'post_status' => 'draft' ) ); $assert( '' === ff90_banner_renderer_render( $story ), 'banner does not expose unpublished content' );
    wp_set_current_user( $admin );
    $assert( is_wp_error( ff90_football_get( 'matches', 'PL', $selected_date ) ) && 0 === $http_calls, 'disabled football provider makes no upstream request' );
    $assert( is_wp_error( ff90_football_get( 'standings', 'PL', '2000-01-01' ) ), 'current standings adapter refuses misleading historical date requests' );
    update_option( 'ff90_football_options', array( 'enabled' => true, 'competition' => 'PL' ) );
    foreach ( array( 'matches', 'standings' ) as $kind ) { $key = ff90_football_cache_key( $kind, 'PL', $selected_date ); $cachekeys[] = $key; delete_transient( $key ); delete_transient( $key . '_last' ); }
    $matches = ff90_football_get( 'matches', 'PL', $selected_date ); $assert( ! is_wp_error( $matches ) && 1 === count( $matches['data'] ) && ! $matches['stale'], 'provider fixture normalized and filtered to selected site-local day' );
    $assert( null === $matches['data'][0]['score']['home'], 'unknown source score stays null rather than fabricated zero' );
    $before = $http_calls; ff90_football_get( 'matches', 'PL', $selected_date ); $assert( $before === $http_calls, 'fresh football cache prevents redundant provider requests' );
    $table = ff90_football_render( 'standings', array( 'competition' => 'PL', 'date' => $selected_date ) ); $assert( (bool) preg_match( '/<caption\b/', $table ) && false !== strpos( $table, 'scope="row"' ) && false !== strpos( $table, 'overflow-x:auto' ), 'standings renderer uses caption, row headers and narrow-screen scroll' );
    $html = ff90_football_render( 'fixtures', array( 'competition' => 'PL', 'date' => $selected_date ) ); $assert( false === strpos( $html, '<script>' ) && false !== strpos( $html, 'football-data.org' ), 'football output escapes provider text and labels source' );
    $key = ff90_football_cache_key( 'matches', 'PL', $selected_date ); delete_transient( $key ); $http_mode = 'network'; $stale = ff90_football_get( 'matches', 'PL', $selected_date );
    $assert( is_array( $stale ) && $stale['stale'] && 'football_network' === $stale['error_code'], 'upstream failure returns labelled previous source data as stale' );
    delete_transient( $key . '_last' ); $assert( is_wp_error( ff90_football_get( 'matches', 'PL', $selected_date ) ), 'upstream failure without history is an error, no fabricated fallback' );
    $before = $http_calls; $assert( is_wp_error( ff90_football_get( 'matches', '../bad', $selected_date ) ) && $before === $http_calls, 'untrusted competition cannot alter request destination' );
    $http_mode = 'rate'; $assert( is_wp_error( ff90_football_get( 'matches', 'PL', $selected_date ) ), 'rate limit returns explicit provider error' ); $before = $http_calls; ff90_football_get( 'matches', 'PL', $selected_date ); $assert( $before === $http_calls, 'provider 429 activates local request backoff' ); delete_transient( 'ff90_fd_backoff' ); $http_mode = 'normal';
    $http_mode = 'invalid'; $assert( is_wp_error( ff90_football_get( 'matches', 'PL', $selected_date ) ), 'malformed provider response cannot become a successful empty scoreboard' ); $http_mode = 'normal';
    $quota_before_limit = (int) $wpdb->get_var( $wpdb->prepare( "SELECT requests FROM {$wpdb->prefix}ff90_football_quota WHERE provider='football-data.org' AND quota_day=%s", gmdate( 'Y-m-d' ) ) );
    $wpdb->update( $wpdb->prefix . 'ff90_football_quota', array( 'requests' => 100 ), array( 'provider' => 'football-data.org', 'quota_day' => gmdate( 'Y-m-d' ) ) );
    $before = $http_calls; $quota_error = ff90_football_get( 'matches', 'PL', $selected_date );
    $assert( is_wp_error( $quota_error ) && 'football_quota_exceeded' === $quota_error->get_error_code() && $before === $http_calls, 'daily quota is enforced atomically before network' );
    $wpdb->update( $wpdb->prefix . 'ff90_football_quota', array( 'requests' => $quota_before_limit ), array( 'provider' => 'football-data.org', 'quota_day' => gmdate( 'Y-m-d' ) ) );
    $job = ff90_automation_enqueue( 'qa-' . wp_generate_uuid4(), 'content_qa', array( 'post_id' => $story ) ); $jobs[] = $job['id']; $assert( 'queued' === $job['state'], 'authenticated automation request persisted in inbox' );
    $stored = ff90_automation_get( $job['id'] ); $same = ff90_automation_enqueue( $stored['job_key'], 'content_qa', array( 'post_id' => $story ) );
    $assert( $same['id'] === $job['id'], 'idempotency key returns same job without duplicating work' );
    $assert( is_wp_error( ff90_automation_enqueue( $stored['job_key'], 'handoff', array( 'post_id' => $story ) ) ), 'same idempotency key cannot be reused with another payload/task' );
    $run = ff90_automation_run( $job['id'] ); $assert( 'waiting_review' === $run['state'] && 'draft' === get_post_status( $story ), 'automation QA stops at human-review boundary without publishing' );
    $handoff = ff90_automation_enqueue( 'qa-' . wp_generate_uuid4(), 'handoff', array( 'post_id' => $story ) ); $jobs[] = $handoff['id']; $assert( 'blocked' === ff90_automation_run( $handoff['id'] )['state'], 'unconnected Hermes/n8n handoff is blocked, not fake success' );
    $retry = ff90_automation_enqueue( 'qa-' . wp_generate_uuid4(), 'content_qa', array( 'post_id' => $story ) ); $jobs[] = $retry['id'];
    $retry_handler = function ( $handlers ) { $handlers['content_qa'] = function () { return new WP_Error( 'automation_transient', 'Synthetic transient test.' ); }; return $handlers; }; add_filter( 'ff90_automation_handlers', $retry_handler );
    for ( $i = 1; $i <= 3; ++$i ) { $wpdb->update( $wpdb->prefix . 'ff90_automation_jobs', array( 'available_at' => time() - 1 ), array( 'id' => $retry['id'] ) ); $run = ff90_automation_run( $retry['id'] ); $assert( ( $i < 3 ? 'retry' : 'failed' ) === $run['state'] && $i === (int) $run['attempts'], 'transient task bounded retry attempt ' . $i ); } remove_filter( 'ff90_automation_handlers', $retry_handler );
    $recover = ff90_automation_enqueue( 'qa-' . wp_generate_uuid4(), 'content_qa', array( 'post_id' => $story ) ); $jobs[] = $recover['id']; $wpdb->update( $wpdb->prefix . 'ff90_automation_jobs', array( 'state' => 'running', 'attempts' => 1, 'locked_until' => time() - 1, 'lease_token' => 'expired-worker' ), array( 'id' => $recover['id'] ) ); ff90_automation_recover();
    $assert( 'retry' === ff90_automation_get( $recover['id'] )['state'], 'expired worker lease is recoverable without duplicate active claim' );
    $lease = ff90_automation_enqueue( 'qa-' . wp_generate_uuid4(), 'content_qa', array( 'post_id' => $story ) ); $jobs[] = $lease['id'];
    $lost_handler = function ( $handlers ) use ( $lease ) { $handlers['content_qa'] = function () use ( $lease ) { global $wpdb; $wpdb->update( $wpdb->prefix . 'ff90_automation_jobs', array( 'lease_token' => 'different-worker' ), array( 'id' => $lease['id'] ) ); return array(); }; return $handlers; }; add_filter( 'ff90_automation_handlers', $lost_handler );
    $lost = ff90_automation_run( $lease['id'] ); remove_filter( 'ff90_automation_handlers', $lost_handler );
    $assert( is_wp_error( $lost ) && 'automation_lease_lost' === $lost->get_error_code() && 'running' === ff90_automation_get( $lease['id'] )['state'], 'old worker cannot commit a result after losing its lease token' );
    wp_set_current_user( 0 ); $r = new WP_REST_Request( 'POST', '/ff90-automation/v1/jobs' ); $r->set_param( 'key', 'anonymous-key' ); $r->set_param( 'task', 'content_qa' ); $r->set_param( 'payload', array( 'post_id' => $story ) ); $assert( 401 === rest_do_request( $r )->get_status(), 'anonymous job enqueue denied' );
    $assert( 401 === rest_do_request( new WP_REST_Request( 'GET', '/ff90-operations/v1/health' ) )->get_status(), 'private health endpoint denies anonymous clients' );
    $assert( 401 === rest_do_request( new WP_REST_Request( 'GET', '/ff90-security/v1/audit' ) )->get_status(), 'private audit endpoint denies anonymous clients' );
    wp_set_current_user( $admin ); $assert( ff90_ops_health()['database'] && false === ff90_ops_health()['full_restore_verified'], 'operations reports actual DB health and does not claim full restore' );
    $manifest = ff90_ops_create_content_export(); $assert( ! is_wp_error( $manifest ) && ! $manifest['media_files_included'] && ! $manifest['restore_verified'], 'private export explicitly covers WXR content only' );
    $file = FF90_BACKUP_DIR . '/ff90-content-' . $manifest['id'] . '.xml'; $backup_files = array( $file, $file . '.json' );
    $assert( ff90_ops_verify_export( $manifest['id'] )['checksum_valid'], 'stored private content export checksum verifies' );
    $xml = new DOMDocument(); $assert( $xml->load( $file, LIBXML_NONET ), 'native content export is valid WXR XML' );
    $assert( 0600 === ( fileperms( $file ) & 0777 ) && 0700 === ( fileperms( FF90_BACKUP_DIR ) & 0777 ), 'content export permissions restrict directory and file access' );
    file_put_contents( $file, 'corruption', FILE_APPEND ); $assert( is_wp_error( ff90_ops_verify_export( $manifest['id'] ) ), 'corrupted export rejected by checksum verification' );
    $assert( is_wp_error( ff90_ops_verify_export( '../../wp-config.php' ) ), 'export selector rejects path traversal' );
    $login = get_user_by( 'id', $users['author'] )->user_login; $_SERVER['REMOTE_ADDR'] = '192.0.2.55';
    for ( $i = 0; $i < 5; ++$i ) { wp_authenticate( $login, 'synthetic-incorrect-password' ); }
    $error = wp_authenticate( $login, 'another-incorrect-password' ); $assert( is_wp_error( $error ) && 'ff90_login_throttled' === $error->get_error_code(), 'five failed native logins throttle the IP/login pair' );
    $b = ff90_security_bucket( $login ); $assert( strlen( $b[0] ) === 64 && false === strpos( $b[0], '192.0.2.55' ), 'login bucket stores salted hash instead of raw IP/login' );
    $wpdb->delete( $wpdb->prefix . 'ff90_login_buckets', array( 'bucket_key' => $b[0] ) );
    $assert( $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}ff90_security_audit WHERE id>%d", $audit_start ) ) > 0, 'module operations leave minimal private audit records' );
    echo "TOTAL: $checks module contracts passed; provider HTTP is DOUBLED, no live data claim\n";
} finally {
    if ( ob_get_level() ) { ob_end_flush(); }
    remove_filter( 'pre_http_request', $football_http, 10 ); if ( isset( $retry_handler ) ) { remove_filter( 'ff90_automation_handlers', $retry_handler ); }
    update_option( 'ff90_editorial_options', array( 'enforce' => false, 'paused' => false ) );
    foreach ( $jobs as $id ) { $wpdb->delete( $wpdb->prefix . 'ff90_automation_jobs', array( 'id' => $id ) ); }
    foreach ( $posts as $id ) { $wpdb->delete( $wpdb->prefix . 'ff90_image_uses', array( 'post_id' => $id ) ); $wpdb->delete( $wpdb->prefix . 'ff90_image_leases', array( 'post_id' => $id ) ); wp_delete_post( $id, true ); }
    foreach ( $attachments as $id ) { wp_delete_attachment( $id, true ); }
    foreach ( $created_terms as $id ) { wp_delete_term( $id, 'category' ); }
    foreach ( $users as $id ) { wp_delete_user( $id ); }
    foreach ( $cachekeys as $key ) { delete_transient( $key ); delete_transient( $key . '_last' ); delete_option( $key . '_lock' ); } delete_transient( 'ff90_fd_backoff' );
    $wpdb->delete( $wpdb->prefix . 'ff90_football_quota', array( 'provider' => 'football-data.org', 'quota_day' => gmdate( 'Y-m-d' ) ) ); if ( $old_quota ) { $wpdb->insert( $wpdb->prefix . 'ff90_football_quota', $old_quota ); }
    $wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}ff90_security_audit WHERE id>%d", $audit_start ) );
    foreach ( $backup_files as $file ) { if ( file_exists( $file ) ) { unlink( $file ); } } if ( is_dir( FF90_BACKUP_DIR ) && ! glob( FF90_BACKUP_DIR . '/*' ) ) { rmdir( FF90_BACKUP_DIR ); }
    foreach ( $settings as $key => $value ) { if ( null === $value ) { delete_option( $key ); } else { update_option( $key, $value ); } } wp_set_current_user( $original_user );
}

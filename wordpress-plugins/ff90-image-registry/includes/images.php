<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_image_install() {
    global $wpdb; require_once ABSPATH . 'wp-admin/includes/upgrade.php'; $charset = $wpdb->get_charset_collate();
    dbDelta( "CREATE TABLE {$wpdb->prefix}ff90_image_uses (
        asset_hash varchar(64) NOT NULL,
        post_id bigint(20) unsigned NOT NULL,
        used_at datetime NOT NULL,
        visual_hash varchar(16) NOT NULL DEFAULT '',
        mean_rgb varchar(16) NOT NULL DEFAULT '',
        PRIMARY KEY  (asset_hash,post_id),
        KEY used_at (used_at)
    ) $charset;" );
    dbDelta( "CREATE TABLE {$wpdb->prefix}ff90_image_leases (
        asset_hash varchar(64) NOT NULL,
        post_id bigint(20) unsigned NOT NULL,
        expires_at bigint(20) unsigned NOT NULL,
        visual_hash varchar(16) NOT NULL DEFAULT '',
        mean_rgb varchar(16) NOT NULL DEFAULT '',
        PRIMARY KEY  (asset_hash)
    ) $charset;" );
}
function ff90_image_digest( $id ) {
    if ( ! wp_attachment_is_image( $id ) ) { return ''; }
    $file = get_attached_file( $id ); $root = realpath( wp_get_upload_dir()['basedir'] ); $path = is_string( $file ) ? realpath( $file ) : false;
    if ( ! $root || ! $path || 0 !== strpos( $path, $root . DIRECTORY_SEPARATOR ) || ! is_file( $path ) || ! is_readable( $path ) || filesize( $path ) > 40 * MB_IN_BYTES ) { return ''; }
    return hash_file( 'sha256', $path );
}
/** Advisory dHash + mean color. Exact matching remains available when GD/file limits disallow decoding. */
function ff90_image_visual_hash( $id ) {
    if ( ! function_exists( 'imagecreatefromstring' ) || ! ff90_image_digest( $id ) ) { return null; }
    $file = get_attached_file( $id ); $size = wp_getimagesize( $file );
    if ( ! $size || $size[0] * $size[1] > 8000000 || filesize( $file ) > 10 * MB_IN_BYTES ) { return null; }
    $image = @imagecreatefromstring( file_get_contents( $file ) ); if ( ! $image ) { return null; }
    $small = imagecreatetruecolor( 9, 8 ); imagecopyresampled( $small, $image, 0, 0, 0, 0, 9, 8, imagesx( $image ), imagesy( $image ) ); imagedestroy( $image );
    $bits = ''; $rgb = array( 0, 0, 0 );
    for ( $y = 0; $y < 8; ++$y ) {
        for ( $x = 0; $x < 9; ++$x ) {
            $color = imagecolorat( $small, $x, $y ); $r = ( $color >> 16 ) & 255; $g = ( $color >> 8 ) & 255; $b = $color & 255;
            $rgb[0] += $r; $rgb[1] += $g; $rgb[2] += $b;
            if ( $x < 8 ) { $next = imagecolorat( $small, $x + 1, $y ); $right = 0.299 * ( ( $next >> 16 ) & 255 ) + 0.587 * ( ( $next >> 8 ) & 255 ) + 0.114 * ( $next & 255 ); $bits .= 0.299 * $r + 0.587 * $g + 0.114 * $b > $right ? '1' : '0'; }
        }
    }
    imagedestroy( $small ); $hash = ''; for ( $i = 0; $i < 64; $i += 4 ) { $hash .= dechex( bindec( substr( $bits, $i, 4 ) ) ); }
    return array( 'visual_hash' => $hash, 'mean_rgb' => implode( ',', array_map( static function ( $v ) { return (int) round( $v / 72 ); }, $rgb ) ) );
}
function ff90_image_visual_similar( $a, $b ) {
    if ( ! is_array( $a ) || ! is_array( $b ) || ! preg_match( '/^[a-f0-9]{16}$/D', $a['visual_hash'] ?? '' ) || ! preg_match( '/^[a-f0-9]{16}$/D', $b['visual_hash'] ?? '' ) ) { return false; }
    $ca = array_map( 'intval', explode( ',', $a['mean_rgb'] ) ); $cb = array_map( 'intval', explode( ',', $b['mean_rgb'] ) ); if ( 3 !== count( $ca ) || 3 !== count( $cb ) ) { return false; }
    if ( abs( $ca[0] - $cb[0] ) + abs( $ca[1] - $cb[1] ) + abs( $ca[2] - $cb[2] ) > 75 ) { return false; }
    $ones = array( 0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4 ); $distance = 0;
    for ( $i = 0; $i < 16; ++$i ) { $distance += $ones[ hexdec( $a['visual_hash'][ $i ] ) ^ hexdec( $b['visual_hash'][ $i ] ) ]; }
    return $distance <= 6;
}
function ff90_image_rights( $id, $now = null ) {
    $r = get_post_meta( $id, '_ff90_image_rights', true ); $hash = ff90_image_digest( $id );
    if ( ! $hash || ! is_array( $r ) || empty( $r['reviewer'] ) || empty( $r['confirmed'] ) || empty( $r['credit'] ) || empty( $r['license_url'] ) || ! isset( $r['asset_hash'] ) || ! hash_equals( $hash, $r['asset_hash'] ) ) { return false; }
    if ( ! empty( $r['expires'] ) && $r['expires'] < wp_date( 'Y-m-d', null === $now ? time() : $now ) ) { return false; }
    return true;
}
function ff90_image_declare( $id, array $input ) {
    if ( ! current_user_can( 'edit_post', $id ) || ! current_user_can( 'edit_others_posts' ) || ! current_user_can( 'upload_files' ) ) { return new WP_Error( 'image_forbidden', 'Independent image reviewer permission required.' ); }
    $hash = ff90_image_digest( $id ); if ( ! $hash ) { return new WP_Error( 'image_invalid', 'Verified local image file required.' ); }
    $url = $input['license_url'] ?? ''; $p = is_string( $url ) ? wp_parse_url( $url ) : false;
    if ( ! is_string( $input['credit'] ?? '' ) || ! is_string( $input['expires'] ?? '' ) ) { return new WP_Error( 'image_rights_invalid', 'Text fields required.' ); }
    $expiry = $input['expires'] ?? ''; $d = $expiry ? DateTimeImmutable::createFromFormat( '!Y-m-d', $expiry, new DateTimeZone( 'UTC' ) ) : null;
    if ( ! $p || ! in_array( $p['scheme'] ?? '', array( 'http', 'https' ), true ) || empty( $p['host'] ) || isset( $p['user'] ) || isset( $p['pass'] ) || ! filter_var( $url, FILTER_VALIDATE_URL ) || empty( $input['credit'] ) || ( $expiry && ( ! $d || $d->format( 'Y-m-d' ) !== $expiry ) ) ) { return new WP_Error( 'image_rights_invalid', 'Valid license/source URL, credit and optional expiry date required.' ); }
    $record = array( 'confirmed' => ! empty( $input['confirmed'] ), 'asset_hash' => $hash, 'license_url' => esc_url_raw( $url ), 'credit' => sanitize_text_field( $input['credit'] ), 'expires' => $expiry, 'reviewer' => get_current_user_id(), 'at' => gmdate( 'c' ) );
    update_post_meta( $id, '_ff90_image_rights', $record ); do_action( 'ff90_audit_event', 'image_rights_declared', $id ); return $record;
}
function ff90_image_eligible( $id, $post_id = 0, $days = 7 ) {
    global $wpdb; if ( ! ff90_image_rights( $id ) ) { return false; } $hash = ff90_image_digest( $id );
    $used = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}ff90_image_uses WHERE asset_hash=%s AND post_id<>%d AND used_at >= %s", $hash, $post_id, gmdate( 'Y-m-d H:i:s', time() - max( 1, min( 365, (int) $days ) ) * DAY_IN_SECONDS ) ) );
    $leased = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}ff90_image_leases WHERE asset_hash=%s AND post_id<>%d AND expires_at > %d", $hash, $post_id, time() ) );
    if ( $used || $leased ) { return false; }
    $visual = ff90_image_visual_hash( $id );
    if ( $visual && apply_filters( 'ff90_image_visual_matching', true ) ) {
        $rows = $wpdb->get_results( $wpdb->prepare( "SELECT visual_hash,mean_rgb FROM {$wpdb->prefix}ff90_image_uses WHERE post_id<>%d AND used_at >= %s AND visual_hash<>'' UNION ALL SELECT visual_hash,mean_rgb FROM {$wpdb->prefix}ff90_image_leases WHERE post_id<>%d AND expires_at>%d AND visual_hash<>''", $post_id, gmdate( 'Y-m-d H:i:s', time() - max( 1, min( 365, (int) $days ) ) * DAY_IN_SECONDS ), $post_id, time() ), ARRAY_A );
        foreach ( $rows as $row ) { if ( ff90_image_visual_similar( $visual, $row ) ) { return false; } }
    }
    return true;
}
function ff90_image_select( array $ids, $post_id = 0, $days = 7 ) {
    foreach ( array_slice( array_unique( array_map( 'absint', $ids ) ), 0, 100 ) as $id ) { if ( ff90_image_eligible( $id, $post_id, $days ) ) { return $id; } }
    return new WP_Error( 'image_no_candidate', 'No rights-confirmed, non-repeated candidate available.' );
}
function ff90_image_reserve( $id, $post_id, $ttl = 600 ) {
    global $wpdb;
    if ( ! $post_id || ! current_user_can( 'edit_post', $post_id ) || ! ff90_image_eligible( $id, $post_id ) ) { return new WP_Error( 'image_reservation_denied', 'Image unavailable or post permission missing.' ); }
    $hash = ff90_image_digest( $id ); $visual = ff90_image_visual_hash( $id ) ?: array( 'visual_hash' => '', 'mean_rgb' => '' );
    $wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}ff90_image_leases WHERE asset_hash=%s AND expires_at <= %d", $hash, time() ) );
    $wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->prefix}ff90_image_leases (asset_hash,post_id,expires_at,visual_hash,mean_rgb) VALUES (%s,%d,%d,%s,%s)", $hash, $post_id, time() + max( 60, min( 3600, (int) $ttl ) ), $visual['visual_hash'], $visual['mean_rgb'] ) );
    $owner = (int) $wpdb->get_var( $wpdb->prepare( "SELECT post_id FROM {$wpdb->prefix}ff90_image_leases WHERE asset_hash=%s", $hash ) );
    return $owner === (int) $post_id ? true : new WP_Error( 'image_already_reserved', 'Another article reserved this image.' );
}
function ff90_image_record_use( $id, $post_id ) {
    global $wpdb; $hash = ff90_image_digest( $id ); if ( ! $hash ) { return false; }
    $visual = ff90_image_visual_hash( $id ) ?: array( 'visual_hash' => '', 'mean_rgb' => '' );
    $r = $wpdb->query( $wpdb->prepare( "INSERT INTO {$wpdb->prefix}ff90_image_uses (asset_hash,post_id,used_at,visual_hash,mean_rgb) VALUES (%s,%d,%s,%s,%s) ON DUPLICATE KEY UPDATE used_at=VALUES(used_at),visual_hash=VALUES(visual_hash),mean_rgb=VALUES(mean_rgb)", $hash, $post_id, gmdate( 'Y-m-d H:i:s' ), $visual['visual_hash'], $visual['mean_rgb'] ) );
    $wpdb->delete( $wpdb->prefix . 'ff90_image_leases', array( 'asset_hash' => $hash, 'post_id' => $post_id ) ); return false !== $r;
}
add_action( 'transition_post_status', function ( $new, $old, $post ) { if ( 'publish' === $new && 'publish' === get_post_status( $post ) && 'post' === $post->post_type && get_post_thumbnail_id( $post ) ) { ff90_image_record_use( get_post_thumbnail_id( $post ), $post->ID ); } }, 100, 3 );
add_action( 'post_updated', function ( $id, $after, $before ) { if ( 'post' === $after->post_type && 'publish' === $after->post_status && get_post_thumbnail_id( $id ) ) { ff90_image_record_use( get_post_thumbnail_id( $id ), $id ); } }, 100, 3 );
add_filter( 'ff90_qa_structural_errors', function ( $errors, $id ) { $image = get_post_thumbnail_id( $id ); if ( $image && ! ff90_image_rights( $image ) ) { $errors[] = 'image_rights_unverified_or_changed'; } return $errors; }, 10, 2 );
add_filter( 'attachment_fields_to_edit', function ( $fields, $post ) {
    if ( ! current_user_can( 'edit_others_posts' ) ) { return $fields; } $r = get_post_meta( $post->ID, '_ff90_image_rights', true ); $r = is_array( $r ) ? $r : array();
    foreach ( array( 'license_url' => 'License / source URL', 'credit' => 'Image credit', 'expires' => 'Rights expiry YYYY-MM-DD (optional)' ) as $key => $label ) { $fields[ 'ff90_' . $key ] = array( 'label' => $label, 'input' => 'text', 'value' => $r[ $key ] ?? '' ); }
    $fields['ff90_confirmed'] = array( 'label' => 'Human rights declaration', 'input' => 'html', 'html' => '<label><input type="checkbox" name="attachments[' . absint( $post->ID ) . '][ff90_confirmed]" value="1" ' . checked( ! empty( $r['confirmed'] ), true, false ) . '> I verified permission to use this exact image</label>' );
    return $fields;
}, 10, 2 );
add_filter( 'attachment_fields_to_save', function ( $post, $attachment ) {
    if ( ! current_user_can( 'edit_post', $post['ID'] ) || ! isset( $attachment['ff90_license_url'] ) ) { return $post; }
    $result = ff90_image_declare( $post['ID'], array( 'license_url' => $attachment['ff90_license_url'], 'credit' => $attachment['ff90_credit'] ?? '', 'expires' => $attachment['ff90_expires'] ?? '', 'confirmed' => ! empty( $attachment['ff90_confirmed'] ) ) );
    if ( is_wp_error( $result ) ) { $post['errors']['ff90_license_url']['errors'][] = $result->get_error_message(); } return $post;
}, 10, 2 );

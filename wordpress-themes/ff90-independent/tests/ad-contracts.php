<?php
/** Disposable QA coverage for empty creative alt text, unsafe links and hide controls. */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI || ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX ) { return; }
require_once ABSPATH . 'wp-admin/includes/image.php';
$slot = 'inline-2'; $checks = 0; $attachment = 0;
$old = array( 'image' => get_theme_mod( 'ff90_sale_inline-2_image', 0 ), 'url' => get_theme_mod( 'ff90_sale_inline-2_url', '' ), 'show' => get_theme_mod( 'ff90_show_sale_slots', true ) );
$assert = function ( $ok, $message ) use ( &$checks ) { if ( ! $ok ) { throw new RuntimeException( $message ); } ++$checks; echo "PASS: $message\n"; };
$render = function () use ( $slot ) { ob_start(); ff90_sale_slot( $slot ); return ob_get_clean(); };
try {
    $upload = wp_upload_bits( 'ff90-qa-alt-banner.png', null, file_get_contents( '/workspace/ff90-tools/fixtures/qa-sale-banner.png' ) );
    $attachment = wp_insert_attachment( array( 'post_mime_type' => 'image/png', 'post_title' => 'Synthetic QA ad, empty alt boundary', 'post_status' => 'inherit' ), $upload['file'] );
    wp_update_attachment_metadata( $attachment, wp_generate_attachment_metadata( $attachment, $upload['file'] ) );
    set_theme_mod( 'ff90_sale_inline-2_image', $attachment ); set_theme_mod( 'ff90_sale_inline-2_url', 'https://example.org/' );
    $html = $render();
    $assert( strpos( $html, 'alt="แบนเนอร์โฆษณา"' ) !== false, 'empty advertiser alt gets a usable accessible fallback' );
    $assert( strpos( $html, 'rel="sponsored nofollow noopener"' ) !== false, 'paid destination identified as sponsored' );
    set_theme_mod( 'ff90_sale_inline-2_url', 'javascript:alert(1)' );
    $html = $render(); $assert( strpos( $html, '<a ' ) === false && strpos( $html, 'javascript:' ) === false, 'unsafe destination cannot create a link' );
    set_theme_mod( 'ff90_show_sale_slots', false );
    $assert( strpos( $render(), 'sale-creative' ) !== false, 'hide-empty switch does not hide a booked creative' );
    set_theme_mod( 'ff90_sale_inline-2_image', 0 );
    $assert( $render() === '', 'empty available slot can be hidden' );
    set_theme_mod( 'ff90_show_sale_slots', true );
    $assert( strpos( $render(), 'sale-available' ) !== false, 'clearing creative returns to sellable placeholder' );
    echo "TOTAL: $checks checks passed\n";
} finally {
    set_theme_mod( 'ff90_sale_inline-2_image', $old['image'] ); set_theme_mod( 'ff90_sale_inline-2_url', $old['url'] ); set_theme_mod( 'ff90_show_sale_slots', $old['show'] );
    if ( $attachment ) { wp_delete_attachment( $attachment, true ); }
}

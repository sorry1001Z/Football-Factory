<?php
/** Synthetic local-only QA fixtures; never run on production. */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI || ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX ) { return; }
require_once ABSPATH . 'wp-admin/includes/image.php';
$kinds = ff90_banner_kinds();
$category_names = array( 'ข่าวฟุตบอล', 'ข่าวด่วน', 'ตลาดนักเตะ', 'ก่อนเกม', 'หลังเกม', 'ตารางคะแนน', 'สถิติ', 'แท็กติก', 'ข่าวทีม', 'รายการแข่งขัน', 'อินโฟกราฟิก', 'เยาวชน', 'เรื่องพิเศษ' );
$ids = array();
foreach ( $kinds as $i => $kind ) {
    $slug = 'ff90-qa-' . $kind;
    $existing = get_page_by_path( $slug, OBJECT, 'post' );
    $term = term_exists( $kind, 'category' );
    if ( ! $term ) { $term = wp_insert_term( $category_names[ $i ], 'category', array( 'slug' => $kind ) ); }
    $category = is_array( $term ) ? $term['term_id'] : $term;
    $id = wp_insert_post( array( 'ID' => $existing ? $existing->ID : 0, 'post_type' => 'post', 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => 'ทดสอบ FF90 · ' . $category_names[ $i ] . ' — อ่านเกมฟุตบอลจากหลายมุมมองและเรื่องราวที่เชื่อมทุกคนเข้าด้วยกัน', 'post_content' => '<p>บทความจำลองสำหรับตรวจสอบธีมเท่านั้น ไม่ใช่รายงานข่าวหรือผลการแข่งขันจริง ภาพประกอบเป็นงานกราฟิกทดสอบที่สร้างขึ้นใหม่</p><h2>พื้นที่สำหรับเรื่องราวของฟุตบอล</h2><p>ทดสอบการแสดงข้อความภาษาไทยที่มีความยาวมาก พร้อมภาพประกอบเนื้อหาในสัดส่วนสิบหกต่อเก้า โดยไม่เปลี่ยนข้อมูลบทความเมื่อสลับหน้าแรก</p><p><a href="https://example.test/source">แหล่งอ้างอิงจำลองสำหรับทดสอบลิงก์</a></p>', 'post_excerpt' => 'เนื้อหาจำลองสำหรับทดสอบเลย์เอาต์ FF90 เท่านั้น ตรวจสอบภาษาไทย รูปภาพ และการอ่านบนหน้าจอทุกขนาด', 'post_category' => array( (int) $category ), 'post_date' => gmdate( 'Y-m-d H:i:s', time() - $i * 3600 ), 'comment_status' => 'closed' ), true );
    if ( is_wp_error( $id ) ) { throw new RuntimeException( $id->get_error_message() ); }
    update_post_meta( $id, '_ff90_banner_kind', $kind );
    if ( ! has_post_thumbnail( $id ) ) {
        $file = '/workspace/ff90-tools/fixtures/' . $kind . '.png';
        $upload = wp_upload_bits( $kind . '.png', null, file_get_contents( $file ) );
        $attachment = wp_insert_attachment( array( 'post_mime_type' => 'image/png', 'post_title' => 'FF90 synthetic QA banner — ' . $kind, 'post_status' => 'inherit', 'post_excerpt' => 'Synthetic QA artwork. Not documentary photography.' ), $upload['file'], $id );
        wp_update_attachment_metadata( $attachment, wp_generate_attachment_metadata( $attachment, $upload['file'] ) );
        update_post_meta( $attachment, '_wp_attachment_image_alt', 'FF90 synthetic QA banner: ' . $kind );
        set_post_thumbnail( $id, $attachment );
    }
    for ( $variant = 1; $variant <= 2; ++$variant ) {
        $extra_slug = $slug . '-' . $variant;
        $extra = get_page_by_path( $extra_slug, OBJECT, 'post' );
        $extra_id = wp_insert_post( array( 'ID' => $extra ? $extra->ID : 0, 'post_type' => 'post', 'post_status' => 'publish', 'post_name' => $extra_slug, 'post_title' => 'ทดสอบ FF90 · ' . $category_names[ $i ] . ' — มุมมองที่ ' . $variant . ' เรื่องราวและความเคลื่อนไหวของวงการฟุตบอล', 'post_content' => '<p>บทความจำลองสำหรับตรวจสอบการจัดวางข่าวในหมวดเดียวกัน ไม่ใช่ข่าวหรือผลการแข่งขันจริง</p>', 'post_excerpt' => 'เรื่องราวจำลองสำหรับทดสอบพื้นที่ข่าวและภาพประกอบในหมวดเดียวกัน', 'post_category' => array( (int) $category ), 'post_date' => gmdate( 'Y-m-d H:i:s', time() - ( 24 + $i * 3 + $variant ) * 3600 ), 'comment_status' => 'closed' ), true );
        update_post_meta( $extra_id, '_ff90_banner_kind', $kind );
        set_post_thumbnail( $extra_id, get_post_thumbnail_id( $id ) );
    }
    $ids[] = $id;
}
$draft = get_page_by_path( 'ff90-qa-secret-draft', OBJECT, 'post' );
if ( ! $draft ) { wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'draft', 'post_name' => 'ff90-qa-secret-draft', 'post_title' => 'FF90_NEVER_SHOW_DRAFT' ) ); }
$menu = wp_get_nav_menu_object( 'FF90 QA Navigation' );
$menu_id = $menu ? $menu->term_id : wp_create_nav_menu( 'FF90 QA Navigation' );
if ( ! $menu ) {
    wp_update_nav_menu_item( $menu_id, 0, array( 'menu-item-title' => 'หน้าแรก', 'menu-item-url' => home_url( '/' ), 'menu-item-type' => 'custom', 'menu-item-status' => 'publish' ) );
    foreach ( array_slice( get_categories( array( 'hide_empty' => true ) ), 0, 5 ) as $cat ) { wp_update_nav_menu_item( $menu_id, 0, array( 'menu-item-title' => $cat->name, 'menu-item-object-id' => $cat->term_id, 'menu-item-object' => 'category', 'menu-item-type' => 'taxonomy', 'menu-item-status' => 'publish' ) ); }
}
set_theme_mod( 'nav_menu_locations', array( 'primary' => $menu_id, 'footer' => $menu_id ) );
set_theme_mod( 'ff90_home_layout', 'colormag-01' );
wp_delete_post( 1, true );
echo wp_json_encode( array( 'post_ids' => $ids, 'home' => home_url( '/' ) ) );

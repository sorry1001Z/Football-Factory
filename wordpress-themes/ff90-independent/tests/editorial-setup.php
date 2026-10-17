<?php
/** Reproduce the user-authorized contact settings only in a disposable QA site. */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI || ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX ) { return; }
$page = get_page_by_path( 'contact' );
$id = $page ? $page->ID : wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_name' => 'contact', 'post_title' => 'ติดต่อเรา', 'post_content' => '<p>สอบถามข่าวสาร ความร่วมมือ และพื้นที่โฆษณา ติดต่อผ่านอีเมลด้านล่าง</p>' ) );
set_theme_mod( 'ff90_contact_page', $id );
set_theme_mod( 'ff90_contact_email', 'rom2001th@gmail.com' );
// URLs deliberately remain unset: user requested icon placeholders only.
echo 'Contact page selected; authorized public email configured; no social URLs invented.';

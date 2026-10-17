<?php
/** Useful not-found page with correct WP status. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header(); ?>
<main id="main-content" class="container page-main" tabindex="-1"><section class="empty-state"><span class="eyebrow">404 / OFFSIDE</span><h1><?php esc_html_e( 'ไม่พบหน้าที่ต้องการ', 'ff90-independent' ); ?></h1><p><?php esc_html_e( 'ลองค้นหาข่าว หรือกลับไปอ่านเรื่องล่าสุด', 'ff90-independent' ); ?></p><?php get_search_form(); ?><p><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'กลับหน้าแรก', 'ff90-independent' ); ?> →</a></p></section></main><?php get_footer(); ?>

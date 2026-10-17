<?php
/** Footer with native plugin hook. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<footer class="site-footer"><div class="container footer-grid"><div><a class="brand" href="<?php echo esc_url( home_url( '/' ) ); ?>">FF<span>90</span><span class="brand-dot">.</span></a><p><?php esc_html_e( 'ฟุตบอลทุกมุมมอง เรื่องราวที่มากกว่าผลการแข่งขัน', 'ff90-independent' ); ?></p></div><nav aria-label="<?php esc_attr_e( 'เมนูท้ายเว็บ', 'ff90-independent' ); ?>"><?php wp_nav_menu( array( 'theme_location' => 'footer', 'container' => false, 'fallback_cb' => false, 'depth' => 1 ) ); ?></nav><div><?php ff90_contact_details(); ff90_social_links(); if ( is_active_sidebar( 'ff90-footer' ) ) { dynamic_sidebar( 'ff90-footer' ); } ?></div></div><div class="container footer-bottom"><span>© <?php echo esc_html( wp_date( 'Y' ) . ' ' . get_bloginfo( 'name' ) ); ?></span><a href="#main-content"><?php esc_html_e( 'กลับสู่เนื้อหา', 'ff90-independent' ); ?> ↑</a></div></footer>
<?php wp_footer(); ?>
</body></html>

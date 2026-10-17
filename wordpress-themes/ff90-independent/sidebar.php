<?php
/** Optional widgets plus editorial discovery; no invented traffic ranking. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?><aside class="news-sidebar" aria-label="<?php esc_attr_e( 'ข่าวและหมวดหมู่เพิ่มเติม', 'ff90-independent' ); ?>">
<?php if ( is_active_sidebar( 'ff90-advertisement' ) ) : ?><div class="ad-region" aria-label="<?php esc_attr_e( 'โฆษณา', 'ff90-independent' ); ?>"><span class="ad-label"><?php esc_html_e( 'โฆษณา', 'ff90-independent' ); ?></span><?php dynamic_sidebar( 'ff90-advertisement' ); ?></div><?php endif; ?>
<?php if ( is_active_sidebar( 'ff90-sidebar' ) ) { dynamic_sidebar( 'ff90-sidebar' ); } ?>
<section class="sidebar-panel"><h2 class="section-title"><?php esc_html_e( 'ข่าวน่าติดตาม', 'ff90-independent' ); ?></h2><ol class="headline-list"><?php $news = ff90_news_query(); while ( $news->have_posts() ) : $news->the_post(); ?><li><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a><time datetime="<?php echo esc_attr( get_the_date( DATE_W3C ) ); ?>"><?php echo esc_html( get_the_date() ); ?></time></li><?php endwhile; wp_reset_postdata(); ?></ol></section>
<section class="sidebar-panel"><h2 class="section-title"><?php esc_html_e( 'หมวดข่าว', 'ff90-independent' ); ?></h2><ul class="category-list"><?php wp_list_categories( array( 'title_li' => '', 'show_count' => false, 'hide_empty' => true ) ); ?></ul></section>
</aside>

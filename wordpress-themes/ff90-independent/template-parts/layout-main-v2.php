<?php
/** Layout A: headline priorities then dense latest feed. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
$priority = ff90_news_query( array( 'posts_per_page' => 3 ) );
if ( $priority->have_posts() ) : ?>
<section class="priority-panel"><h2 class="section-title"><?php esc_html_e( 'จับตาประเด็น', 'ff90-independent' ); ?></h2><ol><?php while ( $priority->have_posts() ) : $priority->the_post(); ?><li><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></li><?php endwhile; wp_reset_postdata(); ?></ol></section>
<?php endif; ?>
<section><div class="section-heading"><h2 class="section-title"><?php esc_html_e( 'ข่าวล่าสุด', 'ff90-independent' ); ?></h2><span>LATEST STORIES</span></div>
<?php $latest = ff90_news_query( array( 'posts_per_page' => 10, 'paged' => max( 1, get_query_var( 'paged' ), get_query_var( 'page' ) ), 'no_found_rows' => false ) ); ?>
<div class="latest-feed"><?php while ( $latest->have_posts() ) { $latest->the_post(); ff90_card( 'feed' ); } wp_reset_postdata(); ?></div>
<?php echo wp_kses_post( paginate_links( array( 'total' => $latest->max_num_pages, 'current' => max( 1, get_query_var( 'paged' ), get_query_var( 'page' ) ) ) ) ); ?></section>

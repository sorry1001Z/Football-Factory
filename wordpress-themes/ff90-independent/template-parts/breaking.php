<?php
/** Published headlines; no fake realtime claim. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
$headlines = ff90_news_query( array( 'posts_per_page' => 3 ) );
if ( ! $headlines->have_posts() ) { return; }
?>
<div class="breaking-strip"><div class="container breaking-inner"><strong><?php esc_html_e( 'ประเด็นล่าสุด', 'ff90-independent' ); ?></strong><ul><?php while ( $headlines->have_posts() ) : $headlines->the_post(); ?><li><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></li><?php endwhile; wp_reset_postdata(); ?></ul></div></div>

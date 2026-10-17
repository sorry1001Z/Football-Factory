<?php
/** Layout B: populated category-first lead + two story modules. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
$categories = get_categories( array( 'hide_empty' => true, 'number' => 6, 'orderby' => 'count', 'order' => 'DESC' ) );
foreach ( $categories as $category ) :
    $stories = ff90_news_query( array( 'cat' => $category->term_id, 'posts_per_page' => 3 ) ); ?>
<section class="category-module"><div class="section-heading"><h2 class="section-title"><?php echo esc_html( $category->name ); ?></h2><a href="<?php echo esc_url( get_category_link( $category ) ); ?>"><?php esc_html_e( 'ดูทั้งหมด', 'ff90-independent' ); ?> →</a></div><div class="category-stories"><?php while ( $stories->have_posts() ) { $stories->the_post(); ff90_card(); } wp_reset_postdata(); ?></div></section>
<?php endforeach; ?>

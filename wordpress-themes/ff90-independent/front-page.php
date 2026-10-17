<?php
/** Dual editorial homepage, presentation only. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header();
?>
<main id="main-content" class="container home-main layout-<?php echo esc_attr( ff90_layout() ); ?>" tabindex="-1">
<div class="edition-heading"><h1><?php esc_html_e( 'ข่าวฟุตบอล', 'ff90-independent' ); ?></h1><span>THE FOOTBALL EDIT</span></div>
<?php get_template_part( 'template-parts/fixtures' ); ?>
<?php $hero = ff90_news_query(); if ( $hero->have_posts() ) : ?>
<section class="hero-grid" aria-label="<?php esc_attr_e( 'ข่าวเด่น', 'ff90-independent' ); ?>"><?php while ( $hero->have_posts() ) { $hero->the_post(); ff90_card( 'hero' ); } wp_reset_postdata(); ?></section>
<?php else : get_template_part( 'template-parts/empty' ); endif; ?>
<div class="content-with-sidebar"><div class="news-main">
<?php get_template_part( 'template-parts/layout', ff90_layout() ); ?>
<?php if ( has_action( 'ff90_standings' ) ) : ?><section class="plugin-panel"><h2 class="section-title"><?php esc_html_e( 'ตารางคะแนน', 'ff90-independent' ); ?></h2><?php do_action( 'ff90_standings' ); ?></section><?php endif; ?>
<?php if ( has_action( 'ff90_results' ) ) : ?><section class="plugin-panel"><h2 class="section-title"><?php esc_html_e( 'ผลการแข่งขัน', 'ff90-independent' ); ?></h2><?php do_action( 'ff90_results' ); ?></section><?php endif; ?>
</div><?php get_sidebar(); ?></div></main>
<?php get_footer(); ?>

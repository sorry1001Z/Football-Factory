<?php
/** Native archive, blog and search loop. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header(); ?>
<main id="main-content" class="container page-main" tabindex="-1"><div class="content-with-sidebar"><div><header class="archive-header"><span class="eyebrow">FF90 / STORIES</span><h1><?php if ( is_search() ) { printf( esc_html__( 'ผลการค้นหา: %s', 'ff90-independent' ), esc_html( get_search_query() ) ); } elseif ( is_home() ) { esc_html_e( 'ข่าวล่าสุด', 'ff90-independent' ); } else { the_archive_title(); } ?></h1><?php the_archive_description( '<div class="archive-description">', '</div>' ); ?></header>
<?php if ( have_posts() ) : ?><div class="archive-grid"><?php while ( have_posts() ) { the_post(); ff90_card(); } ?></div><?php the_posts_pagination(); else : get_template_part( 'template-parts/empty' ); endif; ?></div><?php get_sidebar(); ?></div></main>
<?php get_footer(); ?>

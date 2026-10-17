<?php
/** Article preserves native content, permalink, media and plugin hooks. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header(); ?>
<main id="main-content" class="container page-main" tabindex="-1"><div class="content-with-sidebar"><div>
<?php while ( have_posts() ) : the_post(); ?><article <?php post_class( 'full-article banner-' . ff90_banner_kind( get_the_ID() ) ); ?>><header><?php echo ff90_badges_html( ff90_post_badges( get_the_ID() ) ); ?><div class="article-categories"><?php the_category( ' / ' ); ?></div><h1><?php the_title(); ?></h1><div class="post-meta"><?php the_author_posts_link(); ?><span aria-hidden="true"> · </span><time datetime="<?php echo esc_attr( get_the_date( DATE_W3C ) ); ?>"><?php echo esc_html( get_the_date() ); ?></time></div></header>
<?php if ( has_post_thumbnail() ) : ?><figure class="article-featured"><?php the_post_thumbnail( 'full', array( 'loading' => 'eager' ) ); ?><?php if ( get_the_post_thumbnail_caption() ) : ?><figcaption><?php echo wp_kses_post( get_the_post_thumbnail_caption() ); ?></figcaption><?php endif; ?></figure><?php endif; ?>
<div class="entry-content"><?php the_content(); wp_link_pages( array( 'before' => '<nav class="page-links">', 'after' => '</nav>' ) ); ?></div><footer class="article-tags"><?php the_tags(); ?></footer></article>
<?php the_post_navigation(); if ( comments_open() || get_comments_number() ) { comments_template(); } endwhile; ?>
</div><?php get_sidebar(); ?></div></main><?php get_footer(); ?>

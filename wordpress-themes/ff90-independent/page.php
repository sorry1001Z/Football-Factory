<?php
/** Native page template. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
get_header(); ?>
<main id="main-content" class="container page-main" tabindex="-1"><?php while ( have_posts() ) : the_post(); ?><article <?php post_class( 'full-article' ); ?>><h1><?php the_title(); ?></h1><div class="entry-content"><?php the_content(); wp_link_pages(); ?></div></article><?php if ( comments_open() || get_comments_number() ) { comments_template(); } endwhile; ?></main>
<?php get_footer(); ?>

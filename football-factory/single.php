<?php
/**
 * Single post template.
 *
 * Phase 6B scaffold. Renders a minimal, semantic single
 * post view. The full single template (with sidebar,
 * related entities, share, etc.) is implemented in a
 * later phase.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

get_header();
?>

<div class="ff-container">
	<article id="post-<?php the_ID(); ?>" <?php post_class( 'ff-article' ); ?>>
		<header class="ff-page-head">
			<h1 class="ff-page-head__title"><?php the_title(); ?></h1>
			<?php if ( has_excerpt() ) : ?>
				<p class="ff-page-head__desc"><?php echo esc_html( get_the_excerpt() ); ?></p>
			<?php endif; ?>
		</header>

		<?php if ( has_post_thumbnail() ) : ?>
			<figure class="ff-article__hero">
				<?php the_post_thumbnail( 'ff-news-card', array( 'loading' => 'lazy' ) ); ?>
			</figure>
		<?php endif; ?>

		<div class="ff-article__body">
			<?php
			the_content();
			$football_factory_page_links_label = esc_attr__( 'Page break links', 'football-factory' );
			$football_factory_page_links_open  = '<nav class="ff-page-links" aria-label="'
				. $football_factory_page_links_label
				. '">';
			wp_link_pages(
				array(
					'before'      => $football_factory_page_links_open,
					'after'       => '</nav>',
					'link_before' => '<span class="ff-page-links__item">',
					'link_after'  => '</span>',
				)
			);
			?>
		</div>

		<?php if ( has_tag() ) : ?>
			<footer class="ff-article__tags">
				<?php the_tags( '<ul class="ff-tag-list"><li>', '</li><li>', '</li></ul>' ); ?>
			</footer>
		<?php endif; ?>
	</article>
</div>

<?php
if ( comments_open() || get_comments_number() ) {
	comments_template();
}
get_footer();

<?php
/**
 * Search results template.
 *
 * Phase 6B scaffold. Renders a minimal semantic search
 * result loop. The full search template (entity-grouped
 * results across players / teams / news / matches) is
 * implemented in Phase 6D, in line with Blueprint v1.1
 * ADR-002 (Classic PHP search, no FSE block template).
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

get_header();
?>

<div class="ff-container">
	<header class="ff-page-head">
		<h1 class="ff-page-head__title">
			<?php
			printf(
				/* translators: %s: search query */
				esc_html__( 'Search results for: %s', 'football-factory' ),
				'<span class="ff-search-query">' . esc_html( get_search_query() ) . '</span>'
			);
			?>
		</h1>
	</header>

	<?php if ( have_posts() ) : ?>

		<div class="ff-news-list" role="list">
			<?php
			while ( have_posts() ) :
				the_post();
				?>
				<article id="post-<?php the_ID(); ?>" <?php post_class( 'ff-news-card' ); ?> role="listitem">
					<h2 class="ff-news-card__title">
						<a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
					</h2>
				</article>
				<?php
			endwhile;
			?>
		</div>

		<?php
		the_posts_pagination(
			array(
				'prev_text' => esc_html__( 'Previous', 'football-factory' ),
				'next_text' => esc_html__( 'Next', 'football-factory' ),
			)
		);
		?>

	<?php else : ?>

		<div class="ff-empty" role="status">
			<h2><?php esc_html_e( 'Nothing found', 'football-factory' ); ?></h2>
			<p><?php esc_html_e( 'Try a different keyword, or browse the homepage.', 'football-factory' ); ?></p>
			<?php get_search_form(); ?>
		</div>

	<?php endif; ?>
</div>

<?php
get_footer();

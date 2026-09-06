<?php
/**
 * Archive template.
 *
 * Phase 6B scaffold. Renders a minimal, semantic archive
 * listing with proper landmarks and an accessible page
 * title. The full archive template (per-post-type
 * variations, filters, sidebars) is implemented in a
 * later phase.
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
			the_archive_title();
			?>
		</h1>
		<?php
		$football_factory_archive_description = get_the_archive_description();
		if ( ! empty( $football_factory_archive_description ) ) {
			?>
			<div class="ff-page-head__desc"><?php echo wp_kses_post( $football_factory_archive_description ); ?></div>
			<?php
		}
		?>
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
			<h2><?php esc_html_e( 'No posts found', 'football-factory' ); ?></h2>
		</div>

	<?php endif; ?>
</div>

<?php
get_footer();

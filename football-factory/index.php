<?php
/**
 * The main template file (fallback).
 *
 * Phase 6B scaffold. This is the universal fallback used
 * by WordPress when no more specific template matches.
 * It is intentionally minimal; the full homepage is
 * rendered by `front-page.php` in later phases.
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
			if ( is_home() && ! is_front_page() ) {
				single_post_title();
			} else {
				esc_html_e( 'Latest posts', 'football-factory' );
			}
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
					<?php if ( has_excerpt() ) : ?>
						<p class="ff-news-card__excerpt"><?php echo esc_html( get_the_excerpt() ); ?></p>
					<?php endif; ?>
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
			<p>
				<?php
				esc_html_e(
					'There are no posts to display right now. Please check back later.',
					'football-factory'
				);
				?>
			</p>
		</div>

	<?php endif; ?>
</div>

<?php
get_footer();

<?php
/**
 * 404 template.
 *
 * Phase 6B scaffold. The 404 is design-locked and uses
 * Classic PHP (Blueprint v1.1 ADR-002). This Phase 6B
 * version is intentionally minimal: it has an accessible
 * search form, a home link, and the proper landmarks.
 *
 * The full 404 (popular leagues, recent news, last-known-good
 * fallback) is implemented in a later phase.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

get_header();
?>

<div class="ff-container">
	<section class="ff-404" role="region" aria-labelledby="ff-404-title">
		<header class="ff-page-head">
			<h1 id="ff-404-title" class="ff-page-head__title">
				<?php esc_html_e( 'Page not found', 'football-factory' ); ?>
			</h1>
		</header>

		<?php
		// phpcs:disable Generic.Files.LineLength.TooLong,WordPress.Files.LineLength.TooLong
		// Translation strings are kept on one line for translator review;
		// WPCS LineLength limit is a documented false positive in this case.
		$football_factory_404_not_found   = __( 'The page you’re looking for couldn’t be found.', 'football-factory' );
		$football_factory_404_explanation = __( 'It may have been moved, renamed, or is no longer available.', 'football-factory' );
		$football_factory_404_text        = $football_factory_404_not_found . ' ' . $football_factory_404_explanation;
		// phpcs:enable Generic.Files.LineLength.TooLong,WordPress.Files.LineLength.TooLong
		?>
		<p class="ff-404__lead">
			<?php echo esc_html( $football_factory_404_text ); ?>
		</p>

		<div class="ff-404__actions">
			<a class="ff-btn ff-btn--primary" href="<?php echo esc_url( home_url( '/' ) ); ?>">
				<?php esc_html_e( 'Go to homepage', 'football-factory' ); ?>
			</a>
		</div>

		<div class="ff-404__search">
			<h2 class="ff-404__sub"><?php esc_html_e( 'Try searching', 'football-factory' ); ?></h2>
			<?php get_search_form(); ?>
		</div>
	</section>
</div>

<?php
get_footer();

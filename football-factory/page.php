<?php
/**
 * Page template.
 *
 * Phase 6B scaffold. Renders a minimal, semantic page
 * view. The full page template (with sidebar slot,
 * related blocks) is implemented in a later phase.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

get_header();
?>

<div class="ff-container">
	<article id="post-<?php the_ID(); ?>" <?php post_class( 'ff-page' ); ?>>
		<header class="ff-page-head">
			<h1 class="ff-page-head__title"><?php the_title(); ?></h1>
		</header>

		<div class="ff-page__body">
			<?php
			the_content();
			?>
		</div>
	</article>
</div>

<?php
get_footer();

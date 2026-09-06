<?php
/**
 * Template Part: League Match List (TP-025)
 *
 * League's recent + upcoming matches composition.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $matches Array of MatchCardViewModel.
 *     @type string               $title   Section title.
 *     @type string               $more_url "View all" link URL.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_matches = isset( $args['matches'] ) && is_array( $args['matches'] ) ? $args['matches'] : array();
$football_factory_title   = isset( $args['title'] ) ? (string) $args['title'] : __( 'แมตช์ของลีก', 'football-factory' );
$football_factory_more    = isset( $args['more_url'] ) ? (string) $args['more_url'] : '';

$football_factory_label_empty = __( 'ยังไม่มีแมตช์', 'football-factory' );
?>
<section
	class="ff-fixtures-list" aria-label="
	<?php echo esc_html( $football_factory_title ); ?>
	" data-tp="league/match-list" data-demo="true"
>
	<div class="ff-section-head">
		<h2 class="ff-section-title"><?php echo esc_html( $football_factory_title ); ?></h2>
		<?php if ( '' !== $football_factory_more ) : ?>
			<a
				class="ff-section-link" href="
				<?php echo esc_url( $football_factory_more ); ?>
				"
			>
		<?php endif; ?>
	</div>
	<?php if ( empty( $football_factory_matches ) ) : ?>
		<p class="ff-fixtures-list__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<div class="ff-fixtures-list__items">
			<?php foreach ( $football_factory_matches as $football_factory_match ) : ?>
				<?php
				$football_factory_arg_match = $football_factory_match;
				include __DIR__ . '/../match/match-card.php';
				?>
			<?php endforeach; ?>
		</div>
	<?php endif; ?>
</section>

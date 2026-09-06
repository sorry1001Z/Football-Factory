<?php
/**
 * Template Part: Player Ratings (TP-020)
 *
 * Per-player rating display with stars/bars.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $ratings Array of { player, position, rating, palette? }.
 *     @type string               $title  Section title.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_ratings = isset( $args['ratings'] ) && is_array( $args['ratings'] ) ? $args['ratings'] : array();
$football_factory_title   = isset( $args['title'] )
	? (string) $args['title']
	: __( 'คะแนนผู้เล่น', 'football-factory' );

$football_factory_label_empty = __( 'ยังไม่มีคะแนน', 'football-factory' );
$football_factory_label_max   = 10;
?>
<section
	class="ff-rating" aria-label="
	<?php echo esc_attr( $football_factory_title ); ?>
	" data-tp="match/rating" data-demo="true"
>
	<h3 class="ff-section-title"><?php echo esc_html( $football_factory_title ); ?></h3>
	<?php if ( empty( $football_factory_ratings ) ) : ?>
		<p class="ff-rating__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<ol class="ff-rating__list">
			<?php foreach ( $football_factory_ratings as $football_factory_rating ) : ?>
				<?php
				if ( ! is_array( $football_factory_rating ) ) {
					continue;
				}
				$football_factory_rating_player   = isset( $football_factory_rating['player'] )
					? (string) $football_factory_rating['player']
					: '';
				$football_factory_rating_position = isset( $football_factory_rating['position'] )
					? (string) $football_factory_rating['position']
					: '';
				$football_factory_rating_value    = isset( $football_factory_rating['rating'] )
					? (float) $football_factory_rating['rating']
					: 0;
				$football_factory_rating_palette  = isset( $football_factory_rating['palette'] )
					? (string) $football_factory_rating['palette']
					: '';
				if ( '' === $football_factory_rating_player ) {
					continue;
				}
				$football_factory_rating_pct =
					( $football_factory_rating_value / (float) $football_factory_label_max )
					* 100;
				if ( $football_factory_rating_pct > 100 ) {
					$football_factory_rating_pct = 100;
				}
				if ( $football_factory_rating_pct < 0 ) {
					$football_factory_rating_pct = 0;
				}
				?>
				<li class="ff-rating__item">
					<div class="ff-rating__player">
						<?php if ( '' !== $football_factory_rating_palette ) : ?>
							<span
								class="ff-rating__avatar" data-palette="
								<?php echo esc_attr( $football_factory_rating_palette ); ?>
								" aria-hidden="true"
							>
						<?php endif; ?>
						<span class="ff-rating__name"><?php echo esc_html( $football_factory_rating_player ); ?></span>
						<?php if ( '' !== $football_factory_rating_position ) : ?>
							<span
								class="ff-rating__position"
							>
						<?php endif; ?>
					</div>
					<div
					class="ff-rating__bar"
					role="meter"
					aria-valuenow="<?php echo (float) $football_factory_rating_value; ?>"
					aria-valuemin="0"
					aria-valuemax="<?php echo (int) $football_factory_label_max; ?>"
					aria-label="
					<?php
						echo esc_attr(
							$football_factory_rating_player . ' ' . $football_factory_rating_value
						);
					?>
					"
				>
						<span
							class="ff-rating__fill" style="width:
							<?php echo (float) $football_factory_rating_pct; ?>
							%"
						>
					</div>
					<span
						class="ff-rating__value"
					>
				</li>
			<?php endforeach; ?>
		</ol>
	<?php endif; ?>
</section>

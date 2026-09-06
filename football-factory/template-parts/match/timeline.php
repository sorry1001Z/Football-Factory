<?php
/**
 * Template Part: Match Timeline (TP-019)
 *
 * Vertical event timeline with goals, cards, subs.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $events Array of { minute, type, team, player, description?, icon? }.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_events = isset( $args['events'] ) && is_array( $args['events'] ) ? $args['events'] : array();

$football_factory_label_timeline = __( 'ไทม์ไลน์การแข่งขัน', 'football-factory' );
$football_factory_label_empty    = __( 'ไม่มีเหตุการณ์', 'football-factory' );
?>
<section
	class="ff-timeline" aria-label="
	<?php echo esc_attr( $football_factory_label_timeline ); ?>
	" data-tp="match/timeline" data-demo="true"
>
	<?php if ( empty( $football_factory_events ) ) : ?>
		<p class="ff-timeline__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<ol class="ff-timeline__list">
			<?php foreach ( $football_factory_events as $football_factory_event ) : ?>
				<?php
				if ( ! is_array( $football_factory_event ) ) {
					continue;
				}
				$football_factory_event_minute = isset( $football_factory_event['minute'] )
					? (string) $football_factory_event['minute']
					: '';
				$football_factory_event_type   = isset( $football_factory_event['type'] )
					? (string) $football_factory_event['type']
					: 'event';
				$football_factory_event_team   = isset( $football_factory_event['team'] )
					? (string) $football_factory_event['team']
					: '';
				$football_factory_event_player = isset( $football_factory_event['player'] )
					? (string) $football_factory_event['player']
					: '';
				$football_factory_event_desc   = isset( $football_factory_event['description'] )
					? (string) $football_factory_event['description']
					: '';
				$football_factory_event_icon   = isset( $football_factory_event['icon'] )
					? (string) $football_factory_event['icon']
					: '';
				if ( '' === $football_factory_event_minute ) {
					continue;
				}
				?>
				<li
					class="ff-timeline__item ff-timeline__item--
					<?php echo esc_attr( sanitize_html_class( $football_factory_event_type ) ); ?>
					"
				>
					<div class="ff-timeline__dot" aria-hidden="true"></div>
					<div class="ff-timeline__content">
						<div class="ff-timeline__head">
							<span
								class="ff-timeline__minute"
							>
							<?php if ( '' !== $football_factory_event_icon ) : ?>
								<span class="ff-timeline__icon" aria-hidden="true">
									<svg
										width="14" height="14"
									>
								</span>
							<?php endif; ?>
							<?php if ( '' !== $football_factory_event_team ) : ?>
								<span
									class="ff-timeline__team"
								>
							<?php endif; ?>
						</div>
						<?php if ( '' !== $football_factory_event_player ) : ?>
							<div
								class="ff-timeline__player"
							>
						<?php endif; ?>
						<?php if ( '' !== $football_factory_event_desc ) : ?>
							<div
								class="ff-timeline__description"
							>
						<?php endif; ?>
					</div>
				</li>
			<?php endforeach; ?>
		</ol>
	<?php endif; ?>
</section>

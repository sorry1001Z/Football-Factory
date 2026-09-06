<?php
/**
 * Template Part: Date Strip (TP-014)
 *
 * Horizontal date strip with selectable days.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $dates   Array of { date, label, count? }.
 *     @type string               $current Currently selected date (YYYY-MM-DD).
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_dates   = isset( $args['dates'] ) && is_array( $args['dates'] ) ? $args['dates'] : array();
$football_factory_current = isset( $args['current'] ) ? (string) $args['current'] : '';

$football_factory_label_strip = __( 'เลือกวัน', 'football-factory' );
?>
<nav
	class="ff-date-strip" aria-label="
	<?php echo esc_attr( $football_factory_label_strip ); ?>
	" data-tp="match/date-strip" data-demo="true"
>
	<ul class="ff-date-strip__list" role="list">
		<?php foreach ( $football_factory_dates as $football_factory_date ) : ?>
			<?php
			if ( ! is_array( $football_factory_date ) ) {
				continue;
			}
			$football_factory_date_value = isset( $football_factory_date['date'] )
				? (string) $football_factory_date['date']
				: '';
			$football_factory_date_label = isset( $football_factory_date['label'] )
				? (string) $football_factory_date['label']
				: $football_factory_date_value;
			$football_factory_date_count = isset( $football_factory_date['count'] )
				? (int) $football_factory_date['count']
				: 0;
			if ( '' === $football_factory_date_value ) {
				continue;
			}
			$football_factory_is_active = ( $football_factory_current === $football_factory_date_value );
			?>
			<li class="ff-date-strip__item">
				<button
					type="button" class="ff-date-strip__btn
					<?php
					echo $football_factory_is_active
						? ' is-active'
						: '';
					?>
					" data-ff="date-strip-btn" data-date="
					<?php echo esc_attr( $football_factory_date_value ); ?>
					"
					<?php
					echo $football_factory_is_active
						? 'aria-current="date"'
						: '';
					?>
				>
					<span class="ff-date-strip__label"><?php echo esc_html( $football_factory_date_label ); ?></span>
					<?php if ( $football_factory_date_count > 0 ) : ?>
						<span
							class="ff-date-strip__count" aria-hidden="true"
						>
					<?php endif; ?>
				</button>
			</li>
		<?php endforeach; ?>
	</ul>
</nav>

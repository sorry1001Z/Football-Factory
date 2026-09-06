<?php
/**
 * Template Part: Match Stats (TP-018)
 *
 * Post-match stats with side-by-side comparison bars.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $rows {
 *         Each: { label, home, away, home_value?, away_value? }.
 *     }
 *     @type string $home_label Home team label.
 *     @type string $away_label Away team label.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_rows     = isset( $args['rows'] ) && is_array( $args['rows'] ) ? $args['rows'] : array();
$football_factory_home_lbl = isset( $args['home_label'] ) ? (string) $args['home_label'] : '';
$football_factory_away_lbl = isset( $args['away_label'] ) ? (string) $args['away_label'] : '';

$football_factory_label_stats    = __( 'สถิติการแข่งขัน', 'football-factory' );
$football_factory_label_empty    = __( 'ไม่มีสถิติ', 'football-factory' );
$football_factory_label_h2h_alt  = __( 'เจ้าบ้าน', 'football-factory' );
$football_factory_label_away_alt = __( 'ทีมเยือน', 'football-factory' );

// Find max value for proportional bar widths.
$football_factory_max = 0;
foreach ( $football_factory_rows as $football_factory_row ) {
	if ( ! is_array( $football_factory_row ) ) {
		continue;
	}
	$football_factory_row_home = isset( $football_factory_row['home'] ) ? (float) $football_factory_row['home'] : 0;
	$football_factory_row_away = isset( $football_factory_row['away'] ) ? (float) $football_factory_row['away'] : 0;
	$football_factory_max      = max( $football_factory_max, $football_factory_row_home, $football_factory_row_away );
}
if ( $football_factory_max <= 0 ) {
	$football_factory_max = 1;
}
?>
<section
	class="ff-stats-grid" aria-label="
	<?php echo esc_attr( $football_factory_label_stats ); ?>
	" data-tp="match/stats" data-demo="true"
>
	<header class="ff-stats-grid__head">
		<div
			class="ff-stats-grid__col"
		>
		<div
			class="ff-stats-grid__col"
		>
	</header>
	<?php if ( empty( $football_factory_rows ) ) : ?>
		<p class="ff-stats-grid__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<ul class="ff-stats-grid__list">
			<?php foreach ( $football_factory_rows as $football_factory_row ) : ?>
				<?php
				if ( ! is_array( $football_factory_row ) ) {
					continue;
				}
				$football_factory_row_label = isset( $football_factory_row['label'] )
					? (string) $football_factory_row['label']
					: '';
				$football_factory_row_home  = isset( $football_factory_row['home'] )
					? (float) $football_factory_row['home']
					: 0;
				$football_factory_row_away  = isset( $football_factory_row['away'] )
					? (float) $football_factory_row['away']
					: 0;
				$football_factory_row_hv    = isset( $football_factory_row['home_value'] )
					? (string) $football_factory_row['home_value']
					: (string) $football_factory_row_home;
				$football_factory_row_av    = isset( $football_factory_row['away_value'] )
					? (string) $football_factory_row['away_value']
					: (string) $football_factory_row_away;
				if ( '' === $football_factory_row_label ) {
					continue;
				}
				$football_factory_row_pct_h = ( $football_factory_row_home / $football_factory_max ) * 100;
				$football_factory_row_pct_a = ( $football_factory_row_away / $football_factory_max ) * 100;
				?>
				<li class="ff-stat-row">
					<span class="ff-stat-row__label"><?php echo esc_html( $football_factory_row_label ); ?></span>
					<span class="ff-stat-row__home">
						<span
							class="ff-stat-row__bar ff-stat-row__bar--home" style="width:
							<?php echo (float) $football_factory_row_pct_h; ?>
							%"
						>
						<span class="ff-stat-row__value"><?php echo esc_html( $football_factory_row_hv ); ?></span>
					</span>
					<span class="ff-stat-row__away">
						<span class="ff-stat-row__value"><?php echo esc_html( $football_factory_row_av ); ?></span>
						<span
							class="ff-stat-row__bar ff-stat-row__bar--away" style="width:
							<?php echo (float) $football_factory_row_pct_a; ?>
							%"
						>
					</span>
				</li>
			<?php endforeach; ?>
		</ul>
	<?php endif; ?>
</section>

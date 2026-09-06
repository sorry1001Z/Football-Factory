<?php
/**
 * Template Part: Match List (TP-013)
 *
 * Vertical list of match cards, grouped by date.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $matches Array of MatchCardViewModel.
 *     @type string               $title  Section title.
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
$football_factory_title   = isset( $args['title'] )
	? (string) $args['title']
	: __( 'ตารางแข่งขัน', 'football-factory' );
$football_factory_more    = isset( $args['more_url'] ) ? (string) $args['more_url'] : '';
$football_factory_more_l  = isset( $args['more_label'] )
	? (string) $args['more_label']
	: __( 'ดูทั้งหมด', 'football-factory' );

$football_factory_label_empty = __( 'ไม่มีแมตช์ในขณะนี้', 'football-factory' );

// Group matches by date.
$football_factory_grouped = array();
foreach ( $football_factory_matches as $football_factory_match ) {
	if ( ! is_array( $football_factory_match ) ) {
		continue;
	}
	$football_factory_kickoff = isset( $football_factory_match['kickoff'] )
		? (string) $football_factory_match['kickoff']
		: '';
	$football_factory_day     = '';
	if ( '' !== $football_factory_kickoff ) {
		$football_factory_ts = strtotime( $football_factory_kickoff );
		if ( false !== $football_factory_ts ) {
			$football_factory_day = date_i18n( 'Y-m-d', $football_factory_ts );
		}
	}
	if ( '' === $football_factory_day ) {
		$football_factory_day = 'undated';
	}
	if ( ! isset( $football_factory_grouped[ $football_factory_day ] ) ) {
		$football_factory_grouped[ $football_factory_day ] = array();
	}
	$football_factory_grouped[ $football_factory_day ][] = $football_factory_match;
}
?>
<section
	class="ff-mc-list" aria-label="
	<?php echo esc_attr( $football_factory_title ); ?>
	" data-tp="match/match-list" data-demo="true"
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
	<?php if ( empty( $football_factory_grouped ) ) : ?>
		<p class="ff-mc-list__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<?php foreach ( $football_factory_grouped as $football_factory_day => $football_factory_day_matches ) : ?>
			<div class="ff-mc-list__day" data-day="<?php echo esc_attr( $football_factory_day ); ?>">
				<h3 class="ff-mc-list__day-title">
					<?php
					if ( 'undated' === $football_factory_day ) {
						esc_html_e( 'ไม่ระบุวัน', 'football-factory' );
					} else {
						$football_factory_day_ts = strtotime( $football_factory_day );
						echo esc_html(
							false !== $football_factory_day_ts
								? date_i18n( 'D j F Y', $football_factory_day_ts )
								: $football_factory_day
						);
					}
					?>
				</h3>
				<div class="ff-mc-list__items">
					<?php foreach ( $football_factory_day_matches as $football_factory_match ) : ?>
						<?php
						$football_factory_arg_match = $football_factory_match;
						include __DIR__ . '/match-card.php';
						?>
					<?php endforeach; ?>
				</div>
			</div>
		<?php endforeach; ?>
	<?php endif; ?>
</section>

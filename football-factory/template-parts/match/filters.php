<?php
/**
 * Template Part: Match Filters (TP-015)
 *
 * Combination of filter chips and tabbed grouping for match-center.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $chips   Array of { id, label, count? }.
 *     @type array<string, mixed> $tabs    Array of { id, label, panel_id }.
 *     @type string               $current Current tab id.
 *     @type string               $chip    Current chip id.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_chips   = isset( $args['chips'] ) && is_array( $args['chips'] ) ? $args['chips'] : array();
$football_factory_tabs    = isset( $args['tabs'] ) && is_array( $args['tabs'] ) ? $args['tabs'] : array();
$football_factory_current = isset( $args['current'] ) ? (string) $args['current'] : '';
$football_factory_chip    = isset( $args['chip'] ) ? (string) $args['chip'] : '';

$football_factory_label_filter = __( 'ตัวกรองการแข่งขัน', 'football-factory' );
?>
<section
	class="ff-fixtures-tabs" aria-label="
	<?php echo esc_attr( $football_factory_label_filter ); ?>
	" data-tp="match/filters" data-demo="true"
>
	<?php if ( ! empty( $football_factory_chips ) ) : ?>
		<?php
		$football_factory_arg_chips   = $football_factory_chips;
		$football_factory_arg_current = $football_factory_chip;
		$football_factory_arg_name    = 'league_filter';
		include __DIR__ . '/../ui/filter-chips.php';
		?>
	<?php endif; ?>
	<?php if ( ! empty( $football_factory_tabs ) ) : ?>
		<?php
		$football_factory_arg_tabs    = $football_factory_tabs;
		$football_factory_arg_current = $football_factory_current;
		include __DIR__ . '/../ui/tabs.php';
		?>
	<?php endif; ?>
</section>

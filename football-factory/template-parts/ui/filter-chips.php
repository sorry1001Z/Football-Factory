<?php
/**
 * Template Part: Filter Chips (TP-048)
 *
 * Single-select filter chip group (WAI-ARIA radiogroup pattern).
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $chips {
 *         Each: { id: string, label: string, count?: int }
 *     }
 *     @type string $current Currently active chip id.
 *     @type string $name    Form field name for non-JS fallback.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_chips   = isset( $args['chips'] ) && is_array( $args['chips'] ) ? $args['chips'] : array();
$football_factory_current = isset( $args['current'] ) ? (string) $args['current'] : '';
$football_factory_name    = isset( $args['name'] ) ? (string) $args['name'] : 'filter';

$football_factory_label_filter = __( 'ตัวกรอง', 'football-factory' );
?>
<div
	class="ff-filter-chips" role="radiogroup" aria-label="
	<?php echo esc_attr( $football_factory_label_filter ); ?>
	" data-tp="ui/filter-chips" data-demo="true"
>
	<?php foreach ( $football_factory_chips as $football_factory_chip ) : ?>
		<?php
		if ( ! is_array( $football_factory_chip ) ) {
			continue;
		}
		$football_factory_chip_id    = isset( $football_factory_chip['id'] )
			? (string) $football_factory_chip['id']
			: '';
		$football_factory_chip_label = isset( $football_factory_chip['label'] )
			? (string) $football_factory_chip['label']
			: '';
		$football_factory_chip_count = isset( $football_factory_chip['count'] )
			? (int) $football_factory_chip['count']
			: 0;
		if ( '' === $football_factory_chip_id || '' === $football_factory_chip_label ) {
			continue;
		}
		$football_factory_is_active = ( $football_factory_current === $football_factory_chip_id );
		?>
		<button
			type="button"
			role="radio"
			class="ff-filter-chip<?php echo $football_factory_is_active ? ' is-active' : ''; ?>"
			aria-checked="<?php echo $football_factory_is_active ? 'true' : 'false'; ?>"
			data-ff="filter-chip"
			data-chip-id="<?php echo esc_attr( $football_factory_chip_id ); ?>"
		>
			<span class="ff-filter-chip__label"><?php echo esc_html( $football_factory_chip_label ); ?></span>
			<?php if ( $football_factory_chip_count > 0 ) : ?>
				<span
					class="ff-filter-chip__count" aria-hidden="true"
				>
			<?php endif; ?>
		</button>
	<?php endforeach; ?>
	<noscript>
		<select
			name="
			<?php echo esc_attr( $football_factory_name ); ?>
			" class="ff-filter-chips__fallback" onchange="this.form.submit()"
		>
			<?php foreach ( $football_factory_chips as $football_factory_chip ) : ?>
				<?php
				if ( ! is_array( $football_factory_chip ) ) {
					continue;
				}
				$football_factory_chip_id    = isset( $football_factory_chip['id'] )
					? (string) $football_factory_chip['id']
					: '';
				$football_factory_chip_label = isset( $football_factory_chip['label'] )
					? (string) $football_factory_chip['label']
					: '';
				if ( '' === $football_factory_chip_id || '' === $football_factory_chip_label ) {
					continue;
				}
				?>
				<option
					value="
					<?php echo esc_attr( $football_factory_chip_id ); ?>
					"
					<?php selected( $football_factory_current, $football_factory_chip_id ); ?>
				>
					<?php echo esc_html( $football_factory_chip_label ); ?>
				</option>
			<?php endforeach; ?>
		</select>
	</noscript>
</div>

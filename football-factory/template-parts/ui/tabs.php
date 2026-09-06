<?php
/**
 * Template Part: Tabs (TP-047)
 *
 * WAI-ARIA tablist with roving tabindex and panel support.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $tabs {
 *         Each: { id: string, label: string, panel_id: string }
 *     }
 *     @type string $current  Currently active tab id.
 *     @type string $variant  Optional BEM variant (e.g. "fixtures-tabs").
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_tabs    = isset( $args['tabs'] ) && is_array( $args['tabs'] ) ? $args['tabs'] : array();
$football_factory_current = isset( $args['current'] ) ? (string) $args['current'] : '';
$football_factory_variant = isset( $args['variant'] ) ? (string) $args['variant'] : '';

$football_factory_label_tabs = __( 'แท็บ', 'football-factory' );
$football_factory_class      = 'ff-tabs';
if ( '' !== $football_factory_variant ) {
	$football_factory_class .= ' ff-tabs--' . sanitize_html_class( $football_factory_variant );
}
?>
<div class="<?php echo esc_attr( $football_factory_class ); ?>" data-tp="ui/tabs" data-demo="true">
	<div class="ff-tabs__list" role="tablist" aria-label="<?php echo esc_attr( $football_factory_label_tabs ); ?>">
		<?php
		$football_factory_idx = 0;
		foreach ( $football_factory_tabs as $football_factory_tab ) :
			if ( ! is_array( $football_factory_tab ) ) {
				continue;
			}
			++$football_factory_idx;
			$football_factory_tab_id    = isset( $football_factory_tab['id'] )
				? (string) $football_factory_tab['id']
				: '';
			$football_factory_tab_label = isset( $football_factory_tab['label'] )
				? (string) $football_factory_tab['label']
				: '';
			$football_factory_tab_panel = isset( $football_factory_tab['panel_id'] )
				? (string) $football_factory_tab['panel_id']
				: '';
			if ( '' === $football_factory_tab_id || '' === $football_factory_tab_label ) {
				continue;
			}
			$football_factory_is_selected = (
				'' !== $football_factory_current
				&& $football_factory_current === $football_factory_tab_id
				);
			?>
			<button
				type="button"
				role="tab"
				id="tab-<?php echo esc_attr( $football_factory_tab_id ); ?>"
				class="ff-tabs__tab<?php echo $football_factory_is_selected ? ' is-active' : ''; ?>"
				aria-selected="<?php echo $football_factory_is_selected ? 'true' : 'false'; ?>"
				aria-controls="
				<?php
					echo esc_attr(
						$football_factory_tab_panel
							? $football_factory_tab_panel
							: 'panel-' . $football_factory_tab_id
					);
				?>
				"
				tabindex="<?php echo $football_factory_is_selected ? '0' : '-1'; ?>"
				data-ff="tab"
				data-tab-id="<?php echo esc_attr( $football_factory_tab_id ); ?>"
			>
				<?php echo esc_html( $football_factory_tab_label ); ?>
			</button>
		<?php endforeach; ?>
	</div>
</div>

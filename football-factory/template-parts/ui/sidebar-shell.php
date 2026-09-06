<?php
/**
 * Template Part: Sidebar Shell (TP-053)
 *
 * Generic sidebar container that renders a stack of children template parts.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $children Array of { slug: string, name?: string, args: array }.
 *     @type string $variant Sidebar variant (home, article, league).
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_children = isset( $args['children'] ) && is_array( $args['children'] ) ? $args['children'] : array();
$football_factory_variant  = isset( $args['variant'] ) ? (string) $args['variant'] : '';

$football_factory_label_sidebar = __( 'แถบข้าง', 'football-factory' );

$football_factory_class = 'ff-sidebar';
if ( '' !== $football_factory_variant ) {
	$football_factory_class .= ' ff-sidebar--' . sanitize_html_class( $football_factory_variant );
}
?>
<aside
	class="
	<?php echo esc_attr( $football_factory_class ); ?>
	" aria-label="
	<?php echo esc_attr( $football_factory_label_sidebar ); ?>
	" data-tp="ui/sidebar-shell" data-demo="true"
>
	<?php
	if ( empty( $football_factory_children ) ) :
		echo '<!-- ff-sidebar-shell: no children supplied -->';
	else :
		foreach ( $football_factory_children as $football_factory_child ) :
			if ( ! is_array( $football_factory_child ) ) {
				continue;
			}
			$football_factory_child_slug = isset( $football_factory_child['slug'] )
				? (string) $football_factory_child['slug']
				: '';
			$football_factory_child_name = isset( $football_factory_child['name'] )
				? (string) $football_factory_child['name']
				: null;
			$football_factory_child_args =
				isset( $football_factory_child['args'] )
				&& is_array( $football_factory_child['args'] )
				? $football_factory_child['args']
				: array();
			if ( '' === $football_factory_child_slug ) {
				continue;
			}
			?>
			<div
				class="ff-sidebar__block" data-ff-sidebar-block="
				<?php echo esc_attr( $football_factory_child_slug ); ?>
				"
			>
				<?php
				if ( null !== $football_factory_child_name ) {
					get_template_part(
						'template-parts/' . $football_factory_child_slug,
						$football_factory_child_name,
						$football_factory_child_args
					);
				} else {
					get_template_part(
						'template-parts/' . $football_factory_child_slug,
						null,
						$football_factory_child_args
					);
				}
				?>
			</div>
			<?php
		endforeach;
	endif;
	?>
</aside>

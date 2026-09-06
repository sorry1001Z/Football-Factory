<?php
/**
 * Template Part: Bottom Navigation (TP-003)
 *
 * Persistent mobile bottom tab bar with 5 primary destinations.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $nav Bottom nav items (max 5).
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_nav = isset( $args['nav'] ) && is_array( $args['nav'] ) ? $args['nav'] : array();

$football_factory_label_bottom = __( 'เมนูด้านล่าง', 'football-factory' );
?>
<nav
	class="ff-bottom-nav" aria-label="
	<?php echo esc_attr( $football_factory_label_bottom ); ?>
	" data-tp="header/bottom-nav" data-demo="true"
>
	<ul class="ff-bottom-nav__list">
		<?php
		$football_factory_idx = 0;
		foreach ( $football_factory_nav as $football_factory_item ) :
			if ( ! is_array( $football_factory_item ) ) {
				continue;
			}
			if ( $football_factory_idx >= 5 ) {
				break;
			}
			++$football_factory_idx;
			$football_factory_item_label  = isset( $football_factory_item['label'] )
				? (string) $football_factory_item['label']
				: '';
			$football_factory_item_url    = isset( $football_factory_item['url'] )
				? (string) $football_factory_item['url']
				: '#';
			$football_factory_item_icon   = isset( $football_factory_item['icon'] )
				? (string) $football_factory_item['icon']
				: 'home';
			$football_factory_item_active = isset( $football_factory_item['current'] )
				? (bool) $football_factory_item['current']
				: false;
			if ( '' === $football_factory_item_label ) {
				continue;
			}
			?>
			<li class="ff-bottom-nav__item">
				<a
					class="ff-bottom-nav__link<?php echo $football_factory_item_active ? ' is-active' : ''; ?>" href="
					<?php echo esc_url( $football_factory_item_url ); ?>
					" <?php echo $football_factory_item_active ? 'aria-current="page"' : ''; ?>
				>
					<svg class="ff-bottom-nav__icon" width="22" height="22" aria-hidden="true">
						<use href="#i-<?php echo esc_attr( $football_factory_item_icon ); ?>"/>
					</svg>
					<span class="ff-bottom-nav__label"><?php echo esc_html( $football_factory_item_label ); ?></span>
				</a>
			</li>
		<?php endforeach; ?>
	</ul>
</nav>

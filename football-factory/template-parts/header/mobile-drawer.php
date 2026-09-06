<?php
/**
 * Template Part: Mobile Drawer (TP-002)
 *
 * Off-canvas mobile navigation drawer with backdrop and full menu.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $nav   Mobile nav items.
 *     @type array<string, mixed> $brand Brand view-model.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_nav   = isset( $args['nav'] ) && is_array( $args['nav'] ) ? $args['nav'] : array();
$football_factory_brand = isset( $args['brand'] ) && is_array( $args['brand'] ) ? $args['brand'] : array();

$football_factory_brand_name   = isset( $football_factory_brand['name'] )
	? (string) $football_factory_brand['name']
	: 'Football Factory';
$football_factory_label_menu   = __( 'เมนู', 'football-factory' );
$football_factory_label_close  = __( 'ปิดเมนู', 'football-factory' );
$football_factory_label_mobile = __( 'เมนูมือถือ', 'football-factory' );
?>
<div
	class="ff-drawer" data-drawer role="dialog" aria-modal="true" aria-label="
	<?php echo esc_attr( $football_factory_label_menu ); ?>
	" data-tp="header/mobile-drawer" data-demo="true"
>
	<div class="ff-drawer__backdrop" data-drawer-close></div>
	<div class="ff-drawer__panel">
		<div class="ff-drawer__head">
			<a class="ff-logo" href="<?php echo esc_url( home_url( '/' ) ); ?>">
				<span class="ff-logo__mark" aria-hidden="true">F</span>
				<span class="ff-logo__text">
					<strong>FOOTBALL<br/>FACTORY</strong>
				</span>
			</a>
			<button
				type="button" class="ff-icon-btn" data-drawer-close aria-label="
				<?php echo esc_attr( $football_factory_label_close ); ?>
				"
			>
				<svg width="22" height="22" aria-hidden="true"><use href="#i-close"/></svg>
			</button>
		</div>
		<nav class="ff-drawer__nav" aria-label="<?php echo esc_attr( $football_factory_label_mobile ); ?>">
			<?php foreach ( $football_factory_nav as $football_factory_item ) : ?>
				<?php
				if ( ! is_array( $football_factory_item ) ) {
					continue;
				}
				$football_factory_item_label  = isset( $football_factory_item['label'] )
					? (string) $football_factory_item['label']
					: '';
				$football_factory_item_url    = isset( $football_factory_item['url'] )
					? (string) $football_factory_item['url']
					: '#';
				$football_factory_item_active = isset( $football_factory_item['current'] )
					? (bool) $football_factory_item['current']
					: false;
				if ( '' === $football_factory_item_label ) {
					continue;
				}
				?>
				<a
					href="
					<?php echo esc_url( $football_factory_item_url ); ?>
					" data-nav <?php echo $football_factory_item_active ? 'aria-current="page"' : ''; ?>
				>
					<?php echo esc_html( $football_factory_item_label ); ?>
				</a>
			<?php endforeach; ?>
		</nav>
	</div>
</div>

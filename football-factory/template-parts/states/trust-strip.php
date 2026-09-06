<?php
/**
 * Template Part: Trust Strip (TP-051)
 *
 * Trust-strip composition with credentials, sources, and disclaimers.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $items {
 *         Each: { icon: string, label: string }
 *     }
 *     @type string $disclaimer Disclaimer text.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_items      = isset( $args['items'] ) && is_array( $args['items'] ) ? $args['items'] : array();
$football_factory_disclaimer = isset( $args['disclaimer'] )
	? (string) $args['disclaimer']
	: __( 'ข้อมูลตัวอย่าง — ไม่ใช่ข้อมูลจริง (DEMO)', 'football-factory' );

$football_factory_label_trust = __( 'แถบความน่าเชื่อถือ', 'football-factory' );

// Provide a default set of trust signals if none supplied.
if ( empty( $football_factory_items ) ) {
	$football_factory_items = array(
		array(
			'icon'  => 'shield',
			'label' => __( 'ข้อมูลจากแหล่งที่เชื่อถือได้', 'football-factory' ),
		),
		array(
			'icon'  => 'globe',
			'label' => __( 'อัปเดตทุกนาที', 'football-factory' ),
		),
		array(
			'icon'  => 'lock',
			'label' => __( 'ความเป็นส่วนตัว', 'football-factory' ),
		),
		array(
			'icon'  => 'star',
			'label' => __( 'คุณภาพระดับมืออาชีพ', 'football-factory' ),
		),
	);
}
?>
<aside
	class="ff-trust" aria-label="
	<?php echo esc_attr( $football_factory_label_trust ); ?>
	" data-tp="states/trust-strip" data-demo="true"
>
	<ul class="ff-trust__list">
		<?php foreach ( $football_factory_items as $football_factory_item ) : ?>
			<?php
			if ( ! is_array( $football_factory_item ) ) {
				continue;
			}
			$football_factory_item_icon  = isset( $football_factory_item['icon'] )
				? (string) $football_factory_item['icon']
				: 'check';
			$football_factory_item_label = isset( $football_factory_item['label'] )
				? (string) $football_factory_item['label']
				: '';
			if ( '' === $football_factory_item_label ) {
				continue;
			}
			?>
			<li class="ff-trust__item">
				<svg
					class="ff-trust__icon" width="20" height="20" aria-hidden="true"
				>
				<span class="ff-trust__label"><?php echo esc_html( $football_factory_item_label ); ?></span>
			</li>
		<?php endforeach; ?>
	</ul>
	<?php if ( '' !== $football_factory_disclaimer ) : ?>
		<p class="ff-trust__disclaimer"><?php echo esc_html( $football_factory_disclaimer ); ?></p>
	<?php endif; ?>
</aside>

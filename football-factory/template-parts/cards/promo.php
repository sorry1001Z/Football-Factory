<?php
/**
 * Template Part: Promo Card (TP-042)
 *
 * Sidebar promotion card with image area, body, and CTA.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $card {
 *         @type string $title     Promo title.
 *         @type string $body      Promo body.
 *         @type string $cta_label CTA label.
 *         @type string $cta_url   CTA URL.
 *         @type string $palette   Background palette.
 *         @type string $badge     Optional badge.
 *     }
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_card = isset( $args['card'] ) && is_array( $args['card'] ) ? $args['card'] : array();
if (
	empty( $football_factory_card )
	&& isset( $football_factory_arg_card )
	&& is_array( $football_factory_arg_card )
	) {
	$football_factory_card = $football_factory_arg_card;
}

$football_factory_title = isset( $football_factory_card['title'] ) ? (string) $football_factory_card['title'] : '';
$football_factory_body  = isset( $football_factory_card['body'] ) ? (string) $football_factory_card['body'] : '';
$football_factory_cta_l = isset( $football_factory_card['cta_label'] )
	? (string) $football_factory_card['cta_label']
	: '';
$football_factory_cta_u = isset( $football_factory_card['cta_url'] ) ? (string) $football_factory_card['cta_url'] : '#';
$football_factory_pal   = isset( $football_factory_card['palette'] ) ? (string) $football_factory_card['palette'] : '';
$football_factory_badge = isset( $football_factory_card['badge'] ) ? (string) $football_factory_card['badge'] : '';

if ( '' === $football_factory_title && '' === $football_factory_body ) {
	return;
}
?>
<aside class="ff-showcase ff-promo" data-tp="cards/promo" data-demo="true">
	<div
	>
		<?php if ( '' !== $football_factory_badge ) : ?>
			<span
				class="ff-badge ff-badge--brand ff-promo__badge"
			>
		<?php endif; ?>
	</div>
	<div class="ff-promo__body">
		<?php if ( '' !== $football_factory_title ) : ?>
			<h3 class="ff-promo__title"><?php echo esc_html( $football_factory_title ); ?></h3>
		<?php endif; ?>
		<?php if ( '' !== $football_factory_body ) : ?>
			<p class="ff-promo__body-text"><?php echo esc_html( $football_factory_body ); ?></p>
		<?php endif; ?>
		<?php if ( '' !== $football_factory_cta_l ) : ?>
			<a
				class="ff-btn ff-btn--primary ff-promo__cta" href="
				<?php echo esc_url( $football_factory_cta_u ); ?>
				"
			>
		<?php endif; ?>
	</div>
</aside>

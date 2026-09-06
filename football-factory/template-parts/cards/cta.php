<?php
/**
 * Template Part: Call to Action (TP-040)
 *
 * Generic CTA card with title, body, primary and secondary actions.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $card {
 *         @type string $title       CTA title.
 *         @type string $body        CTA body text.
 *         @type string $primary_label Primary action label.
 *         @type string $primary_url    Primary action URL.
 *         @type string $secondary_label Secondary action label.
 *         @type string $secondary_url    Secondary action URL.
 *         @type string $icon        Optional icon.
 *         @type string $variant     Style variant: primary | brand | ghost.
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

$football_factory_title     = isset( $football_factory_card['title'] ) ? (string) $football_factory_card['title'] : '';
$football_factory_body      = isset( $football_factory_card['body'] ) ? (string) $football_factory_card['body'] : '';
$football_factory_primary_l = isset( $football_factory_card['primary_label'] )
	? (string) $football_factory_card['primary_label']
	: '';
$football_factory_primary_u = isset( $football_factory_card['primary_url'] )
	? (string) $football_factory_card['primary_url']
	: '#';
$football_factory_second_l  = isset( $football_factory_card['secondary_label'] )
	? (string) $football_factory_card['secondary_label']
	: '';
$football_factory_second_u  = isset( $football_factory_card['secondary_url'] )
	? (string) $football_factory_card['secondary_url']
	: '#';
$football_factory_icon      = isset( $football_factory_card['icon'] ) ? (string) $football_factory_card['icon'] : '';
$football_factory_variant   = isset( $football_factory_card['variant'] )
	? (string) $football_factory_card['variant']
	: 'primary';

$football_factory_class = 'ff-cta ff-cta--' . sanitize_html_class( $football_factory_variant );
?>
<aside class="<?php echo esc_attr( $football_factory_class ); ?>" data-tp="cards/cta" data-demo="true">
	<?php if ( '' !== $football_factory_icon ) : ?>
		<svg
			class="ff-cta__icon" width="32" height="32" aria-hidden="true"
		>
	<?php endif; ?>
	<?php if ( '' !== $football_factory_title ) : ?>
		<h2 class="ff-cta__title"><?php echo esc_html( $football_factory_title ); ?></h2>
	<?php endif; ?>
	<?php if ( '' !== $football_factory_body ) : ?>
		<p class="ff-cta__body"><?php echo esc_html( $football_factory_body ); ?></p>
	<?php endif; ?>
	<div class="ff-cta__actions">
		<?php if ( '' !== $football_factory_primary_l ) : ?>
			<a
				class="ff-btn ff-btn--primary" href="
				<?php echo esc_url( $football_factory_primary_u ); ?>
				"
			>
		<?php endif; ?>
		<?php if ( '' !== $football_factory_second_l ) : ?>
			<a
				class="ff-btn ff-btn--ghost" href="
				<?php echo esc_url( $football_factory_second_u ); ?>
				"
			>
		<?php endif; ?>
	</div>
</aside>

<?php
/**
 * Template Part: Skeleton (TP-050)
 *
 * Loading skeleton block for content placeholders.
 *
 * @var array<string, mixed> $args {
 *     @type string $variant Variant: card | row | list | text | block.
 *     @type int    $count   Number of skeleton lines (text variant).
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_variant = isset( $args['variant'] ) ? (string) $args['variant'] : 'block';
$football_factory_count   = isset( $args['count'] ) ? (int) $args['count'] : 3;
if ( $football_factory_count < 1 ) {
	$football_factory_count = 1;
}
if ( $football_factory_count > 12 ) {
	$football_factory_count = 12;
}

$football_factory_class = 'ff-skel ff-skel--' . sanitize_html_class( $football_factory_variant );
?>
<div
	class="
	<?php echo esc_attr( $football_factory_class ); ?>
	" data-tp="states/skeleton" data-demo="true" aria-busy="true" aria-live="polite" aria-label="
	<?php esc_attr_e( 'กำลังโหลด', 'football-factory' ); ?>
	"
>
	<?php if ( 'text' === $football_factory_variant ) : ?>
		<?php for ( $football_factory_i = 0; $football_factory_i < $football_factory_count; $football_factory_i++ ) : ?>
			<span
				class="ff-skel__line" style="width:
				<?php echo (int) ( 100 - ( $football_factory_i * 8 ) ); ?>
				%"
			>
		<?php endfor; ?>
	<?php elseif ( 'list' === $football_factory_variant ) : ?>
		<?php for ( $football_factory_i = 0; $football_factory_i < $football_factory_count; $football_factory_i++ ) : ?>
			<div class="ff-skel__row">
				<span class="ff-skel__thumb"></span>
				<span class="ff-skel__line" style="width: 70%"></span>
			</div>
		<?php endfor; ?>
	<?php else : ?>
		<div class="ff-skel__block"></div>
	<?php endif; ?>
</div>

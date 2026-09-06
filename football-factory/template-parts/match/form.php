<?php
/**
 * Template Part: Form (TP-016)
 *
 * Last-5-results form indicator.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $form   Array of W/D/L letters.
 *     @type string               $label  Optional team label.
 *     @type string               $size   Size variant: '' | 'sm'.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_form  = isset( $args['form'] ) && is_array( $args['form'] ) ? $args['form'] : array();
$football_factory_label = isset( $args['label'] ) ? (string) $args['label'] : '';
$football_factory_size  = isset( $args['size'] ) ? (string) $args['size'] : '';

$football_factory_label_form = __( 'ฟอร์ม 5 นัดล่าสุด', 'football-factory' );
$football_factory_size_class = '' !== $football_factory_size
	? ' ff-form--' . sanitize_html_class( $football_factory_size )
	: '';
?>
<div
	class="ff-form<?php echo esc_attr( $football_factory_size_class ); ?>"
	data-tp="match/form"
	data-demo="true"
	role="list"
	aria-label="
	<?php
		echo esc_attr(
			'' !== $football_factory_label
				? $football_factory_label . ' — ' . $football_factory_label_form
				: $football_factory_label_form
		);
		?>
	"
>
	<?php if ( empty( $football_factory_form ) ) : ?>
		<span class="ff-form__empty">—</span>
	<?php else : ?>
		<?php foreach ( $football_factory_form as $football_factory_letter ) : ?>
			<?php
			$football_factory_letter_str = is_string( $football_factory_letter )
				? strtoupper( substr( $football_factory_letter, 0, 1 ) )
				: '';
			if ( ! in_array( $football_factory_letter_str, array( 'W', 'D', 'L' ), true ) ) {
				continue;
			}
			$football_factory_letter_label = 'W' === $football_factory_letter_str
				? __( 'ชนะ', 'football-factory' )
				: (
				'D' === $football_factory_letter_str
					? __( 'เสมอ', 'football-factory' )
					: __( 'แพ้', 'football-factory' )
				);
			?>
			<span
				class="ff-form__cell ff-form__cell--
				<?php echo esc_attr( strtolower( $football_factory_letter_str ) ); ?>
				" role="listitem" aria-label="
				<?php echo esc_attr( $football_factory_letter_label ); ?>
				" title="
				<?php echo esc_attr( $football_factory_letter_label ); ?>
				"
			>
		<?php endforeach; ?>
	<?php endif; ?>
</div>

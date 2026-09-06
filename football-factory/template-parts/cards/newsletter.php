<?php
/**
 * Template Part: Newsletter (TP-041)
 *
 * Email signup card with form, privacy notice, and benefits list.
 *
 * @var array<string, mixed> $args {
 *     @type string $title       Card title.
 *     @type string $body        Card body text.
 *     @type string $placeholder Email input placeholder.
 *     @type string $submit      Submit button label.
 *     @type string $privacy_url Privacy policy URL.
 *     @type array  $benefits    Optional array of bullet strings.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_title       = isset( $args['title'] )
	? (string) $args['title']
	: __( 'สมัครรับข่าวสาร', 'football-factory' );
$football_factory_body        = isset( $args['body'] )
	? (string) $args['body']
	: __( 'รับข่าวสารและอัปเดตกีฬาฟุตบอลล่าสุดทุกวัน', 'football-factory' );
$football_factory_placeholder = isset( $args['placeholder'] )
	? (string) $args['placeholder']
	: __( 'อีเมลของคุณ', 'football-factory' );
$football_factory_submit      = isset( $args['submit'] ) ? (string) $args['submit'] : __( 'สมัคร', 'football-factory' );
$football_factory_privacy_url = isset( $args['privacy_url'] ) ? (string) $args['privacy_url'] : '#';
$football_factory_benefits    = isset( $args['benefits'] ) && is_array( $args['benefits'] )
	? $args['benefits']
	: array();

$football_factory_id         = 'ff-newsletter-' . wp_unique_id();
$football_factory_label_aria = __( 'แบบฟอร์มสมัครรับข่าวสาร', 'football-factory' );
$football_factory_label_priv = __( 'นโยบายความเป็นส่วนตัว', 'football-factory' );
?>
<aside
	class="ff-newsletter" data-tp="cards/newsletter" data-demo="true" aria-label="
	<?php echo esc_attr( $football_factory_label_aria ); ?>
	"
>
	<h2 class="ff-newsletter__title"><?php echo esc_html( $football_factory_title ); ?></h2>
	<p class="ff-newsletter__body"><?php echo esc_html( $football_factory_body ); ?></p>
	<form class="ff-newsletter__form" action="#" method="post" novalidate>
		<label
			class="ff-sr" for="
			<?php echo esc_attr( $football_factory_id ); ?>
			"
		>
		<input
			id="
			<?php echo esc_attr( $football_factory_id ); ?>
			" type="email" name="email" class="ff-newsletter__input" placeholder="
			<?php echo esc_attr( $football_factory_placeholder ); ?>
			" required autocomplete="email" /
		>
		<button
			type="submit" class="ff-btn ff-btn--primary ff-newsletter__submit"
		>
	</form>
	<?php if ( ! empty( $football_factory_benefits ) ) : ?>
		<ul class="ff-newsletter__benefits">
			<?php foreach ( $football_factory_benefits as $football_factory_benefit ) : ?>
				<?php
				$football_factory_benefit_str = is_string( $football_factory_benefit )
					? $football_factory_benefit
				: (
					is_array( $football_factory_benefit )
					&& isset( $football_factory_benefit['label'] )
					? (string) $football_factory_benefit['label']
					: ''
				);
				if ( '' === $football_factory_benefit_str ) {
					continue;
				}
				?>
				<li
				>
			<?php endforeach; ?>
		</ul>
	<?php endif; ?>
	<p class="ff-newsletter__privacy">
		<a
			href="
			<?php echo esc_url( $football_factory_privacy_url ); ?>
			"
		>
	</p>
</aside>

<?php
/**
 * Template Part: 404 Error (TP-052)
 *
 * 404 fallback content block with hero number, message, and CTAs.
 *
 * @var array<string, mixed> $args {
 *     @type string $title   Page title.
 *     @type string $message Friendly error message.
 *     @type array  $ctas    Array of { label: string, url: string }.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_title   = isset( $args['title'] )
	? (string) $args['title']
	: __( 'ไม่พบหน้าที่ค้นหา', 'football-factory' );
$football_factory_message = isset( $args['message'] )
	? (string) $args['message']
	: __( 'หน้าที่คุณกำลังมองหาอาจถูกย้าย เปลี่ยนชื่อ หรือไม่มีอยู่แล้ว', 'football-factory' );
$football_factory_ctas    = isset( $args['ctas'] ) && is_array( $args['ctas'] ) ? $args['ctas'] : array();

$football_factory_label_back   = __( 'กลับหน้าแรก', 'football-factory' );
$football_factory_label_search = __( 'ค้นหา', 'football-factory' );
?>
<section class="ff-404" data-tp="states/error-404" data-demo="true" role="alert" aria-labelledby="ff-404-title">
	<div class="ff-404__inner">
		<div class="ff-404__media" aria-hidden="true">404</div>
		<h1 id="ff-404-title" class="ff-404__title"><?php echo esc_html( $football_factory_title ); ?></h1>
		<p class="ff-404__message"><?php echo esc_html( $football_factory_message ); ?></p>
		<div class="ff-404__actions">
			<a
				class="ff-btn ff-btn--primary" href="
				<?php echo esc_url( home_url( '/' ) ); ?>
				"
			>
			<a
				class="ff-btn ff-btn--secondary" href="
				<?php echo esc_url( home_url( '/search' ) ); ?>
				"
			>
			<?php foreach ( $football_factory_ctas as $football_factory_cta ) : ?>
				<?php
				if ( ! is_array( $football_factory_cta ) ) {
					continue;
				}
				$football_factory_cta_label = isset( $football_factory_cta['label'] )
					? (string) $football_factory_cta['label']
					: '';
				$football_factory_cta_url   = isset( $football_factory_cta['url'] )
					? (string) $football_factory_cta['url']
					: '#';
				if ( '' === $football_factory_cta_label ) {
					continue;
				}
				?>
				<a
					class="ff-btn ff-btn--ghost" href="
					<?php echo esc_url( $football_factory_cta_url ); ?>
					"
				>
			<?php endforeach; ?>
		</div>
	</div>
</section>

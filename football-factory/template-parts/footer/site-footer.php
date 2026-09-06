<?php
/**
 * Template Part: Site Footer (TP-004)
 *
 * Persistent site footer with brand, link columns, social, and legal.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $brand  Brand view-model.
 *     @type array<string, mixed> $links  Footer link groups.
 *     @type array<string, mixed> $social Social profile links.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_brand  = isset( $args['brand'] ) && is_array( $args['brand'] ) ? $args['brand'] : array();
$football_factory_links  = isset( $args['links'] ) && is_array( $args['links'] ) ? $args['links'] : array();
$football_factory_social = isset( $args['social'] ) && is_array( $args['social'] ) ? $args['social'] : array();

$football_factory_brand_name      = isset( $football_factory_brand['name'] )
	? (string) $football_factory_brand['name']
	: 'Football Factory';
$football_factory_brand_blurb     = isset( $football_factory_brand['blurb'] )
	? (string) $football_factory_brand['blurb']
	: 'ศูนย์รวมข่าวบอล ผลบอล ตารางคะแนน และวิเคราะห์ AI จากทุกลีกชั้นนำทั่วโลก (DEMO)';
$football_factory_label_social    = __( 'โซเชียล', 'football-factory' );
$football_factory_label_copyright = __( '© สงวนลิขสิทธิ์', 'football-factory' );
$football_factory_label_demo      = __( '(ข้อมูลตัวอย่าง — ไม่ใช่ข้อมูลจริง)', 'football-factory' );
?>
<footer class="ff-footer" role="contentinfo" data-tp="footer/site-footer" data-demo="true">
	<div class="ff-container">
		<div class="ff-footer__grid">
			<div class="ff-footer__col ff-footer__col--brand">
				<a class="ff-logo" href="<?php echo esc_url( home_url( '/' ) ); ?>" style="color:#fff">
					<span class="ff-logo__mark"
						style="background:var(--ff-brand-500);color:var(--ff-ink-900)"
						aria-hidden="true">F</span>
					<span class="ff-logo__text"><strong
						style="color:var(--ff-white)">FOOTBALL<br/>FACTORY</strong></span>
				</a>
				<p class="ff-footer__brand"><?php echo esc_html( $football_factory_brand_blurb ); ?></p>
				<?php if ( ! empty( $football_factory_social ) ) : ?>
					<div
						class="ff-footer__socials" style="margin-top:16px" aria-label="
						<?php echo esc_attr( $football_factory_label_social ); ?>
						"
					>
						<?php foreach ( $football_factory_social as $football_factory_s ) : ?>
							<?php
							if ( ! is_array( $football_factory_s ) ) {
								continue;
							}
							$football_factory_s_url   = isset( $football_factory_s['url'] )
								? (string) $football_factory_s['url']
								: '#';
							$football_factory_s_label = isset( $football_factory_s['label'] )
								? (string) $football_factory_s['label']
								: '';
							$football_factory_s_icon  = isset( $football_factory_s['icon'] )
								? (string) $football_factory_s['icon']
								: 'globe';
							if ( '' === $football_factory_s_label ) {
								continue;
							}
							?>
							<a
								href="
								<?php echo esc_url( $football_factory_s_url ); ?>
								" aria-label="
								<?php echo esc_attr( $football_factory_s_label ); ?>
								" rel="noopener" target="_blank"
							>
								<svg
									width="16" height="16" aria-hidden="true"
								>
							</a>
						<?php endforeach; ?>
					</div>
				<?php endif; ?>
			</div>
			<?php foreach ( $football_factory_links as $football_factory_group ) : ?>
				<?php
				if ( ! is_array( $football_factory_group ) ) {
					continue;
				}
				$football_factory_group_title = isset( $football_factory_group['title'] )
					? (string) $football_factory_group['title']
					: '';
				$football_factory_group_items =
					isset( $football_factory_group['items'] )
					&& is_array( $football_factory_group['items'] )
					? $football_factory_group['items']
					: array();
				if ( '' === $football_factory_group_title || empty( $football_factory_group_items ) ) {
					continue;
				}
				?>
				<div class="ff-footer__col">
					<h3 class="ff-footer__heading"><?php echo esc_html( $football_factory_group_title ); ?></h3>
					<ul class="ff-footer__list">
						<?php foreach ( $football_factory_group_items as $football_factory_link ) : ?>
							<?php
							if ( ! is_array( $football_factory_link ) ) {
								continue;
							}
							$football_factory_link_label = isset( $football_factory_link['label'] )
								? (string) $football_factory_link['label']
								: '';
							$football_factory_link_url   = isset( $football_factory_link['url'] )
								? (string) $football_factory_link['url']
								: '#';
							if ( '' === $football_factory_link_label ) {
								continue;
							}
							?>
							<li
							>
						<?php endforeach; ?>
					</ul>
				</div>
			<?php endforeach; ?>
		</div>
		<div class="ff-footer__bottom">
			<span
			>
		</div>
	</div>
</footer>

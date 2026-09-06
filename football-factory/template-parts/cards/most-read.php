<?php
/**
 * Template Part: Most Read (TP-043)
 *
 * Most-read sidebar list. Numbered, with thumbs.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $items Array of { title, url, views?, meta? }.
 *     @type string               $title Section title.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_items = isset( $args['items'] ) && is_array( $args['items'] ) ? $args['items'] : array();
$football_factory_title = isset( $args['title'] ) ? (string) $args['title'] : __( 'อ่านมากที่สุด', 'football-factory' );

$football_factory_label_empty = __( 'ยังไม่มีข้อมูล', 'football-factory' );
$football_factory_label_list  = __( 'รายการอ่านมากที่สุด', 'football-factory' );
$football_factory_label_views = __( 'เข้าชม', 'football-factory' );
?>
<aside class="ff-sidebar__block ff-most-read" data-tp="cards/most-read" data-demo="true">
	<div class="ff-sidebar__title">
		<span><?php echo esc_html( $football_factory_title ); ?></span>
	</div>
	<?php if ( empty( $football_factory_items ) ) : ?>
		<p class="ff-sidebar__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<ol
			class="ff-sidebar__list ff-sidebar__list--ranked" aria-label="
			<?php echo esc_attr( $football_factory_label_list ); ?>
			"
		>
			<?php
			$football_factory_rank = 0;
			foreach ( $football_factory_items as $football_factory_item ) :
				if ( ! is_array( $football_factory_item ) ) {
					continue;
				}
				++$football_factory_rank;
				$football_factory_item_title = isset( $football_factory_item['title'] )
					? (string) $football_factory_item['title']
					: '';
				$football_factory_item_url   = isset( $football_factory_item['url'] )
					? (string) $football_factory_item['url']
					: '#';
				$football_factory_item_views = isset( $football_factory_item['views'] )
					? (int) $football_factory_item['views']
					: 0;
				$football_factory_item_meta  = isset( $football_factory_item['meta'] )
					? (string) $football_factory_item['meta']
					: '';
				$football_factory_item_pal   = isset( $football_factory_item['palette'] )
					? (string) $football_factory_item['palette']
					: '';
				if ( '' === $football_factory_item_title ) {
					continue;
				}
				?>
				<li class="ff-sidebar__list-item">
					<a class="ff-sidebar__list-link" href="<?php echo esc_url( $football_factory_item_url ); ?>">
						<span
							class="ff-sidebar__rank" aria-hidden="true"
						>
						<span
						>
						<span class="ff-sidebar__list-text">
							<span
								class="ff-sidebar__list-title"
							>
							<?php if ( $football_factory_item_views > 0 || '' !== $football_factory_item_meta ) : ?>
								<span class="ff-sidebar__list-meta">
									<?php if ( $football_factory_item_views > 0 ) : ?>
										<?php
											echo esc_html(
												number_format_i18n( $football_factory_item_views )
												. ' '
												. $football_factory_label_views
											);
										?>
									<?php endif; ?>
									<?php if ( '' !== $football_factory_item_meta ) : ?>
										<?php if ( $football_factory_item_views > 0 ) : ?>
									· <?php endif; ?>
										<?php echo esc_html( $football_factory_item_meta ); ?>
									<?php endif; ?>
								</span>
							<?php endif; ?>
						</span>
					</a>
				</li>
			<?php endforeach; ?>
		</ol>
	<?php endif; ?>
</aside>

<?php
/**
 * Template Part: Related News (TP-009)
 *
 * Sidebar block listing related news articles using news-card.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $items Array of NewsCardViewModel.
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
$football_factory_title = isset( $args['title'] )
	? (string) $args['title']
	: __( 'ข่าวที่เกี่ยวข้อง', 'football-factory' );

$football_factory_label_empty = __( 'ไม่มีข่าวที่เกี่ยวข้อง', 'football-factory' );
$football_factory_label_list  = __( 'รายการข่าว', 'football-factory' );
?>
<aside class="ff-sidebar__block ff-related-news" data-tp="article/related-news" data-demo="true">
	<div class="ff-sidebar__title">
		<span><?php echo esc_html( $football_factory_title ); ?></span>
	</div>
	<?php if ( empty( $football_factory_items ) ) : ?>
		<p class="ff-sidebar__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<ul
			class="ff-sidebar__list" aria-label="
			<?php echo esc_attr( $football_factory_title . ' — ' . $football_factory_label_list ); ?>
			"
		>
			<?php foreach ( $football_factory_items as $football_factory_item ) : ?>
				<?php
				if ( ! is_array( $football_factory_item ) ) {
					continue;
				}
				$football_factory_arg_card    = $football_factory_item;
				$football_factory_arg_variant = 'compact';
				?>
				<li class="ff-sidebar__list-item">
					<?php include __DIR__ . '/../news/news-card.php'; ?>
				</li>
			<?php endforeach; ?>
		</ul>
	<?php endif; ?>
</aside>

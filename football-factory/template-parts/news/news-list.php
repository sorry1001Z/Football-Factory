<?php
/**
 * Template Part: News List (TP-005)
 *
 * Reusable news feed loop. Renders a section with title and a list of
 * news-card template parts.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $items   Array of NewsCardViewModel.
 *     @type string               $title  Section title.
 *     @type string               $more_url "View all" link URL.
 *     @type string               $more_label "View all" link text.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_items       = isset( $args['items'] ) && is_array( $args['items'] ) ? $args['items'] : array();
$football_factory_title       = isset( $args['title'] )
	? (string) $args['title']
	: __( 'ข่าวล่าสุด', 'football-factory' );
$football_factory_more_url    = isset( $args['more_url'] ) ? (string) $args['more_url'] : '';
$football_factory_more_lbl    = isset( $args['more_label'] )
	? (string) $args['more_label']
	: __( 'ดูทั้งหมด', 'football-factory' );
$football_factory_label_news  = __( 'รายการข่าว', 'football-factory' );
$football_factory_label_empty = __( 'ยังไม่มีข่าวในขณะนี้', 'football-factory' );
?>
<section
	class="ff-section ff-news-list-section" aria-label="
	<?php echo esc_attr( $football_factory_title ); ?>
	" data-tp="news/news-list" data-demo="true"
>
	<div class="ff-section-head">
		<h2 class="ff-section-title"><?php echo esc_html( $football_factory_title ); ?></h2>
		<?php if ( '' !== $football_factory_more_url ) : ?>
			<a
				class="ff-section-link" href="
				<?php echo esc_url( $football_factory_more_url ); ?>
				" aria-label="
				<?php echo esc_attr( $football_factory_title . ' — ' . $football_factory_more_lbl ); ?>
				"
			>
		<?php endif; ?>
	</div>
	<div class="ff-news-list" role="list" aria-label="<?php echo esc_attr( $football_factory_label_news ); ?>">
		<?php if ( empty( $football_factory_items ) ) : ?>
			<p class="ff-news-list__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
		<?php else : ?>
			<?php foreach ( $football_factory_items as $football_factory_item ) : ?>
				<?php
				if ( ! is_array( $football_factory_item ) ) {
					continue;
				}
				?>
				<?php
				$football_factory_arg_card    = $football_factory_item;
				$football_factory_arg_variant = (
					isset( $football_factory_item['featured'] )
					&& (bool) $football_factory_item['featured']
					)
					? 'featured'
					: 'default';
				?>
				<div class="ff-news-list__item" role="listitem">
					<?php include __DIR__ . '/news-card.php'; ?>
				</div>
			<?php endforeach; ?>
		<?php endif; ?>
	</div>
</section>

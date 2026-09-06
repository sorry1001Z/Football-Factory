<?php
/**
 * Template Part: Related Entities (TP-008)
 *
 * Sidebar block listing related teams, players, matches, etc.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $items Array of { label, url, kind, meta? }.
 *     @type string               $title Section title.
 *     @type string               $kind  Filter by entity kind (team, player, match, league).
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
	: __( 'เอนทิตีที่เกี่ยวข้อง', 'football-factory' );
$football_factory_kind  = isset( $args['kind'] ) ? (string) $args['kind'] : '';

$football_factory_label_empty = __( 'ไม่มีรายการ', 'football-factory' );
$football_factory_label_aria  = __( 'รายการ', 'football-factory' );

// Filter by kind if provided.
$football_factory_filtered = $football_factory_items;
if ( '' !== $football_factory_kind ) {
	$football_factory_filtered = array_values(
		array_filter(
			$football_factory_items,
			static function ( $football_factory_item ) use ( $football_factory_kind ) {
				return (
					is_array( $football_factory_item )
					&& isset( $football_factory_item['kind'] )
					&& (string) $football_factory_item['kind'] === $football_factory_kind
					);
			}
		)
	);
}
?>
<aside
	class="ff-sidebar__block ff-related-entities" data-tp="article/related-entities" data-demo="true" data-kind="
	<?php echo esc_attr( $football_factory_kind ); ?>
	"
>
	<div class="ff-sidebar__title">
		<span><?php echo esc_html( $football_factory_title ); ?></span>
	</div>
	<?php if ( empty( $football_factory_filtered ) ) : ?>
		<p class="ff-sidebar__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<ul
			class="ff-sidebar__list" aria-label="
			<?php echo esc_attr( $football_factory_title . ' — ' . $football_factory_label_aria ); ?>
			"
		>
			<?php foreach ( $football_factory_filtered as $football_factory_item ) : ?>
				<?php
				if ( ! is_array( $football_factory_item ) ) {
					continue;
				}
				$football_factory_item_label = isset( $football_factory_item['label'] )
					? (string) $football_factory_item['label']
					: '';
				$football_factory_item_url   = isset( $football_factory_item['url'] )
					? (string) $football_factory_item['url']
					: '#';
				$football_factory_item_kind  = isset( $football_factory_item['kind'] )
					? (string) $football_factory_item['kind']
					: '';
				$football_factory_item_meta  = isset( $football_factory_item['meta'] )
					? (string) $football_factory_item['meta']
					: '';
				if ( '' === $football_factory_item_label ) {
					continue;
				}
				?>
				<li class="ff-sidebar__list-item">
					<a class="ff-sidebar__list-link" href="<?php echo esc_url( $football_factory_item_url ); ?>">
						<?php if ( '' !== $football_factory_item_kind ) : ?>
							<span
								class="ff-sidebar__list-kind" data-kind="
								<?php echo esc_attr( $football_factory_item_kind ); ?>
								" aria-hidden="true"
							>
						<?php endif; ?>
						<span class="ff-sidebar__list-text">
							<span
								class="ff-sidebar__list-title"
							>
							<?php if ( '' !== $football_factory_item_meta ) : ?>
								<span
									class="ff-sidebar__list-meta"
								>
							<?php endif; ?>
						</span>
					</a>
				</li>
			<?php endforeach; ?>
		</ul>
	<?php endif; ?>
</aside>

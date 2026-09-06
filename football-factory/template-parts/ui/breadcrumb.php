<?php
/**
 * Template Part: Breadcrumb (TP-045)
 *
 * WAI-ARIA breadcrumb navigation trail.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $items {
 *         Each item: { label: string, url?: string }
 *         The last item is the current page (no url).
 *     }
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_items = isset( $args['items'] ) && is_array( $args['items'] ) ? $args['items'] : array();

$football_factory_label_breadcrumb = __( 'เส้นทางนำทาง', 'football-factory' );
?>
<nav
	class="ff-breadcrumb" aria-label="
	<?php echo esc_attr( $football_factory_label_breadcrumb ); ?>
	" data-tp="ui/breadcrumb" data-demo="true"
>
	<ol class="ff-breadcrumb__list" itemscope itemtype="https://schema.org/BreadcrumbList">
		<?php
		$football_factory_position = 0;
		$football_factory_count    = count( $football_factory_items );
		foreach ( $football_factory_items as $football_factory_item ) :
			if ( ! is_array( $football_factory_item ) ) {
				continue;
			}
			++$football_factory_position;
			$football_factory_item_label = isset( $football_factory_item['label'] )
				? (string) $football_factory_item['label']
				: '';
			$football_factory_item_url   = isset( $football_factory_item['url'] )
				? (string) $football_factory_item['url']
				: '';
			$football_factory_is_last    = $football_factory_position === $football_factory_count;
			if ( '' === $football_factory_item_label ) {
				continue;
			}
			?>
			<li class="ff-breadcrumb__item" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
				<?php if ( ! $football_factory_is_last && '' !== $football_factory_item_url ) : ?>
					<a href="<?php echo esc_url( $football_factory_item_url ); ?>" itemprop="item">
						<span itemprop="name"><?php echo esc_html( $football_factory_item_label ); ?></span>
					</a>
					<span class="ff-breadcrumb__sep" aria-hidden="true">/</span>
				<?php else : ?>
					<span
						class="ff-breadcrumb__current" itemprop="name" aria-current="page"
					>
				<?php endif; ?>
				<meta itemprop="position" content="<?php echo (int) $football_factory_position; ?>" />
			</li>
		<?php endforeach; ?>
	</ol>
</nav>

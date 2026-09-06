<?php
/**
 * Template Part: Pagination (TP-044)
 *
 * WAI-ARIA pagination navigation with prev/next and page numbers.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $pagination {
 *         @type int    $current_page Current page number.
 *         @type int    $total_pages  Total number of pages.
 *         @type string $base_url     Base URL (without query args).
 *     }
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_pagination = isset( $args['pagination'] ) && is_array( $args['pagination'] )
	? $args['pagination']
	: array();

$football_factory_current = isset( $football_factory_pagination['current_page'] )
	? (int) $football_factory_pagination['current_page']
	: 1;
$football_factory_total   = isset( $football_factory_pagination['total_pages'] )
	? (int) $football_factory_pagination['total_pages']
	: 1;
$football_factory_base    = isset( $football_factory_pagination['base_url'] )
	? (string) $football_factory_pagination['base_url']
	: '';
if ( '' === $football_factory_base ) {
	$football_factory_base = home_url( '/news/' );
}

$football_factory_label_pagination = __( 'เลขหน้า', 'football-factory' );
$football_factory_label_prev       = __( 'ก่อนหน้า', 'football-factory' );
$football_factory_label_next       = __( 'ถัดไป', 'football-factory' );
$football_factory_label_gap        = __( '...', 'football-factory' );

// Build page list
$football_factory_pages = array();
if ( $football_factory_total > 1 ) {
	$football_factory_window = 2; // pages on each side of current
	$football_factory_start  = max( 1, $football_factory_current - $football_factory_window );
	$football_factory_end    = min( $football_factory_total, $football_factory_current + $football_factory_window );

	if ( $football_factory_start > 1 ) {
		$football_factory_pages[] = 1;
		if ( $football_factory_start > 2 ) {
			$football_factory_pages[] = 'gap';
		}
	}
	for (
		$football_factory_p = $football_factory_start;
		$football_factory_p <= $football_factory_end;
		$football_factory_p++
		) {
		$football_factory_pages[] = $football_factory_p;
	}
	if ( $football_factory_end < $football_factory_total ) {
		if ( $football_factory_end < $football_factory_total - 1 ) {
			$football_factory_pages[] = 'gap';
		}
		$football_factory_pages[] = $football_factory_total;
	}
}
?>
<nav
	class="ff-pagination" aria-label="
	<?php echo esc_attr( $football_factory_label_pagination ); ?>
	" data-tp="ui/pagination" data-demo="true"
>
	<?php if ( $football_factory_current > 1 ) : ?>
		<a
		class="ff-pagination__item"
		href="
		<?php
			echo esc_url(
				add_query_arg( 'page', max( 1, $football_factory_current - 1 ), $football_factory_base )
			);
		?>
		"
		aria-label="<?php echo esc_attr( $football_factory_label_prev ); ?>"
	>
			<svg width="14" height="14" aria-hidden="true"><use href="#i-chevron-left"/></svg>
		</a>
	<?php endif; ?>
	<?php foreach ( $football_factory_pages as $football_factory_pg ) : ?>
		<?php if ( 'gap' === $football_factory_pg ) : ?>
			<span
				class="ff-pagination__gap" aria-hidden="true"
			>
		<?php else : ?>
			<a
				class="ff-pagination__item
				<?php
				echo (int) $football_factory_pg === $football_factory_current
					? ' is-active'
					: '';
				?>
				" href="
				<?php echo esc_url( add_query_arg( 'page', (int) $football_factory_pg, $football_factory_base ) ); ?>
				"
				<?php
				echo (int) $football_factory_pg === $football_factory_current
					? 'aria-current="page"'
					: '';
				?>
			>
				<?php echo (int) $football_factory_pg; ?>
			</a>
		<?php endif; ?>
	<?php endforeach; ?>
	<?php if ( $football_factory_current < $football_factory_total ) : ?>
		<a
		class="ff-pagination__item"
		href="
		<?php
			echo esc_url(
				add_query_arg(
					'page',
					min( $football_factory_total, $football_factory_current + 1 ),
					$football_factory_base
				)
			);
		?>
		"
		aria-label="<?php echo esc_attr( $football_factory_label_next ); ?>"
	>
			<svg width="14" height="14" aria-hidden="true"><use href="#i-chevron-right"/></svg>
		</a>
	<?php endif; ?>
</nav>

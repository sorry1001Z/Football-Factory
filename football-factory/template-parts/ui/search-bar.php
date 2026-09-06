<?php
/**
 * Template Part: Search Bar (TP-046)
 *
 * Reusable search input form with auto-suggest hook.
 *
 * @var array<string, mixed> $args {
 *     @type string $placeholder Placeholder text.
 *     @type string $action_url  Form action URL.
 *     @type string $query      Current search query.
 *     @type array  $suggested  Suggested search terms.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_placeholder = isset( $args['placeholder'] )
	? (string) $args['placeholder']
	: __( 'ค้นหาทีม นักเตะ ข่าว...', 'football-factory' );
$football_factory_action      = isset( $args['action_url'] ) ? (string) $args['action_url'] : home_url( '/search' );
$football_factory_query       = isset( $args['query'] ) ? (string) $args['query'] : '';
$football_factory_suggested   = isset( $args['suggested'] ) && is_array( $args['suggested'] )
	? $args['suggested']
	: array();

$football_factory_label_search = __( 'ค้นหา', 'football-factory' );
$football_factory_label_clear  = __( 'ล้าง', 'football-factory' );
$football_factory_id           = 'ff-search-' . wp_unique_id();
?>
<form
	class="ff-search-bar" role="search" action="
	<?php echo esc_url( $football_factory_action ); ?>
	" method="get" data-tp="ui/search-bar" data-demo="true"
>
	<label
		class="ff-sr" for="
		<?php echo esc_attr( $football_factory_id ); ?>
		"
	>
	<svg class="ff-search-bar__icon" width="18" height="18" aria-hidden="true"><use href="#i-search"/></svg>
	<input
		id="<?php echo esc_attr( $football_factory_id ); ?>"
		type="search"
		name="q"
		class="ff-search-bar__input"
		placeholder="<?php echo esc_attr( $football_factory_placeholder ); ?>"
		value="<?php echo esc_attr( $football_factory_query ); ?>"
		autocomplete="off"
		data-ff="search-input"
		aria-controls="<?php echo esc_attr( $football_factory_id ); ?>-suggestions"
		aria-expanded="false"
	/>
	<?php if ( '' !== $football_factory_query ) : ?>
		<button
			type="button" class="ff-search-bar__clear" data-ff="search-clear" aria-label="
			<?php echo esc_attr( $football_factory_label_clear ); ?>
			"
		>
			<svg width="14" height="14" aria-hidden="true"><use href="#i-close"/></svg>
		</button>
	<?php endif; ?>
	<button type="submit" class="ff-search-bar__submit ff-btn ff-btn--primary">
		<?php echo esc_html( $football_factory_label_search ); ?>
	</button>
	<?php if ( ! empty( $football_factory_suggested ) ) : ?>
		<div class="ff-search-suggested" id="<?php echo esc_attr( $football_factory_id ); ?>-suggestions" hidden>
			<span class="ff-search-suggested__label"><?php esc_html_e( 'แนะนำ:', 'football-factory' ); ?></span>
			<?php foreach ( $football_factory_suggested as $football_factory_term ) : ?>
				<?php
				$football_factory_term_str = is_string( $football_factory_term )
					? $football_factory_term
					: (
						is_array( $football_factory_term )
						&& isset( $football_factory_term['label'] ) ? (string) $football_factory_term['label'] : ''
						);
				if ( '' === $football_factory_term_str ) {
					continue;
				}
				?>
				<a
					class="ff-search-suggested__chip" href="
					<?php echo esc_url( add_query_arg( 'q', $football_factory_term_str, $football_factory_action ) ); ?>
					"
				>
			<?php endforeach; ?>
		</div>
	<?php endif; ?>
</form>

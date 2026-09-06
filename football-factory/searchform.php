<?php
/**
 * Search form template.
 *
 * Renders the search input for use in:
 *   - The header search overlay (Phase 6C global shell).
 *   - The 404 / search results pages (Phase 6C baseline).
 *   - Any other context where `get_search_form()` is called.
 *
 * The form posts to the home URL with the `s` parameter
 * (standard WordPress search). The dialog/modal chrome is
 * added by the caller — this file is ONLY the form.
 *
 * @package Football_Factory
 * @since   0.2.0
 */

declare( strict_types = 1 );

/**
 * Filters the search form text strings.
 *
 * @since 0.2.0
 */
$football_factory_search_aria_label   = __( 'Search query', 'football-factory' );
$football_factory_search_placeholder  = __( 'Search…', 'football-factory' );
$football_factory_search_button_label = __( 'Search', 'football-factory' );

$football_factory_search_aria_label   = (string) apply_filters(
	'football_factory_search_input_aria',
	$football_factory_search_aria_label
);
$football_factory_search_placeholder  = (string) apply_filters(
	'football_factory_search_input_placeholder',
	$football_factory_search_placeholder
);
$football_factory_search_button_label = (string) apply_filters(
	'football_factory_search_submit_label',
	$football_factory_search_button_label
);

$football_factory_search_home_url = (string) home_url( '/' );
$football_factory_search_input_id = (string) apply_filters( 'football_factory_search_input_id', 'ff-search-input' );
?>
<form
	role="search"
	method="get"
	class="ff-search-form"
	action="<?php echo esc_url( $football_factory_search_home_url ); ?>"
>
	<label class="ff-sr" for="<?php echo esc_attr( $football_factory_search_input_id ); ?>">
		<?php echo esc_html( $football_factory_search_aria_label ); ?>
	</label>
	<input
		id="<?php echo esc_attr( $football_factory_search_input_id ); ?>"
		class="ff-search-form__input"
		type="search"
		name="s"
		placeholder="<?php echo esc_attr( $football_factory_search_placeholder ); ?>"
		autocomplete="off"
	/>
	<button class="ff-btn ff-btn--primary ff-search-form__submit" type="submit">
		<?php echo esc_html( $football_factory_search_button_label ); ?>
	</button>
</form>

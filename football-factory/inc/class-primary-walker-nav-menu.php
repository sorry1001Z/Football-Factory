<?php
/**
 * Football Factory — Primary Nav Walker
 *
 * Customizes the markup produced by `wp_nav_menu()` for the
 * `primary` location to match the approved Enterprise Frontend
 * design system. Specifically:
 *
 *   - Each link gets the `ff-nav__link` class (with a sub-link
 *     variant `ff-nav__link--sub` for items with submenus).
 *   - Each link that is the current page (or an ancestor of
 *     the current page) gets `aria-current="page"`.
 *   - Each list item gets a `data-ff-current` attribute
 *     (`true` / `false`) so the CSS layer can apply the
 *     current-page highlight style without a JS dependency.
 *   - Sub-menus are wrapped in a sub-list with the
 *     `ff-nav__sub-list` class.
 *   - The walker is generic — it can be used for the `primary`,
 *     `mobile`, or any other location by passing a different
 *     class prefix.
 *
 * Phase 6C production navigation; part of the global shell.
 *
 * Note on hook names: this file uses WordPress CORE filter
 * names (`nav_menu_link_attributes`, `the_title`,
 * `nav_menu_item_title`, `walker_nav_menu_start_el`). These
 * are NOT custom hooks — they are documented WP core filters
 * and the WPCS rule `WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound`
 * produces a false positive for them. The rule is suppressed
 * via `phpcs:disable`/`phpcs:enable` markers around the
 * `apply_filters`/`do_action` calls.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

namespace FootballFactory\Theme;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Walker for the primary desktop nav.
 */
final class Primary_Walker_Nav_Menu extends \Walker_Nav_Menu {

	/**
	 * Open a sub-menu container.
	 *
	 * @param string   $output Reference to the walker output buffer.
	 * @param int      $depth   Depth of the current item.
	 * @param stdClass $args    Walker args.
	 * @return void
	 */
	public function start_lvl( &$output, $depth = 0, $args = null ) {
		$indent  = str_repeat( "\t", $depth );
		$output .= "\n{$indent}<ul class=\"ff-nav__sub-list\" role=\"list\" data-ff-sub-list>\n";
	}

	/**
	 * Close a sub-menu container.
	 *
	 * @param string   $output Reference to the walker output buffer.
	 * @param int      $depth   Depth of the current item.
	 * @param stdClass $args    Walker args.
	 * @return void
	 */
	public function end_lvl( &$output, $depth = 0, $args = null ) {
		$indent  = str_repeat( "\t", $depth );
		$output .= "{$indent}</ul>\n";
	}

	/**
	 * Open a list item.
	 *
	 * @param string   $output Reference to the walker output buffer.
	 * @param WP_Post  $item    Menu item.
	 * @param int      $depth   Depth of the current item.
	 * @param stdClass $args    Walker args.
	 * @param int      $id      Current item ID.
	 * @return void
	 */
	public function start_el( &$output, $item, $depth = 0, $args = null, $id = 0 ) {
		$indent = ( $depth ) ? str_repeat( "\t", $depth ) : '';

		$classes   = empty( $item->classes ) ? array() : (array) $item->classes;
		$classes[] = 'ff-nav__item';
		if ( in_array( 'current-menu-item', $classes, true ) || in_array( 'current-menu-ancestor', $classes, true ) ) {
			$classes[] = 'is-current';
		}
		if ( in_array( 'menu-item-has-children', $classes, true ) ) {
			$classes[] = 'has-sub';
		}
		$classes      = array_unique( array_filter( $classes ) );
		$class_string = join( ' ', $classes );

		$is_current = in_array( 'is-current', $classes, true ) ? 'true' : 'false';

		$li_class   = $class_string;
		$li_current = $is_current;
		$li_open    = '<li class="' . esc_attr( $li_class ) . '" data-ff-current="' . esc_attr( $li_current ) . '">';
		$output    .= $indent . $li_open;

		$atts           = array();
		$atts['title']  = ! empty( $item->attr_title ) ? $item->attr_title : '';
		$atts['target'] = ! empty( $item->target ) ? $item->target : '';
		$atts['rel']    = ! empty( $item->xfn ) ? $item->xfn : '';
		$atts['href']   = ! empty( $item->url ) ? $item->url : '#';

		$link_classes = array( 'ff-nav__link' );
		if ( $depth > 0 ) {
			$link_classes[] = 'ff-nav__link--sub';
		}
		if ( in_array( 'is-current', $classes, true ) ) {
			$link_classes[]       = 'is-current';
			$atts['aria-current'] = 'page';
		}
		$atts['class'] = implode( ' ', $link_classes );

		// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WordPress core filters below.
		$atts = apply_filters( 'nav_menu_link_attributes', $atts, $item, $args, $depth );

		$attributes = '';
		foreach ( $atts as $attr_name => $attr_value ) {
			if ( '' === $attr_value && '0' !== $attr_value ) {
				continue;
			}
			$attr_value  = ( 'href' === $attr_name ) ? esc_url( $attr_value ) : esc_attr( $attr_value );
			$attributes .= ' ' . $attr_name . '="' . $attr_value . '"';
		}

		$title = apply_filters( 'the_title', $item->title, $item->ID );
		/**
		 * Filter the menu item title.
		 *
		 * @param string  $title The menu item title.
		 * @param WP_Post $item  The menu item.
		 * @param int     $depth Depth of the item.
		 * @param stdClass $args Walker args.
		 */
		$title = apply_filters( 'nav_menu_item_title', $title, $item, $args, $depth );
		// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

		$item_output  = isset( $args->before ) ? $args->before : '';
		$item_output .= '<a' . $attributes . ' data-nav>';
		$item_output .= isset( $args->link_before ) ? $args->link_before : '';
		$item_output .= $title;
		$item_output .= isset( $args->link_after ) ? $args->link_after : '';
		$item_output .= '</a>';
		$item_output .= isset( $args->after ) ? $args->after : '';

		// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WordPress core filter.
		$output .= apply_filters( 'walker_nav_menu_start_el', $item_output, $item, $depth, $args );
		// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
	}
}

<?php
/**
 * Football Factory — Template Helpers
 *
 * Shared utility helpers used by template parts. Every helper is
 * side-effect free, no global state, no I/O, no business logic.
 *
 * The helpers exist so the template parts are themselves simple
 * and consistent. All escaping happens here; the template part
 * itself never calls `esc_html` etc. directly unless the part is
 * rendering a single, isolated, in-context value.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

namespace FootballFactory\Theme\Helpers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Safely resolve a value from a normalized view-model array.
 *
 * Returns the default if the key is missing, null, or empty string.
 * This is the single point of view-model "optional-field" handling
 * so template parts never need to repeat `isset()` ladders.
 *
 * @param array<string, mixed> $data   The view-model array.
 * @param string              $key    The key to read.
 * @param mixed               $default Default value if missing.
 *
 * @return mixed
 */
function ff_part_value( array $data, string $key, $fallback = '' ) {
	if ( array_key_exists( $key, $data ) && null !== $data[ $key ] && '' !== $data[ $key ] ) {
		return $data[ $key ];
	}
	return $fallback;
}

/**
 * Render an `ff-badge` HTML string.
 *
 * @param string $label The badge label (already-translated).
 * @param string $variant Badge variant: brand | ghost | info | live | neutral | demo.
 * @param array<string, mixed> $extra_attrs Extra HTML attributes (key => value).
 *
 * @return string
 */
function ff_part_badge( string $label, string $variant = 'brand', array $extra_attrs = array() ): string {
	$variant_attr = ( '' === $variant || 'brand' === $variant ) ? '' : ' ff-badge--' . sanitize_html_class( $variant );

	$attrs_str = '';
	foreach ( $extra_attrs as $k => $v ) {
		$attrs_str .= ' ' . sanitize_key( $k ) . '="' . esc_attr( (string) $v ) . '"';
	}

	return sprintf(
		'<span class="ff-badge%s"%s>%s</span>',
		$variant_attr,
		$attrs_str,
		esc_html( $label )
	);
}

/**
 * Render a safe missing-image placeholder.
 *
 * Always rendered as inline SVG so there are zero network requests
 * and zero broken image icons.
 *
 * @param string $label Optional label text inside the placeholder.
 * @param string $shape Shape variant: photo | crest | stadium.
 *
 * @return string
 */
function ff_part_missing_image( string $label = '', string $shape = 'photo' ): string {
	$shape_attr = ( 'photo' === $shape ) ? '' : ' data-shape="' . esc_attr( $shape ) . '"';
	$label_safe = ( '' === $label ) ? '' : '<span class="ff-sr">' . esc_html( $label ) . '</span>';
	return sprintf(
		'<div class="ff-ph" role="img" aria-hidden="true"%s>%s</div>',
		$shape_attr,
		$label_safe
	);
}

/**
 * Escape an array of CSS class names.
 *
 * @param array<int, string> $classes Raw class names.
 *
 * @return string
 */
function ff_part_classes( array $classes ): string {
	$out = array();
	foreach ( $classes as $cls ) {
		$cls = (string) $cls;
		if ( '' !== $cls ) {
			$out[] = sanitize_html_class( $cls );
		}
	}
	return implode( ' ', array_unique( array_filter( $out ) ) );
}

/**
 * Build a safe "aria-current" attribute value.
 *
 * Returns the attribute string (with leading space) if current,
 * or empty string if not.
 *
 * @param bool $is_current Whether this is the current item.
 *
 * @return string
 */
function ff_part_aria_current( bool $is_current ): string {
	return $is_current ? ' aria-current="true"' : '';
}

/**
 * Render a list of stat rows for stat-based components.
 *
 * @param array<int, array{label: string, home: string|int, away: string|int}> $rows
 * @param string $home_label Home label (e.g. team code).
 * @param string $away_label Away label.
 *
 * @return string
 */
function ff_part_stat_rows( array $rows, string $home_label = '', string $away_label = '' ): string {
	$out = '';
	foreach ( $rows as $row ) {
		$label = isset( $row['label'] ) ? (string) $row['label'] : '';
		$home  = isset( $row['home'] ) ? (string) $row['home'] : '';
		$away  = isset( $row['away'] ) ? (string) $row['away'] : '';
		$out  .= sprintf(
			'<div class="ff-stat-row"><span class="ff-stat-row__label">%s</span><span class="ff-stat-row__home">%s</span><span class="ff-stat-row__away">%s</span></div>', // phpcs:ignore Generic.Files.LineLength.TooLong
			esc_html( $label ),
			esc_html( $home ),
			esc_html( $away )
		);
	}
	return $out;
}

/**
 * Render a 5-letter form string as a sequence of `<span class="ff-form__cell">`.
 *
 * @param array<int, string> $form Array of 5 form letters: W, D, L.
 * @param string $size Optional size variant: sm.
 *
 * @return string
 */
function ff_part_form_cells( array $form, string $size = '' ): string {
	$size_cls = ( 'sm' === $size ) ? ' ff-form--sm' : '';
	$out      = '<div class="ff-form' . esc_attr( $size_cls ) . '" role="list" aria-label="' . esc_attr__( 'ฟอร์ม 5 นัดล่าสุด', 'football-factory' ) . '">'; // phpcs:ignore Generic.Files.LineLength.TooLong
	foreach ( $form as $letter ) {
		$l    = strtoupper( substr( (string) $letter, 0, 1 ) );
		$cls  = 'ff-form__cell ff-form__cell--' . strtolower( $l );
		$out .= sprintf(
			'<span class="%s" role="listitem" aria-label="%s">%s</span>',
			esc_attr( $cls ),
			esc_attr( $l ),
			esc_html( $l )
		);
	}
	$out .= '</div>';
	return $out;
}

/**
 * Compose a URL with query args safely.
 *
 * @param string $url  Base URL.
 * @param array<string, mixed> $args Query args.
 *
 * @return string
 */
function ff_part_url_with_args( string $url, array $args ): string {
	if ( empty( $args ) ) {
		return $url;
	}
	return add_query_arg( array_map( 'strval', $args ), $url );
}

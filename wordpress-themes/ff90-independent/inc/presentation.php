<?php
/** Read-only native WordPress presentation helpers. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_sanitize_layout( $value ) {
    return in_array( $value, array( 'main-v2', 'colormag-01' ), true ) ? $value : 'colormag-01';
}
function ff90_layout() { return ff90_sanitize_layout( get_theme_mod( 'ff90_home_layout', 'colormag-01' ) ); }
function ff90_banner_kinds() {
    return array( 'general', 'breaking', 'transfer', 'preview', 'result', 'standings', 'stats', 'tactics', 'team', 'competition', 'infographic', 'youth', 'feature' );
}
function ff90_banner_kind( $post_id ) {
    $kind = get_post_meta( $post_id, '_ff90_banner_kind', true );
    if ( ! is_string( $kind ) ) { $kind = ''; }
    $aliases = array( 'transfers' => 'transfer', 'match-preview' => 'preview', 'statistics' => 'stats', 'tactical' => 'tactics', 'team-news' => 'team', 'features' => 'feature' );
    if ( isset( $aliases[ $kind ] ) ) { $kind = $aliases[ $kind ]; }
    if ( in_array( $kind, ff90_banner_kinds(), true ) ) { return $kind; }
    foreach ( get_the_category( $post_id ) as $category ) {
        $slug = isset( $aliases[ $category->slug ] ) ? $aliases[ $category->slug ] : $category->slug;
        if ( in_array( $slug, ff90_banner_kinds(), true ) ) { return $slug; }
    }
    return 'general';
}
function ff90_news_query( $args = array() ) {
    return new WP_Query( array_merge( array( 'post_type' => 'post', 'post_status' => 'publish', 'posts_per_page' => 5, 'ignore_sticky_posts' => true, 'no_found_rows' => true ), $args ) );
}
function ff90_card( $style = 'grid' ) {
    get_template_part( 'template-parts/card', null, array( 'style' => $style ) );
}
function ff90_fallback_menu() {
    echo '<ul class="menu"><li><a href="' . esc_url( home_url( '/' ) ) . '">' . ff90_icon( 'home' ) . '<span class="menu-label">' . esc_html__( 'หน้าแรก', 'ff90-independent' ) . '</span></a></li>';
    $categories = get_categories( array( 'number' => 6, 'hide_empty' => true ) );
    foreach ( $categories as $category ) {
        echo '<li><a href="' . esc_url( get_category_link( $category ) ) . '">' . ff90_icon( 'football' ) . '<span class="menu-label">' . esc_html( $category->name ) . '</span></a></li>';
    }
    if ( ff90_contact_page_id() ) { echo '<li><a href="' . esc_url( get_permalink( ff90_contact_page_id() ) ) . '">' . ff90_icon( 'contact' ) . '<span class="menu-label">' . esc_html__( 'ติดต่อเรา', 'ff90-independent' ) . '</span></a></li>'; }
    echo '</ul>';
}
function ff90_fixture_date() {
    // Date only, never use this input for writes or outbound requests.
    $raw = isset( $_GET['ff90_date'] ) && is_string( $_GET['ff90_date'] ) ? sanitize_text_field( wp_unslash( $_GET['ff90_date'] ) ) : '';
    $date = DateTimeImmutable::createFromFormat( '!Y-m-d', $raw, wp_timezone() );
    return $date && $date->format( 'Y-m-d' ) === $raw ? $date : new DateTimeImmutable( 'today', wp_timezone() );
}

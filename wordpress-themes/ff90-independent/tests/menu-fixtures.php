<?php
/** Native category/menu data for the disposable local QA site only. */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI || ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX ) { return; }
$items = json_decode( file_get_contents( $args[0] ), true, 512, JSON_THROW_ON_ERROR );
$general = get_category_by_slug( 'general' );
$locations = get_theme_mod( 'nav_menu_locations' );
if ( ! $general || empty( $locations['primary'] ) ) { throw new RuntimeException( 'Seed QA news and primary menu first.' ); }
$menu_id = $locations['primary'];
$parent_id = 0;
foreach ( wp_get_nav_menu_items( $menu_id ) as $item ) {
    if ( 'category' === $item->object && (int) $item->object_id === (int) $general->term_id ) { $parent_id = $item->ID; break; }
}
if ( ! $parent_id ) { throw new RuntimeException( 'ข่าวฟุตบอล parent menu item missing.' ); }
wp_update_nav_menu_item( $menu_id, $parent_id, array( 'menu-item-title' => 'ข่าวฟุตบอลลีก', 'menu-item-object-id' => $general->term_id, 'menu-item-object' => 'category', 'menu-item-type' => 'taxonomy', 'menu-item-parent-id' => 0, 'menu-item-status' => 'publish' ) );
$cup_term = get_category_by_slug( 'football-cups' );
$cup_result = $cup_term ? array( 'term_id' => $cup_term->term_id ) : wp_insert_term( 'บอลถ้วย', 'category', array( 'slug' => 'football-cups' ) );
if ( is_wp_error( $cup_result ) ) { throw new RuntimeException( $cup_result->get_error_message() ); }
$cup_id = $cup_result['term_id'];
$cup_parent = 0;
foreach ( wp_get_nav_menu_items( $menu_id ) as $item ) {
    if ( 'category' === $item->object && (int) $item->object_id === (int) $cup_id ) { $cup_parent = $item->ID; break; }
}
$cup_parent = wp_update_nav_menu_item( $menu_id, $cup_parent, array( 'menu-item-title' => 'บอลถ้วย', 'menu-item-object-id' => $cup_id, 'menu-item-object' => 'category', 'menu-item-type' => 'taxonomy', 'menu-item-parent-id' => 0, 'menu-item-status' => 'publish' ) );
if ( is_wp_error( $cup_parent ) ) { throw new RuntimeException( $cup_parent->get_error_message() ); }
foreach ( $items as $competition ) {
    $is_cup = 'cups' === $competition['group'];
    $category_parent = $is_cup ? $cup_id : $general->term_id;
    $menu_parent = $is_cup ? $cup_parent : $parent_id;
    $term = get_category_by_slug( $competition['slug'] );
    $result = $term ? array( 'term_id' => $term->term_id ) : wp_insert_term( $competition['name'], 'category', array( 'slug' => $competition['slug'], 'parent' => $category_parent ) );
    if ( is_wp_error( $result ) ) { throw new RuntimeException( $result->get_error_message() ); }
    $id = $result['term_id'];
    wp_update_term( $id, 'category', array( 'parent' => $category_parent ) );
    $existing = 0;
    foreach ( wp_get_nav_menu_items( $menu_id ) as $item ) {
        if ( 'category' === $item->object && (int) $item->object_id === (int) $id ) { $existing = $item->ID; break; }
    }
    $saved = wp_update_nav_menu_item( $menu_id, $existing, array( 'menu-item-title' => $competition['name'], 'menu-item-object-id' => $id, 'menu-item-object' => 'category', 'menu-item-type' => 'taxonomy', 'menu-item-parent-id' => $menu_parent, 'menu-item-status' => 'publish' ) );
    if ( is_wp_error( $saved ) ) { throw new RuntimeException( $saved->get_error_message() ); }
}
echo count( $items ) . ' native competition links configured; no articles or production data changed.';

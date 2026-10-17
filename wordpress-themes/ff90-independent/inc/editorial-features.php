<?php
/** FF90 presentation only: icons, contact links, badges and sellable ad regions. */
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_icon( $name ) {
    $paths = array(
        'home' => '<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
        'calendar' => '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
        'news' => '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h4v4H7zm8 0h2m-2 4h2M7 16h10"/>',
        'team' => '<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4m2-17a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5v2"/>',
        'transfer' => '<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
        'football' => '<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-2 5h-4l-2-5 4-3zm0-4v4m-9 6 5-3m8 0 5 3M7 20l3-5m4 0 3 5"/>',
        'cup' => '<path d="M7 3h10v6a5 5 0 0 1-10 0V3zm0 2H3v3a5 5 0 0 0 5 5m9-8h4v3a5 5 0 0 1-5 5m-4 1v6m-5 1h10"/>',
        'contact' => '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
        'facebook' => '<path d="M14 21v-8h3l1-4h-4V7c0-1 1-2 2-2h2V2h-3c-3 0-5 2-5 5v2H7v4h3v8"/>',
        'youtube' => '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3V9z"/>',
        'tiktok' => '<path d="M14 3v12a4 4 0 1 1-4-4m4-8c0 4 3 6 6 6V6c-2 0-4-2-4-3h-2z"/>',
        'social' => '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-4m-6 8 6 4"/>',
    );
    $name = isset( $paths[ $name ] ) ? $name : 'news';
    return '<svg class="ff90-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' . $paths[ $name ] . '</svg>';
}
function ff90_post_badges( $post_id ) {
    $badges = array();
    $post = get_post( $post_id );
    if ( ! $post || 'post' !== $post->post_type || 'publish' !== $post->post_status || $post->post_password ) { return $badges; }
    $published = get_post_timestamp( $post, 'date' );
    $age = time() - $published;
    if ( $published && $age >= 0 && $age < 3 * HOUR_IN_SECONDS ) { $badges[] = 'new'; }
    $filtered = apply_filters( 'ff90_post_badges', $badges, $post_id );
    return is_array( $filtered ) ? array_values( array_intersect( array( 'hot', 'best', 'new' ), $filtered ) ) : $badges;
}
function ff90_badges_html( $badges, $menu = false ) {
    $valid = array( 'new' => __( 'เผยแพร่ไม่เกิน 3 ชั่วโมง', 'ff90-independent' ), 'best' => __( 'ข่าวยอดนิยมประจำสัปดาห์', 'ff90-independent' ), 'hot' => __( '5 ข่าวยอดนิยมของวันนี้', 'ff90-independent' ) );
    $badges = is_array( $badges ) ? array_values( array_intersect( array( 'hot', 'best', 'new' ), $badges ) ) : array();
    if ( $menu ) { $badges = array_slice( $badges, 0, 1 ); }
    if ( ! $badges ) { return ''; }
    $html = '<span class="' . ( $menu ? 'ff90-menu-badges' : 'ff90-post-badges' ) . '">';
    foreach ( $badges as $badge ) { $html .= '<span class="ff90-badge badge-' . esc_attr( $badge ) . '" title="' . esc_attr( $valid[ $badge ] ) . '">' . esc_html( strtoupper( $badge ) ) . '</span>'; }
    return $html . '</span>';
}
function ff90_contact_page_id() {
    $id = absint( get_theme_mod( 'ff90_contact_page', 0 ) );
    if ( ! $id ) { $page = get_page_by_path( 'contact' ); $id = $page ? $page->ID : 0; }
    return $id && 'page' === get_post_type( $id ) && 'publish' === get_post_status( $id ) ? $id : 0;
}
add_filter( 'nav_menu_item_title', function ( $title, $item, $args ) {
    if ( empty( $args->theme_location ) || 'primary' !== $args->theme_location ) { return $title; }
    $icon = 'news';
    $badges = array();
    if ( 'category' === $item->object ) {
        $term = get_term( $item->object_id, 'category' );
        $map = array( 'preview' => 'calendar', 'breaking' => 'news', 'team' => 'team', 'transfer' => 'transfer', 'general' => 'football', 'football-cups' => 'cup', 'premier-league' => 'football', 'la-liga' => 'football', 'bundesliga' => 'football', 'serie-a' => 'football', 'ligue-1' => 'football' );
        if ( $term && ! is_wp_error( $term ) ) {
            $icon = isset( $map[ $term->slug ] ) ? $map[ $term->slug ] : 'football';
            foreach ( get_ancestors( $term->term_id, 'category', 'taxonomy' ) as $ancestor ) {
                $parent = get_term( $ancestor, 'category' );
                if ( $parent && ! is_wp_error( $parent ) && 'football-cups' === $parent->slug ) { $icon = 'cup'; }
            }
        }
        $badges = apply_filters( 'ff90_category_badges', array(), (int) $item->object_id );
    } elseif ( untrailingslashit( $item->url ) === untrailingslashit( home_url( '/' ) ) ) { $icon = 'home';
    } elseif ( (int) $item->object_id === ff90_contact_page_id() && 'page' === $item->object ) { $icon = 'contact'; }
    foreach ( (array) $item->classes as $class ) {
        if ( 0 === strpos( $class, 'ff90-icon-' ) ) { $icon = substr( $class, strlen( 'ff90-icon-' ) ); }
    }
    return ff90_icon( $icon ) . '<span class="menu-label">' . wp_kses_post( $title ) . '</span>' . ff90_badges_html( $badges, true );
}, 10, 3 );
add_filter( 'wp_nav_menu_items', function ( $items, $args ) {
    if ( empty( $args->theme_location ) || 'primary' !== $args->theme_location || ! ff90_contact_page_id() ) { return $items; }
    $url = get_permalink( ff90_contact_page_id() );
    if ( false !== strpos( $items, 'href="' . esc_url( $url ) . '"' ) ) { return $items; }
    $current = is_page( ff90_contact_page_id() ) ? ' aria-current="page"' : '';
    return $items . '<li class="menu-item ff90-contact-item"><a href="' . esc_url( $url ) . '"' . $current . '>' . ff90_icon( 'contact' ) . '<span class="menu-label">' . esc_html__( 'ติดต่อเรา', 'ff90-independent' ) . '</span></a></li>';
}, 10, 2 );
function ff90_sanitize_social_url( $value, $setting ) {
    if ( ! is_string( $value ) ) { return ''; }
    $platform = str_replace( 'ff90_social_', '', $setting->id );
    $hosts = array( 'facebook' => array( 'facebook.com', 'www.facebook.com', 'fb.com', 'fb.me' ), 'line' => array( 'line.me', 'www.line.me', 'lin.ee' ), 'youtube' => array( 'youtube.com', 'www.youtube.com', 'youtu.be' ), 'instagram' => array( 'instagram.com', 'www.instagram.com' ), 'tiktok' => array( 'tiktok.com', 'www.tiktok.com' ), 'x' => array( 'x.com', 'www.x.com', 'twitter.com', 'www.twitter.com' ) );
    $url = esc_url_raw( $value, array( 'https' ) );
    if ( wp_parse_url( $url, PHP_URL_USER ) || wp_parse_url( $url, PHP_URL_PASS ) ) { return ''; }
    return isset( $hosts[ $platform ] ) && 'https' === wp_parse_url( $url, PHP_URL_SCHEME ) && in_array( strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) ), $hosts[ $platform ], true ) ? $url : '';
}
function ff90_social_links() {
    $links = array();
    foreach ( array( 'facebook' => 'Facebook', 'line' => 'LINE', 'youtube' => 'YouTube', 'instagram' => 'Instagram', 'tiktok' => 'TikTok', 'x' => 'X' ) as $key => $label ) {
        $value = get_theme_mod( 'ff90_social_' . $key, '' );
        $setting = (object) array( 'id' => 'ff90_social_' . $key );
        $url = ff90_sanitize_social_url( is_string( $value ) ? $value : '', $setting );
        $placeholder = in_array( $key, array( 'facebook', 'youtube', 'tiktok' ), true );
        if ( $url || $placeholder ) { $links[] = array( 'url' => $url, 'label' => $label, 'icon' => $placeholder ? $key : 'social' ); }
    }
    if ( ! $links ) { return; }
    echo '<div class="ff90-social-links" role="group" aria-label="' . esc_attr__( 'ช่องทางโซเชียล FF90', 'ff90-independent' ) . '">';
    foreach ( $links as $link ) {
        if ( $link['url'] ) {
            echo '<a href="' . esc_url( $link['url'] ) . '" rel="me noopener" aria-label="' . esc_attr( $link['label'] ) . '">' . ff90_icon( $link['icon'] ) . '<span class="screen-reader-text">' . esc_html( $link['label'] ) . '</span></a>';
        } else {
            $label = $link['label'] . ' — ' . __( 'ยังไม่เชื่อมลิงก์', 'ff90-independent' );
            echo '<span class="ff90-social-placeholder" role="img" aria-label="' . esc_attr( $label ) . '" title="' . esc_attr( $label ) . '">' . ff90_icon( $link['icon'] ) . '</span>';
        }
    }
    echo '</div>';
}
function ff90_contact_details() {
    $value = get_theme_mod( 'ff90_contact_email', '' );
    $email = is_string( $value ) ? sanitize_email( $value ) : '';
    if ( ! is_email( $email ) ) { return; }
    echo '<div class="ff90-contact-details"><h2>' . esc_html__( 'ติดต่อ FF90', 'ff90-independent' ) . '</h2><p><a href="' . esc_url( 'mailto:' . $email ) . '">' . ff90_icon( 'contact' ) . ' <span>' . esc_html( $email ) . '</span></a></p></div>';
}
function ff90_sale_slot( $slot ) {
    $slots = array( 'header' => '468 × 60', 'inline-1' => '970 × 120', 'inline-2' => '970 × 120' );
    if ( ! isset( $slots[ $slot ] ) ) { return; }
    $widget = 'ff90-sale-' . $slot;
    $active = is_active_sidebar( $widget );
    $attachment = absint( get_theme_mod( 'ff90_sale_' . $slot . '_image', 0 ) );
    $alt = $attachment ? get_post_meta( $attachment, '_wp_attachment_image_alt', true ) : '';
    $alt = is_string( $alt ) && trim( $alt ) ? wp_strip_all_tags( $alt ) : __( 'แบนเนอร์โฆษณา', 'ff90-independent' );
    $image = $attachment && wp_attachment_is_image( $attachment ) ? wp_get_attachment_image( $attachment, 'full', false, array( 'class' => 'sale-creative', 'alt' => $alt, 'loading' => 'header' === $slot ? 'eager' : 'lazy' ) ) : '';
    if ( ! $image && ! $active && ! get_theme_mod( 'ff90_show_sale_slots', true ) ) { return; }
    echo '<aside class="ff90-sale-slot sale-' . esc_attr( $slot ) . '" data-ad-slot="' . esc_attr( $slot ) . '" aria-label="' . esc_attr__( 'พื้นที่โฆษณา', 'ff90-independent' ) . '"><span class="sale-label">' . esc_html__( 'โฆษณา', 'ff90-independent' ) . '</span>';
    if ( $image ) {
        $value = get_theme_mod( 'ff90_sale_' . $slot . '_url', '' );
        $url = is_string( $value ) ? esc_url_raw( $value, array( 'https', 'http' ) ) : '';
        if ( $url ) { echo '<a class="sale-creative-link" href="' . esc_url( $url ) . '" rel="sponsored nofollow noopener">'; }
        echo $image;
        if ( $url ) { echo '</a>'; }
    } elseif ( $active ) { dynamic_sidebar( $widget );
    } else {
        echo '<div class="sale-available"><span class="sale-mark" aria-hidden="true">AD</span><div><strong>' . esc_html__( 'พื้นที่โฆษณาสำหรับแบรนด์ของคุณ', 'ff90-independent' ) . '</strong><small>' . esc_html( $slots[ $slot ] ) . '</small></div>';
        if ( ff90_contact_page_id() ) { echo '<a class="sale-contact" href="' . esc_url( get_permalink( ff90_contact_page_id() ) ) . '">' . esc_html__( 'ติดต่อโฆษณา', 'ff90-independent' ) . ' →</a>'; }
        echo '</div>';
    }
    echo '</aside>';
}
add_action( 'widgets_init', function () {
    foreach ( array( 'header' => __( 'Sale banner — next to header logo', 'ff90-independent' ), 'inline-1' => __( 'Sale banner — news separator 1', 'ff90-independent' ), 'inline-2' => __( 'Sale banner — news separator 2', 'ff90-independent' ) ) as $slot => $name ) {
        register_sidebar( array( 'id' => 'ff90-sale-' . $slot, 'name' => $name, 'before_widget' => '<div id="%1$s" class="sale-widget %2$s">', 'after_widget' => '</div>', 'before_title' => '<h2 class="screen-reader-text">', 'after_title' => '</h2>' ) );
    }
} );
add_action( 'customize_register', function ( $customizer ) {
    $customizer->add_section( 'ff90_banner_sale', array( 'title' => __( 'FF90 Banner Sale', 'ff90-independent' ), 'description' => __( 'เลือกรูป ใส่ลิงก์ แล้ว Publish ได้ทันที ไม่ต้องแก้โค้ด', 'ff90-independent' ) ) );
    foreach ( array( 'header' => __( 'ข้างโลโก้ — 468 × 60', 'ff90-independent' ), 'inline-1' => __( 'คั่นกลุ่มข่าว จุดที่ 1 — 970 × 120', 'ff90-independent' ), 'inline-2' => __( 'คั่นกลุ่มข่าว จุดที่ 2 — 970 × 120', 'ff90-independent' ) ) as $slot => $label ) {
        $id = 'ff90_sale_' . $slot . '_image';
        $customizer->add_setting( $id, array( 'default' => 0, 'capability' => 'edit_theme_options', 'sanitize_callback' => 'absint' ) );
        $customizer->add_control( new WP_Customize_Media_Control( $customizer, $id, array( 'section' => 'ff90_banner_sale', 'label' => $label, 'mime_type' => 'image' ) ) );
        $customizer->add_setting( 'ff90_sale_' . $slot . '_url', array( 'default' => '', 'capability' => 'edit_theme_options', 'sanitize_callback' => 'esc_url_raw' ) );
        $customizer->add_control( 'ff90_sale_' . $slot . '_url', array( 'type' => 'url', 'section' => 'ff90_banner_sale', 'label' => $label . ' — URL', 'description' => __( 'เว้นว่างได้ หากไม่ต้องการให้รูปคลิกได้', 'ff90-independent' ) ) );
    }
    $customizer->add_section( 'ff90_contact', array( 'title' => __( 'FF90 Contact & Social', 'ff90-independent' ) ) );
    $customizer->add_setting( 'ff90_contact_page', array( 'default' => 0, 'capability' => 'edit_theme_options', 'sanitize_callback' => 'absint' ) );
    $customizer->add_control( 'ff90_contact_page', array( 'type' => 'dropdown-pages', 'section' => 'ff90_contact', 'label' => __( 'Contact page', 'ff90-independent' ) ) );
    $customizer->add_setting( 'ff90_contact_email', array( 'default' => '', 'capability' => 'edit_theme_options', 'sanitize_callback' => 'sanitize_email' ) );
    $customizer->add_control( 'ff90_contact_email', array( 'type' => 'email', 'section' => 'ff90_contact', 'label' => __( 'Contact email', 'ff90-independent' ) ) );
    foreach ( array( 'facebook' => 'Facebook', 'line' => 'LINE', 'youtube' => 'YouTube', 'instagram' => 'Instagram', 'tiktok' => 'TikTok', 'x' => 'X' ) as $key => $name ) {
        $id = 'ff90_social_' . $key;
        $customizer->add_setting( $id, array( 'default' => '', 'capability' => 'edit_theme_options', 'sanitize_callback' => 'ff90_sanitize_social_url' ) );
        $customizer->add_control( $id, array( 'type' => 'url', 'section' => 'ff90_contact', 'label' => $name . ' HTTPS URL' ) );
    }
    $customizer->add_setting( 'ff90_show_sale_slots', array( 'default' => true, 'capability' => 'edit_theme_options', 'sanitize_callback' => 'wp_validate_boolean' ) );
    $customizer->add_control( 'ff90_show_sale_slots', array( 'type' => 'checkbox', 'section' => 'ff90_banner_sale', 'label' => __( 'Show available advertising space when no banner is assigned', 'ff90-independent' ) ) );
} );

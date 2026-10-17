<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_seo_article_schema( $post, $url, $description ) {
    $schema = array( '@context' => 'https://schema.org', '@type' => 'post' === $post->post_type ? 'NewsArticle' : 'WebPage', '@id' => $url . '#article', 'url' => $url, 'headline' => wp_strip_all_tags( get_the_title( $post ) ), 'description' => $description, 'datePublished' => get_post_time( 'c', true, $post ), 'dateModified' => get_post_modified_time( 'c', true, $post ), 'author' => array( '@type' => 'Person', 'name' => get_the_author_meta( 'display_name', $post->post_author ), 'url' => get_author_posts_url( $post->post_author ) ), 'publisher' => array( '@type' => 'Organization', 'name' => get_bloginfo( 'name' ), 'url' => home_url( '/' ) ) );
    $image = wp_get_attachment_image_url( get_post_thumbnail_id( $post ), 'full' ); if ( $image ) { $schema['image'] = array( $image ); }
    return $schema;
}
add_action( 'wp', function () {
    if ( ! ff90_seo_owns_output() || ! is_singular( array( 'post', 'page' ) ) || is_preview() ) { return; }
    remove_action( 'wp_head', 'rel_canonical' );
    // Coordinate the exact callback present in Core 0.1.0, without editing Core.
    remove_action( 'wp_head', array( 'Football_Factory_Core', 'print_schema' ), 20 );
} );
add_filter( 'wp_robots', function ( $robots ) {
    if ( ff90_seo_owns_output() && is_singular( array( 'post', 'page' ) ) ) {
        $meta = ff90_seo_clean_meta( get_post_meta( get_queried_object_id(), '_ff90_seo', true ) );
        if ( $meta['noindex'] || post_password_required() || is_preview() ) { $robots['noindex'] = true; unset( $robots['index'] ); }
    }
    return $robots;
} );
add_action( 'wp_head', function () {
    if ( ! ff90_seo_owns_output() || ! is_singular( array( 'post', 'page' ) ) || is_preview() ) { return; }
    $post = get_queried_object(); if ( ! $post instanceof WP_Post || 'publish' !== $post->post_status || post_password_required( $post ) ) { return; }
    $meta = ff90_seo_clean_meta( get_post_meta( $post->ID, '_ff90_seo', true ) );
    $native = wp_get_canonical_url( $post );
    $candidate = $meta['canonical'] ?: $native;
    $canonical = \FF90\SEO\Policy::canonical( home_url( '/' ), (string) $candidate );
    // Invalid overrides never reach HTML. Native URL is still authoritative fallback.
    $url = $canonical['ok'] ? $canonical['url'] : $native;
    $description = $meta['description'] ?: mb_substr( wp_strip_all_tags( strip_shortcodes( $post->post_excerpt ?: $post->post_content ) ), 0, 170, 'UTF-8' );
    echo '<link rel="canonical" href="' . esc_url( $url ) . '">' . "\n";
    if ( $description ) { echo '<meta name="description" content="' . esc_attr( $description ) . '">' . "\n"; }
    $schema = ff90_seo_article_schema( $post, $url, $description );
    echo '<script type="application/ld+json">' . wp_json_encode( $schema, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) . '</script>' . "\n";
}, 25 );
// Derived private scalar enables efficient WordPress sitemap queries; source remains _ff90_seo.
foreach ( array( 'added_post_meta', 'updated_post_meta', 'deleted_post_meta' ) as $hook ) {
    add_action( $hook, function ( $mid, $id, $key ) {
        if ( '_ff90_seo' !== $key ) { return; }
        $meta = ff90_seo_clean_meta( get_post_meta( $id, '_ff90_seo', true ) );
        update_post_meta( $id, '_ff90_seo_noindex', $meta['noindex'] ? '1' : '0' );
    }, 10, 3 );
}
function ff90_seo_indexable_meta_query() {
    return array( 'relation' => 'OR', array( 'key' => '_ff90_seo_noindex', 'compare' => 'NOT EXISTS' ), array( 'key' => '_ff90_seo_noindex', 'value' => '1', 'compare' => '!=' ) );
}
add_filter( 'wp_sitemaps_posts_query_args', function ( $args, $type ) {
    if ( ! ff90_seo_owns_output() || ! in_array( $type, array( 'post', 'page' ), true ) ) { return $args; }
    $args['has_password'] = false;
    $args['meta_query'] = array( 'relation' => 'AND', $args['meta_query'] ?? array(), ff90_seo_indexable_meta_query() );
    return $args;
}, 10, 2 );
function ff90_seo_news_query( $now = null, $page = 1 ) {
    $now = null === $now ? time() : (int) $now;
    return new WP_Query( array( 'post_type' => 'post', 'post_status' => 'publish', 'has_password' => false, 'posts_per_page' => 1000, 'paged' => max( 1, (int) $page ), 'no_found_rows' => false, 'orderby' => array( 'date' => 'DESC', 'ID' => 'DESC' ), 'date_query' => array( array( 'column' => 'post_date_gmt', 'after' => gmdate( 'Y-m-d H:i:s', $now - 48 * HOUR_IN_SECONDS ), 'before' => gmdate( 'Y-m-d H:i:s', $now ), 'inclusive' => true ) ), 'meta_query' => ff90_seo_indexable_meta_query(), 'suppress_filters' => false ) );
}
function ff90_seo_news_xml( $now = null, $page = 0 ) {
    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">';
    if ( ! get_option( 'blog_public' ) ) { return $xml . '</urlset>'; }
    $query = ff90_seo_news_query( $now, max( 1, $page ) );
    if ( 0 === $page && $query->max_num_pages > 1 ) {
        $index = '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        for ( $i = 1; $i <= $query->max_num_pages; ++$i ) { $index .= '<sitemap><loc>' . esc_xml( home_url( '/ff90-news-sitemap-' . $i . '.xml' ) ) . '</loc></sitemap>'; }
        return $index . '</sitemapindex>';
    }
    $language = strtolower( str_replace( '_', '-', get_bloginfo( 'language' ) ) );
    if ( ! in_array( $language, array( 'zh-cn', 'zh-tw' ), true ) ) { $language = explode( '-', $language )[0]; }
    foreach ( $query->posts as $post ) {
        $xml .= '<url><loc>' . esc_xml( get_permalink( $post ) ) . '</loc><news:news><news:publication><news:name>' . esc_xml( get_bloginfo( 'name' ) ) . '</news:name><news:language>' . esc_xml( $language ) . '</news:language></news:publication><news:publication_date>' . esc_xml( get_post_time( 'c', true, $post ) ) . '</news:publication_date><news:title>' . esc_xml( wp_strip_all_tags( get_the_title( $post ) ) ) . '</news:title></news:news></url>';
    }
    return $xml . '</urlset>';
}
function ff90_seo_rewrites() { add_rewrite_rule( '^ff90-news-sitemap\.xml$', 'index.php?ff90_news_sitemap=1', 'top' ); add_rewrite_rule( '^ff90-news-sitemap-([1-9][0-9]*)\.xml$', 'index.php?ff90_news_sitemap=1&ff90_news_page=$matches[1]', 'top' ); }
add_action( 'init', 'ff90_seo_rewrites' );
add_filter( 'query_vars', function ( $vars ) { $vars[] = 'ff90_news_sitemap'; $vars[] = 'ff90_news_page'; return $vars; } );
add_action( 'template_redirect', function () {
    if ( ! get_query_var( 'ff90_news_sitemap' ) ) { return; }
    if ( ! ff90_seo_owns_output() || ! get_option( 'blog_public' ) ) { status_header( 404 ); nocache_headers(); header( 'Content-Type: text/plain; charset=UTF-8' ); echo 'News sitemap unavailable.'; exit; }
    $page = absint( get_query_var( 'ff90_news_page' ) );
    if ( $page > 0 && ! ff90_seo_news_query( null, $page )->posts ) { status_header( 404 ); nocache_headers(); header( 'Content-Type: text/plain; charset=UTF-8' ); echo 'No news on this sitemap page.'; exit; }
    status_header( 200 ); nocache_headers(); header( 'Content-Type: application/xml; charset=UTF-8' ); echo ff90_seo_news_xml( null, $page ); exit;
}, 0 );
add_filter( 'robots_txt', function ( $text, $public ) {
    if ( $public && ff90_seo_owns_output() && get_option( 'permalink_structure' ) ) { $text .= "\nSitemap: " . home_url( '/ff90-news-sitemap.xml' ) . "\n"; }
    return $text;
}, 10, 2 );
register_activation_hook( dirname( __DIR__ ) . '/ff90-seo.php', function () { ff90_seo_rewrites(); flush_rewrite_rules( false ); } );
register_deactivation_hook( dirname( __DIR__ ) . '/ff90-seo.php', function () { global $wp_rewrite; unset( $wp_rewrite->extra_rules_top['^ff90-news-sitemap\\.xml$'], $wp_rewrite->extra_rules_top['^ff90-news-sitemap-([1-9][0-9]*)\\.xml$'] ); flush_rewrite_rules( false ); } );

<?php
if ( ! defined( 'WP_CLI' ) || ! WP_CLI || ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX ) { throw new RuntimeException( 'Disposable sandbox required.' ); }
$old = get_option( 'ff90_seo_settings' ); $public = get_option( 'blog_public' ); $ids = array(); $checks = 0;
$assert = function ( $ok, $message ) use ( &$checks ) { if ( ! $ok ) { throw new RuntimeException( $message ); } echo 'PASS: ' . $message . "\n"; ++$checks; };
try {
    update_option( 'ff90_seo_settings', array( 'owner' => 'standalone', 'gate' => false, 'title_h1' => true ) ); update_option( 'blog_public', 1 );
    $now = time();
    for ( $i = 0; $i < 1001; ++$i ) {
        $id = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'Synthetic sitemap scale fixture ' . $i, 'post_content' => 'Disposable QA data, not real news.', 'post_date_gmt' => gmdate( 'Y-m-d H:i:s', $now - 100 ), 'post_date' => get_date_from_gmt( gmdate( 'Y-m-d H:i:s', $now - 100 ) ) ), true );
        if ( is_wp_error( $id ) ) { throw new RuntimeException( $id->get_error_message() ); } $ids[] = $id;
    }
    $index = new DOMDocument(); $assert( $index->loadXML( ff90_seo_news_xml( $now ) ), '1001+ articles produce valid sitemap index XML' );
    $assert( 'sitemapindex' === $index->documentElement->localName, 'no silent truncation at 1000 articles' );
    $children = $index->getElementsByTagName( 'loc' ); $assert( $children->length >= 2, 'index references child sitemap pages' );
    $all = array();
    for ( $page = 1; $page <= $children->length; ++$page ) {
        $doc = new DOMDocument(); $assert( $doc->loadXML( ff90_seo_news_xml( $now, $page ) ), 'child ' . $page . ' is valid XML' );
        $nodes = $doc->getElementsByTagName( 'url' ); $assert( $nodes->length > 0 && $nodes->length <= 1000, 'child ' . $page . ' respects 1000 URL maximum' );
        foreach ( $doc->getElementsByTagName( 'loc' ) as $node ) { $all[] = $node->textContent; }
    }
    $expected = array_map( 'get_permalink', $ids );
    $assert( ! array_diff( $expected, $all ), 'all 1001 fixture articles included across pages' );
    $assert( count( $all ) === count( array_unique( $all ) ), 'no duplicate URLs between pages' );
    echo "TOTAL: $checks checks passed\n";
} finally {
    foreach ( $ids as $id ) { wp_delete_post( $id, true ); }
    update_option( 'ff90_seo_settings', $old ); update_option( 'blog_public', $public );
}

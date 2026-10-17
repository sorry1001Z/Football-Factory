<?php
if ( ! defined( 'WP_CLI' ) || ! WP_CLI || ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX ) { throw new RuntimeException( 'Disposable local WordPress sandbox required.' ); }
$checks = 0; $ids = array(); $term = 0;
$assert = function ( $yes, $message ) use ( &$checks ) { if ( ! $yes ) { throw new RuntimeException( $message ); } ++$checks; echo "PASS: $message\n"; };
$old = get_option( 'ff90_seo_settings', null ); $public = get_option( 'blog_public' ); $user = get_current_user_id();
$make = function ( $hours, $extra = array() ) use ( &$ids ) {
    $gmt = gmdate( 'Y-m-d H:i:s', time() - $hours * HOUR_IN_SECONDS );
    $id = wp_insert_post( array_merge( array( 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'Synthetic SEO contract news & XML <boundary>', 'post_content' => '<p>SEO contract content</p>', 'post_date_gmt' => $gmt, 'post_date' => get_date_from_gmt( $gmt ) ), $extra ), true );
    if ( is_wp_error( $id ) ) { throw new RuntimeException( $id->get_error_message() ); } $ids[] = $id; return $id;
};
try {
    update_option( 'ff90_seo_settings', array( 'owner' => 'advisory', 'gate' => false, 'title_h1' => true ) ); update_option( 'blog_public', 1 );
    $assert( ! ff90_seo_owns_output(), 'default advisory owns no metadata' );
    foreach ( array( 'javascript:alert(1)', 'https://attacker.example/x', 'http://example.org/x', 'https://user:pass@example.org/', '//attacker.example/', 'https://example.org/a\\b', 'https://example.org/a/../b', 'https://example.org/%2e%2e/b' ) as $bad ) { $assert( ! \FF90\SEO\Policy::canonical( 'https://example.org/', $bad )['ok'], 'reject unsafe/cross-origin canonical: ' . $bad ); }
    $assert( 'https://example.org/article/' === \FF90\SEO\Policy::canonical( 'https://example.org/', '/article/?utm_source=test#top' )['url'], 'canonical keeps permalink trailing slash, removes tracking' );
    $assert( 'https://example.org/?p=42' === \FF90\SEO\Policy::canonical( 'https://example.org/', 'https://example.org/?p=42&utm_campaign=x' )['url'], 'plain WordPress permalink retains identity' );
    $assert( 'https://example.org/page/2/' === \FF90\SEO\Policy::canonical( 'https://example.org/', '/page/2/' )['url'], 'pagination retained' );
    $thin = \FF90\SEO\Policy::analyze( array( 'title' => 'ข่าวฟุตบอลวันนี้ภาษาไทยสำหรับทดสอบ', 'content' => '<p>ข่าวไทยสั้น</p>', 'canonical_valid' => true ) );
    $assert( $thin['signals']['heuristic'] && in_array( 'THIN_CONTENT', $thin['warnings'], true ) && \FF90\SEO\Policy::gate( $thin ), 'Thai short content warns without hard blocking' );
    $double = \FF90\SEO\Policy::analyze( array( 'title' => 'Title', 'content' => '<h1>Second H1</h1>', 'canonical_valid' => true ) );
    $assert( in_array( 'H1_COUNT', $double['blocking'], true ), 'body H1 adds to theme H1' );
    $custom = \FF90\SEO\Policy::analyze( array( 'title' => 'Title', 'content' => '<h1>Only H1</h1>', 'canonical_valid' => true, 'theme_title_h1' => false ) );
    $assert( ! in_array( 'H1_COUNT', $custom['blocking'], true ), 'theme H1 ownership configurable' );
    $recent = $make( 1 ); $oldpost = $make( 49 ); $future = $make( -2, array( 'post_status' => 'future' ) ); $private = $make( 1, array( 'post_status' => 'private' ) ); $password = $make( 1, array( 'post_password' => 'qa-only' ) ); $noindex = $make( 1 );
    update_post_meta( $noindex, '_ff90_seo', array( 'noindex' => true ) );
    $assert( '1' === get_post_meta( $noindex, '_ff90_seo_noindex', true ), 'REST/private object creates queryable noindex marker' );
    $xml = ff90_seo_news_xml(); $doc = new DOMDocument(); $assert( $doc->loadXML( $xml ), 'news sitemap is valid XML' );
    $xpath = new DOMXPath( $doc ); $xpath->registerNamespace( 's', 'http://www.sitemaps.org/schemas/sitemap/0.9' ); $xpath->registerNamespace( 'n', 'http://www.google.com/schemas/sitemap-news/0.9' );
    $urls = array(); foreach ( $xpath->query( '//s:loc' ) as $node ) { $urls[] = $node->textContent; }
    $assert( in_array( get_permalink( $recent ), $urls, true ), 'recent public article included' );
    foreach ( array( $oldpost, $future, $private, $password, $noindex ) as $excluded ) { $assert( ! in_array( get_permalink( $excluded ), $urls, true ), 'exclude old/future/private/password/noindex article ' . $excluded ); }
    $assert( $xpath->query( '//n:publication_date' )->length > 0, 'publication dates emitted in news namespace' );
    update_option( 'blog_public', 0 ); $assert( false === strpos( ff90_seo_news_xml(), '<url>' ), 'private site sitemap empty' ); update_option( 'blog_public', 1 );
    update_option( 'ff90_seo_settings', array( 'owner' => 'standalone', 'gate' => false, 'title_h1' => true ) );
    $assert( ff90_seo_owns_output(), 'standalone explicit opt-in' ); add_filter( 'ff90_seo_external_owner', '__return_true' ); $assert( ! ff90_seo_owns_output(), 'external metadata owner takes precedence' ); remove_filter( 'ff90_seo_external_owner', '__return_true' );
    $args = apply_filters( 'wp_sitemaps_posts_query_args', array( 'post_type' => 'post', 'post_status' => 'publish', 'fields' => 'ids' ), 'post' );
    $normal = new WP_Query( $args ); $assert( ! in_array( $noindex, $normal->posts, true ) && ! in_array( $password, $normal->posts, true ), 'native sitemap excludes noindex and password posts' );
    $t = wp_insert_term( 'QAEntityUnique', 'post_tag' ); if ( is_wp_error( $t ) ) { throw new RuntimeException( $t->get_error_message() ); } $term = $t['term_id']; wp_set_post_terms( $recent, array( $term ), 'post_tag' );
    $assert( 1 === count( ff90_seo_link_suggestions( $recent, '<p>QAEntityUnique news</p>' ) ), 'assigned taxonomy entity suggests a real landing page' );
    foreach ( array( '<a href="/">QAEntityUnique</a>', '<h2>QAEntityUnique</h2>', '<script>QAEntityUnique</script>', '<img alt="QAEntityUnique">', '<!-- QAEntityUnique -->' ) as $protected ) { $assert( ! ff90_seo_link_suggestions( $recent, $protected ), 'link suggestions ignore protected markup' ); }
    wp_set_current_user( 0 );
    $request = new WP_REST_Request( 'POST', '/ff90-seo/v1/analyze/' . $recent ); $assert( 401 === rest_do_request( $request )->get_status(), 'anonymous analysis denied' );
    $admin = get_users( array( 'role' => 'administrator', 'number' => 1 ) )[0]; wp_set_current_user( $admin->ID );
    $request = new WP_REST_Request( 'POST', '/ff90-seo/v1/analyze/' . $recent ); $request->set_param( 'content', '<h1>Unsaved heading</h1>' );
    $response = rest_do_request( $request ); $assert( 200 === $response->get_status() && in_array( 'H1_COUNT', $response->get_data()['blocking'], true ), 'authorized unsaved editor content analyzed without saving' );
    $assert( '<p>SEO contract content</p>' === get_post_field( 'post_content', $recent ), 'analysis never modifies article' );
    $request->set_param( 'content', array( 'malformed' ) ); $assert( 400 === rest_do_request( $request )->get_status(), 'malformed REST analysis input rejected' );
    update_option( 'ff90_seo_settings', array( 'owner' => 'advisory', 'gate' => true, 'title_h1' => true ) );
    wp_update_post( array( 'ID' => $recent, 'post_content' => '<h1>Duplicate heading</h1>', 'post_status' => 'publish' ) );
    $assert( 'pending' === get_post_status( $recent ), 'opt-in structural gate demotes invalid publish' );
    wp_update_post( array( 'ID' => $recent, 'post_content' => '<p>Valid thin Thai ข่าวสั้น</p>', 'post_status' => 'publish' ) );
    $assert( 'publish' === get_post_status( $recent ), 'warning-only content may publish' );
    update_post_meta( $recent, '_ff90_seo', array( 'canonical' => 'https://evil.example/' ) );
    $assert( 'pending' === get_post_status( $recent ), 'post-meta canonical mutation rechecks published content' );
    update_post_meta( $recent, '_ff90_seo', array() );
    wp_update_post( array( 'ID' => $recent, 'post_content' => '<h1>Invalid cron content</h1>', 'post_status' => 'draft' ) ); wp_publish_post( $recent );
    $assert( 'pending' === get_post_status( $recent ), 'direct publish final state rechecked' );
    echo "TOTAL: $checks checks passed\n";
} finally {
    update_option( 'ff90_seo_settings', array( 'gate' => false ) );
    foreach ( $ids as $id ) { wp_delete_post( $id, true ); } if ( $term ) { wp_delete_term( $term, 'post_tag' ); }
    if ( null === $old ) { delete_option( 'ff90_seo_settings' ); } else { update_option( 'ff90_seo_settings', $old ); }
    update_option( 'blog_public', $public ); wp_set_current_user( $user );
}

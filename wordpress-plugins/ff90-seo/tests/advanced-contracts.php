<?php
if ( ! defined( 'WP_CLI' ) || ! WP_CLI || ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX ) { throw new RuntimeException( 'Disposable WordPress sandbox required.' ); }
$checks = 0; $ids = array(); $terms = array(); $old_settings = get_option( 'ff90_seo_settings' );
$assert = function ( $ok, $message ) use ( &$checks ) { if ( ! $ok ) { throw new RuntimeException( $message ); } ++$checks; echo 'PASS: ' . $message . "\n"; };
try {
    update_option( 'ff90_seo_settings', array( 'owner' => 'advisory', 'gate' => false, 'title_h1' => true ) );
    $adapter = apply_filters( 'ff90_seo_domain_adapter', null );
    $assert( $adapter instanceof \FF90\SEO\DomainAdapter, 'football is an optional separate domain plugin' );
    $entities = $adapter->resolveEntity( 'Liverpool and แมนยู news' ); $entity_ids = array_column( $entities, 'id' );
    $assert( in_array( 'team:liverpool', $entity_ids, true ) && in_array( 'team:manchester-united', $entity_ids, true ), 'English and Thai identities resolved from explicit registry' );
    $assert( ! $adapter->resolveEntity( 'unknown fictional player name' ), 'unknown player/match identities never guessed' );
    $entity = array( 'id' => 'team:liverpool', 'type' => 'TEAM' );
    $assert( ! $adapter->getInternalLinkTargets( $entity ), 'no route invented for unmapped football identity' );
    $relations = $adapter->getEntityRelations( $entity );
    $assert( $relations && 'static_registry_not_current_season' === $relations[0]['provenance'], 'relations explicitly marked static, not live membership' );
    $assert( 'SportsOrganization' === $adapter->getSchemaExtensions( $entity )[0]['@type'], 'known team produces advisory SportsOrganization' );
    $assert( ! $adapter->getSchemaExtensions( array( 'id' => 'player:unknown', 'type' => 'PLAYER' ) ), 'Person schema refused without authoritative registry' );
    $intent = \FF90\SEO\Intent::classify( 'ตารางคะแนนพรีเมียร์ลีก', $adapter->getIntentRules(), array( 'locale' => 'th' ) );
    $assert( 'STANDINGS' === $intent['intent'], 'real V3 football intent rules run in PHP' );
    $tag = wp_insert_term( 'QA Liverpool mapping ' . wp_generate_uuid4(), 'post_tag' ); $terms[] = $tag['term_id'];
    update_term_meta( $tag['term_id'], '_ff90_seo_football_id', 'team:liverpool' );
    $assert( '' === ff90_seo_football_route( $entity ), 'unverified route mapping excluded' );
    update_term_meta( $tag['term_id'], '_ff90_seo_football_verified', '1' );
    $assert( get_term_link( $tag['term_id'], 'post_tag' ) === ff90_seo_football_route( $entity ), 'verified real taxonomy archive used as landing URL' );
    $id = wp_insert_post( array( 'post_type' => 'post', 'post_status' => 'draft', 'post_title' => 'Liverpool football news report', 'post_content' => '<p>Liverpool football news here.</p><h2>Repeated heading</h2><h2>Repeated heading</h2><img src="image.png" alt="">' ) ); $ids[] = $id;
    update_post_meta( $id, '_ff90_seo', array( 'target_keyword' => 'premier league standings', 'description' => 'A test description for the original SEO analysis port.' ) );
    $report = ff90_seo_analyze( $id );
    $assert( 'STANDINGS' === $report['intent']['intent'], 'article target keyword drives intent separately from headline' );
    $assert( in_array( 'DUPLICATE_HEADING', $report['warnings'], true ) && in_array( 'IMAGE_ALT_GAPS', $report['warnings'], true ), 'deep quality issues surface in native article analysis' );
    $assert( $report['schema_validation']['valid'], 'candidate article plus domain graph structurally validated' );
    $assert( count( $report['links'] ) === 1 && $report['links'][0]['url'] === get_term_link( $tag['term_id'], 'post_tag' ), 'domain link uses one existing verified archive without duplicate aliases' );
    $GLOBALS['wp_filter']['ff90_seo_domain_adapter_saved_qa'] = clone $GLOBALS['wp_filter']['ff90_seo_domain_adapter'];
    remove_all_filters( 'ff90_seo_domain_adapter' ); $generic = ff90_seo_analyze( $id ); $GLOBALS['wp_filter']['ff90_seo_domain_adapter'] = $GLOBALS['wp_filter']['ff90_seo_domain_adapter_saved_qa']; unset( $GLOBALS['wp_filter']['ff90_seo_domain_adapter_saved_qa'] );
    $assert( ! $generic['domain']['connected'] && $generic['schema_validation']['valid'], 'generic SEO works independently with football adapter absent' );
    $duplicate = function ( $nodes ) { $nodes[] = $nodes[0]; return $nodes; }; add_filter( 'ff90_seo_schema_nodes', $duplicate ); $invalid = ff90_seo_analyze( $id ); remove_filter( 'ff90_seo_schema_nodes', $duplicate );
    $assert( ! $invalid['schema_validation']['valid'] && in_array( 'DUPLICATE_ID', array_column( $invalid['schema_validation']['issues'], 'code' ), true ), 'duplicate graph node IDs reported to editor' );
    $tag2 = wp_insert_term( 'QA duplicate Liverpool mapping ' . wp_generate_uuid4(), 'post_tag' ); $terms[] = $tag2['term_id']; update_term_meta( $tag2['term_id'], '_ff90_seo_football_id', 'team:liverpool' ); update_term_meta( $tag2['term_id'], '_ff90_seo_football_verified', '1' );
    $assert( '' === ff90_seo_football_route( $entity ), 'ambiguous verified routes withheld instead of arbitrarily chosen' );
    $targets = array( array( 'label' => 'Liverpool', 'url' => '/liverpool/', 'entityId' => 'team:liverpool', 'entityType' => 'TEAM', 'confidence' => 0.95 ) );
    foreach ( array( '<a href="/old/">Liverpool</a>', '<h2>Liverpool</h2>', '<script>Liverpool</script>', '<style>Liverpool</style>', '<img alt="Liverpool">', '<!-- Liverpool -->' ) as $html ) { $assert( ! \FF90\SEO\Links::suggest( $html, $targets ), 'link engine protects existing markup' ); }
    $html = '<p>⚽ ข่าว Liverpool news</p>'; $links = \FF90\SEO\Links::suggest( $html, $targets );
    $assert( 10 === $links[0]['startOffset'] && 19 === $links[0]['endOffset'], 'Thai/emoji link offsets use UTF-16 units for JS editor' );
    $assert( ! \FF90\SEO\Links::suggest( $html, $targets, array( '/liverpool/' ) ), 'existing target URL not suggested again' );
    $targets[] = array_merge( $targets[0], array( 'entityId' => 'team:other', 'url' => '/other/' ) );
    $assert( ! \FF90\SEO\Links::suggest( $html, $targets ), 'ambiguous shared anchor label withheld' );
    $assert( $report['gsc']['configured'] === false && $report['gsc']['connected'] === false, 'unconfigured optional GSC reports disconnected, no metrics' );
    $requests = 0; $http = function () use ( &$requests ) { ++$requests; return new WP_Error( 'qa_no_network' ); }; add_filter( 'pre_http_request', $http ); ff90_seo_analyze( $id ); remove_filter( 'pre_http_request', $http );
    $assert( 0 === $requests, 'live typing analysis never sends content or calls GSC externally' );
    echo "TOTAL: $checks advanced module checks passed\n";
} finally {
    foreach ( $ids as $id ) { wp_delete_post( $id, true ); } foreach ( $terms as $term ) { wp_delete_term( $term, 'post_tag' ); } update_option( 'ff90_seo_settings', $old_settings );
}

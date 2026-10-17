<?php
namespace FF90\SEO;
/** V3 graph validation, advisory; not Google's rich-result eligibility checker. */
final class Schema {
    public static function graph( array $nodes ): array { return array( '@context' => 'https://schema.org', '@graph' => $nodes ); }
    public static function validate( $doc ): array {
        if ( ! is_array( $doc ) || empty( $doc['@graph'] ) || ! is_array( $doc['@graph'] ) ) { return array( 'valid' => false, 'issues' => array( array( 'code' => 'EMPTY_GRAPH', 'detail' => '@graph missing or empty' ) ) ); }
        $issues = array(); $ids = array(); $refs = array();
        foreach ( $doc['@graph'] as $i => $node ) {
            if ( ! is_array( $node ) || empty( $node['@type'] ) ) { $issues[] = array( 'code' => 'MISSING_TYPE', 'detail' => 'node at index ' . $i ); }
            if ( is_array( $node ) && isset( $node['@id'] ) && is_string( $node['@id'] ) ) {
                if ( isset( $ids[ $node['@id'] ] ) ) { $issues[] = array( 'code' => 'DUPLICATE_ID', 'detail' => $node['@id'] ); }
                $ids[ $node['@id'] ] = true;
            }
        }
        $walk = static function ( $v, $depth = 0 ) use ( &$walk, &$refs, &$issues ) {
            if ( $depth > 100 ) { $issues[] = array( 'code' => 'DEPTH_LIMIT', 'detail' => 'Graph exceeds safe nesting depth' ); return; }
            if ( ! is_array( $v ) ) { return; }
            if ( 1 === count( $v ) && isset( $v['@id'] ) && is_string( $v['@id'] ) ) { $refs[] = $v['@id']; return; }
            foreach ( $v as $child ) { $walk( $child, $depth + 1 ); }
        };
        foreach ( $doc['@graph'] as $node ) { $walk( $node ); }
        foreach ( $refs as $ref ) { if ( ! isset( $ids[ $ref ] ) && ! preg_match( '~^https?://~', $ref ) ) { $issues[] = array( 'code' => 'UNRESOLVED_REF', 'detail' => $ref ); } }
        return array( 'valid' => ! $issues, 'issues' => $issues );
    }
}

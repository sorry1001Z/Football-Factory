<?php
namespace FF90\SEO;
/** Suggested links only; offsets use UTF-16 units for Gutenberg/JS compatibility. */
final class Links {
    private static function lower( $s ) { return function_exists( 'mb_strtolower' ) ? mb_strtolower( $s, 'UTF-8' ) : strtolower( $s ); }
    private static function units( $s ) { return strlen( iconv( 'UTF-8', 'UTF-16LE', $s ) ) / 2; }
    public static function suggest( string $html, array $targets, array $existing = array(), array $options = array() ): array {
        $c = array_merge( array( 'maxLinksTotal' => 6, 'maxLinksPerEntityType' => 2, 'minConfidence' => 0.7, 'allowRepeatedAnchor' => false, 'maxAnchorLength' => 80 ), $options );
        $protected = array();
        foreach ( array( '~<a\b[^>]*>.*?</a>~is', '~<h[1-6]\b[^>]*>.*?</h[1-6]>~is', '~<script\b[^>]*>.*?</script>~is', '~<style\b[^>]*>.*?</style>~is', '~<!--.*?-->~s', '~<\s*[A-Za-z][^<>]*?>~s' ) as $regex ) {
            preg_match_all( $regex, $html, $m, PREG_OFFSET_CAPTURE ); foreach ( $m[0] as $match ) { $protected[] = array( $match[1], $match[1] + strlen( $match[0] ) ); }
        }
        usort( $targets, static function ( $a, $b ) { return ( ( $b['confidence'] ?? 0 ) <=> ( $a['confidence'] ?? 0 ) ) ?: ( ( $b['priority'] ?? 50 ) <=> ( $a['priority'] ?? 50 ) ) ?: strcmp( $a['entityId'], $b['entityId'] ) ?: strcmp( $a['url'], $b['url'] ); } );
        $used = array_fill_keys( $existing, true ); $anchors = array(); $per_type = array(); $out = array();
        foreach ( $targets as $t ) {
            if ( count( $out ) >= $c['maxLinksTotal'] ) { break; }
            if ( ( $t['confidence'] ?? 0 ) < $c['minConfidence'] || isset( $used[ $t['url'] ] ) || ( $per_type[ $t['entityType'] ] ?? 0 ) >= $c['maxLinksPerEntityType'] ) { continue; }
            $anchor = trim( $t['label'] ?? '' ); $key = self::lower( $anchor );
            if ( '' === $anchor || self::units( $anchor ) > $c['maxAnchorLength'] || ( ! $c['allowRepeatedAnchor'] && isset( $anchors[ $key ] ) ) ) { continue; }
            foreach ( $targets as $other ) { if ( self::lower( $other['label'] ?? '' ) === $key && $other['entityId'] !== $t['entityId'] && ( $other['confidence'] ?? 0 ) >= $c['minConfidence'] ) { continue 2; } }
            preg_match_all( '/(?:^|[^\p{L}\p{N}])(' . preg_quote( $anchor, '/' ) . ')(?=$|[^\p{L}\p{N}])/iu', $html, $matches, PREG_OFFSET_CAPTURE );
            $chosen = null;
            foreach ( $matches[1] as $match ) {
                $start = $match[1]; $end = $start + strlen( $match[0] );
                foreach ( $protected as $range ) { if ( $start < $range[1] && $end > $range[0] ) { continue 2; } }
                $chosen = array( $start, $end ); break;
            }
            if ( ! $chosen ) { continue; }
            $out[] = array( 'anchor' => $anchor, 'target' => $t['url'], 'reason' => 'High-confidence entity match; suggestion only', 'confidence' => $t['confidence'], 'startOffset' => (int) self::units( substr( $html, 0, $chosen[0] ) ), 'endOffset' => (int) self::units( substr( $html, 0, $chosen[1] ) ), 'entityId' => $t['entityId'], 'entityType' => $t['entityType'] );
            $used[ $t['url'] ] = true; $anchors[ $key ] = true; $per_type[ $t['entityType'] ] = ( $per_type[ $t['entityType'] ] ?? 0 ) + 1;
        }
        usort( $out, static function ( $a, $b ) { return ( $b['confidence'] <=> $a['confidence'] ) ?: ( $a['startOffset'] <=> $b['startOffset'] ) ?: strcmp( $a['target'], $b['target'] ); } );
        return $out;
    }
}

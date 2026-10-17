<?php
namespace FF90\SEO;
/** Framework-independent subset of V3. Not a complete V3 parity port. */
final class Policy {
    public static function canonical( string $origin, string $candidate ): array {
        $base = parse_url( $origin );
        if ( ! is_array( $base ) || empty( $base['host'] ) || ! in_array( strtolower( $base['scheme'] ?? '' ), array( 'http', 'https' ), true ) ) { return array( 'ok' => false, 'reason' => 'INVALID_ORIGIN' ); }
        $candidate = trim( $candidate );
        if ( '' === $candidate ) { return array( 'ok' => false, 'reason' => 'EMPTY_INPUT' ); }
        if ( preg_match( '/[\x00-\x20\\\\]/', $candidate ) ) { return array( 'ok' => false, 'reason' => 'INVALID_URL' ); }
        if ( '/' === substr( $candidate, 0, 1 ) && '//' !== substr( $candidate, 0, 2 ) ) {
            $candidate = strtolower( $base['scheme'] ) . '://' . $base['host'] . ( isset( $base['port'] ) ? ':' . $base['port'] : '' ) . $candidate;
        }
        $url = parse_url( $candidate );
        if ( ! is_array( $url ) || empty( $url['host'] ) || ! in_array( strtolower( $url['scheme'] ?? '' ), array( 'http', 'https' ), true ) || isset( $url['user'] ) || isset( $url['pass'] ) ) { return array( 'ok' => false, 'reason' => 'INVALID_URL' ); }
        // Deliberately stricter than V3: no cross-host, cross-scheme or cross-port canonical overrides.
        $port = static function ( $u ) { return $u['port'] ?? ( 'https' === strtolower( $u['scheme'] ) ? 443 : 80 ); };
        if ( strtolower( $url['host'] ) !== strtolower( $base['host'] ) || strtolower( $url['scheme'] ) !== strtolower( $base['scheme'] ) || $port( $url ) !== $port( $base ) ) { return array( 'ok' => false, 'reason' => 'CROSS_ORIGIN' ); }
        $path = preg_replace( '~/+~', '/', $url['path'] ?? '/' );
        // Dot segments and query-bearing native WordPress permalinks must keep their semantics.
        if ( preg_match( '~(?:^|/)\.{1,2}(?:/|$)~', rawurldecode( $path ) ) ) { return array( 'ok' => false, 'reason' => 'INVALID_URL' ); }
        $query = array();
        parse_str( $url['query'] ?? '', $query );
        $kept = array();
        foreach ( array( 'p', 'page_id', 'attachment_id', 'page' ) as $key ) {
            if ( isset( $query[ $key ] ) && is_scalar( $query[ $key ] ) && ctype_digit( (string) $query[ $key ] ) && (int) $query[ $key ] > 0 ) { $kept[ $key ] = (int) $query[ $key ]; }
        }
        return array( 'ok' => true, 'reason' => 'OK', 'url' => strtolower( $url['scheme'] ) . '://' . strtolower( $url['host'] ) . ( isset( $url['port'] ) ? ':' . $url['port'] : '' ) . ( $path ?: '/' ) . ( $kept ? '?' . http_build_query( $kept ) : '' ) );
    }
    public static function analyze( array $input ): array {
        $blocking = array(); $warnings = array(); $score = 100;
        $title = trim( strip_tags( (string) ( $input['title'] ?? '' ) ) );
        $meta = trim( strip_tags( (string) ( $input['description'] ?? '' ) ) );
        $html = (string) ( $input['content'] ?? '' );
        $text = trim( html_entity_decode( strip_tags( preg_replace( '~<(script|style)\b[^>]*>.*?</\1>~is', '', $html ) ), ENT_QUOTES, 'UTF-8' ) );
        $len = static function ( $s ) { return preg_match_all( '/./us', $s ); };
        if ( empty( $input['canonical_valid'] ) ) { $blocking[] = 'INVALID_CANONICAL'; $score -= 25; }
        // WordPress themes normally render the post title as the one H1. Raw body H1s add to it.
        $headings = preg_replace( '~<(script|style)\b[^>]*>.*?</\1>|<!--.*?-->~is', '', $html );
        $h1 = preg_match_all( '/<h1\b/i', $headings ) + ( $input['theme_title_h1'] ?? true ? 1 : 0 );
        if ( 1 !== $h1 ) { $blocking[] = 'H1_COUNT'; $score -= 15; }
        if ( '' === $title ) { $blocking[] = 'MISSING_TITLE'; $score -= 15; }
        if ( $len( $title ) < 20 || $len( $title ) > 65 ) { $warnings[] = 'TITLE_LENGTH'; $score -= 6; }
        if ( $len( $meta ) < 70 || $len( $meta ) > 170 ) { $warnings[] = 'META_LENGTH'; $score -= 5; }
        $thai = (bool) preg_match( '/[\x{0E00}-\x{0E7F}]/u', $text );
        $terms = preg_match_all( '/[\p{L}\p{N}]+/u', $text );
        if ( $thai ) { $terms = max( $terms, (int) ceil( $len( preg_replace( '/\s/u', '', $text ) ) / 5 ) ); }
        if ( $terms < 300 ) { $warnings[] = 'THIN_CONTENT'; $score -= 12; }
        preg_match_all( '/<img\b[^>]*>/i', $html, $images );
        foreach ( $images[0] as $image ) {
            if ( ! preg_match( '/\balt\s*=\s*([\'"])(.*?)\1/is', $image, $alt ) || '' === trim( $alt[2] ) ) { $warnings[] = 'IMAGE_ALT_REVIEW'; $score -= 4; break; }
        }
        return array( 'policy_version' => 'wp-0.1', 'score' => max( 0, $score ), 'blocking' => array_values( array_unique( $blocking ) ), 'warnings' => array_values( array_unique( $warnings ) ), 'signals' => array( 'h1_count' => $h1, 'term_count' => $terms, 'heuristic' => $thai ), 'fact_check' => 'not_performed' );
    }
    public static function gate( array $report ): bool { return empty( $report['blocking'] ); }
}

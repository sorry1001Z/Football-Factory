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
        $html = (string) ( $input['content'] ?? '' );
        $clean = preg_replace( '~<(script|style)\b[^>]*>.*?</\1>|<!--.*?-->~is', '', $html );
        $h1 = array(); $h2 = array(); $images = array(); $links = 0;
        if ( class_exists( '\DOMDocument' ) ) {
            $dom = new \DOMDocument(); $before = libxml_use_internal_errors( true );
            $dom->loadHTML( '<?xml encoding="UTF-8">' . $clean, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING );
            libxml_clear_errors(); libxml_use_internal_errors( $before );
            foreach ( $dom->getElementsByTagName( 'h1' ) as $node ) { $h1[] = $node->textContent; }
            foreach ( $dom->getElementsByTagName( 'h2' ) as $node ) { $h2[] = $node->textContent; }
            foreach ( $dom->getElementsByTagName( 'img' ) as $node ) { $images[] = array( 'alt' => $node->getAttribute( 'alt' ) ); }
        } else {
            foreach ( array( 'h1', 'h2' ) as $tag ) { preg_match_all( '~<' . $tag . '\b[^>]*>(.*?)</' . $tag . '>~is', $clean, $m ); foreach ( $m[1] as $heading ) { if ( 'h1' === $tag ) { $h1[] = strip_tags( $heading ); } else { $h2[] = strip_tags( $heading ); } } }
        }
        if ( $input['theme_title_h1'] ?? true ) { array_unshift( $h1, (string) ( $input['title'] ?? '' ) ); }
        $body = html_entity_decode( strip_tags( preg_replace( '~</(?:p|div|section|article|h[1-6]|li)>~i', "\n\n", $clean ) ), ENT_QUOTES, 'UTF-8' );
        $locale = $input['locale'] ?? ( preg_match( '/[\x{0E00}-\x{0E7F}]/u', $body ) ? 'th' : 'en' );
        $quality_input = array_merge( array( 'title' => $input['title'] ?? '', 'meta' => $input['description'] ?? '', 'body' => $body, 'h1' => $h1, 'h2' => $h2, 'images' => $images, 'locale' => $locale, 'canonicalValid' => (bool) ( $input['canonical_valid'] ?? false ), 'targetKeyword' => $input['target_keyword'] ?? '', 'internalLinks' => $input['internal_links'] ?? 0 ), $input['quality_input'] ?? array() );
        $deep = Quality::score( $quality_input, $input['thresholds'] ?? array() );
        $blocking = array_column( $deep['blockingIssues'], 'code' );
        if ( '' === trim( strip_tags( $input['title'] ?? '' ) ) ) { $blocking[] = 'MISSING_TITLE'; }
        return array( 'policy_version' => 'wp-0.2', 'score' => $deep['score'], 'blocking' => $blocking, 'warnings' => array_column( $deep['warnings'], 'code' ), 'opportunities' => array_column( $deep['opportunities'], 'code' ), 'deep_quality' => $deep, 'signals' => array_merge( $deep['signals'], array( 'h1_count' => count( $h1 ), 'term_count' => $deep['signals']['termCount'] ) ), 'fact_check' => 'not_performed' );
    }
    public static function gate( array $report ): bool { return empty( $report['blocking'] ); }
}

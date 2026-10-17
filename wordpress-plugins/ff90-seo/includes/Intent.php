<?php
namespace FF90\SEO;
final class Intent {
    public static function normalize( string $text ): string {
        if ( class_exists( '\Normalizer' ) ) { $text = \Normalizer::normalize( $text, \Normalizer::FORM_KC ); }
        $text = function_exists( 'mb_strtolower' ) ? mb_strtolower( $text, 'UTF-8' ) : strtolower( $text );
        return trim( preg_replace( '/\s+/u', ' ', preg_replace( '/[^\p{L}\p{M}\p{N}\s-]/u', ' ', $text ) ) );
    }
    public static function matches( string $text, string $phrase ): bool {
        $phrase = self::normalize( $phrase );
        return '' !== $phrase && (bool) preg_match( '/(?:^|[^\p{L}\p{N}])' . preg_quote( $phrase, '/' ) . '(?:$|[^\p{L}\p{N}])/u', self::normalize( $text ) );
    }
    public static function classify( string $keyword, array $rules, array $options = array() ) {
        $locale = $options['locale'] ?? 'en'; $scored = array();
        if ( '' === self::normalize( $keyword ) ) { return null; }
        foreach ( $rules as $r ) {
            if ( ! is_array( $r ) || ( isset( $r['locale'] ) && $r['locale'] !== $locale ) ) { continue; }
            foreach ( $r['negativePatterns'] ?? array() as $negative ) { if ( self::matches( $keyword, $negative ) ) { continue 2; } }
            $points = 0; $matched = array();
            foreach ( $r['patterns'] ?? array() as $p ) {
                $phrase = is_string( $p ) ? $p : $p['phrase'];
                if ( self::matches( $keyword, $phrase ) ) { $points += is_string( $p ) ? 1 : ( $p['weight'] ?? 1 ); $matched[] = $phrase; }
            }
            if ( $points > 0 && $points >= ( $r['minScore'] ?? 1 ) ) { $scored[] = array( 'rule' => $r, 'points' => $points, 'matched' => $matched ); }
        }
        if ( ! $scored ) { return null; }
        usort( $scored, static function ( $a, $b ) { return ( $b['points'] <=> $a['points'] ) ?: ( ( $b['rule']['priority'] ?? 50 ) <=> ( $a['rule']['priority'] ?? 50 ) ) ?: strcmp( $a['rule']['id'], $b['rule']['id'] ); } );
        $top = $scored[0]; $r = $top['rule']; $margin = max( 0, $top['points'] - ( $scored[1]['points'] ?? 0 ) );
        $confidence = max( 0, min( 1, 0.5 + $top['points'] * 0.08 + $margin * 0.04 ) );
        if ( $confidence < ( $options['minConfidence'] ?? 0 ) ) { return null; }
        $out = array( 'keyword' => $keyword, 'intent' => $r['intent'], 'priority' => $r['priority'] ?? 50, 'confidence' => round( $confidence, 2 ), 'matchedRules' => array_values( array_map( static function ( $s ) { return $s['rule']['id']; }, array_filter( $scored, static function ( $s ) use ( $top ) { return $s['points'] === $top['points']; } ) ) ), 'explanation' => 'Matched weighted phrases: ' . implode( ', ', $top['matched'] ) . '; score=' . $top['points'] . '; margin=' . $margin . '; locale=' . $locale, 'locale' => $locale, 'ambiguous' => count( $scored ) > 1 && $margin < 0.5 );
        foreach ( array( 'entityType', 'entityId', 'landingPageType' ) as $key ) { if ( isset( $r[ $key ] ) ) { $out[ $key ] = $r[ $key ]; } }
        return $out;
    }
}

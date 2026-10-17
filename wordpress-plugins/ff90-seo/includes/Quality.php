<?php
namespace FF90\SEO;
/** V3 scoring rules. Pure data in/out; Thai readability never a hard veto. */
final class Quality {
    private static function length( string $s ): int { return (int) ( strlen( iconv( 'UTF-8', 'UTF-16LE', $s ) ) / 2 ); }
    private static function norm( string $s ): string { return trim( preg_replace( '/\s+/u', ' ', function_exists( 'mb_strtolower' ) ? mb_strtolower( $s, 'UTF-8' ) : strtolower( $s ) ) ); }
    public static function terms( string $s, bool $thai ): int {
        if ( ! $thai ) { return (int) preg_match_all( "/\\b[\\p{L}\\p{N}'’\\-]+\\b/u", $s ); }
        preg_match_all( '/[\x{0E00}-\x{0E7F}]+/u', $s, $matches ); $text = implode( '', $matches[0] );
        $clusters = preg_match_all( '/[ก-ฮ][\x{0E31}-\x{0E4E}]*[ะาำิีึืุูเแโใไๅๆ]*[\x{0E31}-\x{0E4E}]*/u', $text );
        return max( $clusters, (int) ceil( self::length( $text ) / 5 ) ) + preg_match_all( '/\b[A-Za-z0-9]+\b/', $s );
    }
    public static function score( array $input, array $thresholds = array(), $now = null ): array {
        $c = array_merge( array( 'minTerms' => 300, 'maxTitle' => 65, 'minTitle' => 20, 'minMeta' => 70, 'maxMeta' => 170, 'maxAvgSentence' => 30, 'maxParagraphTerms' => 140, 'stuffingRatio' => 0.04, 'repeatedPhraseLimit' => 4, 'freshDays' => 180, 'minInternalLinks' => 1, 'requireExternalAuthority' => false, 'requiredSchemaByPageType' => array() ), $thresholds );
        $score = 100; $blocking = array(); $warnings = array(); $opportunities = array(); $recommendations = array();
        $issue = static function ( $code, $kind, $detail = null ) { $r = array( 'code' => $code, 'kind' => $kind ); if ( null !== $detail ) { $r['detail'] = $detail; } return $r; };
        $body = (string) ( $input['body'] ?? '' ); $title = (string) ( $input['title'] ?? '' ); $meta = (string) ( $input['meta'] ?? '' ); $h1 = $input['h1'] ?? array(); $h2 = $input['h2'] ?? array();
        $thai = 0 === strpos( strtolower( $input['locale'] ?? 'en' ), 'th' );
        $terms = self::terms( $body, $thai ); $sentences = max( 1, count( array_filter( array_map( 'trim', preg_split( '/(?<=[.!?。！？])\s*/u', $body ) ), 'strlen' ) ) ); $avg = $terms / $sentences;
        $max_para = 0; foreach ( preg_split( '/\n\s*\n/u', $body ) as $para ) { $max_para = max( $max_para, self::terms( trim( $para ), $thai ) ); }
        if ( isset( $input['canonicalValid'] ) && false === $input['canonicalValid'] ) { $score -= 25; $blocking[] = $issue( 'INVALID_CANONICAL', 'blocking' ); }
        if ( 1 !== count( $h1 ) ) { $score -= 15; $blocking[] = $issue( 'H1_COUNT', 'blocking', 'h1Count=' . count( $h1 ) ); }
        if ( $terms < $c['minTerms'] ) { $score -= 12; $warnings[] = $issue( 'THIN_CONTENT', 'warning' ); $recommendations[] = 'Increase useful content depth'; }
        $tlen = self::length( $title ); $mlen = self::length( $meta );
        if ( $tlen < $c['minTitle'] || $tlen > $c['maxTitle'] ) { $score -= 6; $warnings[] = $issue( 'TITLE_LENGTH', 'warning', 'tlen=' . $tlen ); }
        if ( $mlen < $c['minMeta'] || $mlen > $c['maxMeta'] ) { $score -= 5; $warnings[] = $issue( 'META_LENGTH', 'warning', 'mlen=' . $mlen ); }
        $headings = array_map( array( self::class, 'norm' ), array_merge( $h1, $h2 ) );
        if ( count( array_unique( $headings ) ) < count( $headings ) ) { $score -= 5; $warnings[] = $issue( 'DUPLICATE_HEADING', 'warning' ); }
        $title_h1_duplicate = ! empty( $h1[0] ) && self::norm( $title ) === self::norm( $h1[0] );
        if ( $title_h1_duplicate ) { $opportunities[] = $issue( 'TITLE_H1_DIFFERENTIATION', 'opportunity' ); }
        if ( $title && $meta && self::norm( $title ) === self::norm( $meta ) ) { $score -= 3; $warnings[] = $issue( 'META_DUPLICATES_TITLE', 'warning' ); }
        if ( ! $thai && $avg > $c['maxAvgSentence'] ) { $score -= 5; $warnings[] = $issue( 'LONG_SENTENCES', 'warning', 'avg=' . number_format( $avg, 1, '.', '' ) ); }
        if ( $max_para > $c['maxParagraphTerms'] ) { $score -= 4; $warnings[] = $issue( 'LONG_PARAGRAPH', 'warning', 'maxPara=' . $max_para ); }
        $target = self::norm( $input['targetKeyword'] ?? '' ); $occurrences = $target ? substr_count( self::norm( $body ), $target ) : 0; $ratio = $terms > 0 ? $occurrences / $terms : 0;
        if ( $target && $ratio > $c['stuffingRatio'] ) { $score -= 8; $warnings[] = $issue( 'KEYWORD_STUFFING_RISK', 'warning', 'ratio=' . number_format( $ratio, 3, '.', '' ) ); }
        $tokens = preg_split( '/\s+/u', self::norm( $body ), -1, PREG_SPLIT_NO_EMPTY ); $grams = array();
        for ( $i = 0; $i < count( $tokens ) - 2; ++$i ) { $g = implode( ' ', array_slice( $tokens, $i, 3 ) ); $grams[ $g ] = ( $grams[ $g ] ?? 0 ) + 1; }
        $repeat = $grams ? max( $grams ) : 0;
        if ( $repeat > $c['repeatedPhraseLimit'] ) { $score -= 5; $warnings[] = $issue( 'REPEATED_PHRASE_RISK', 'warning', 'maxTrigram=' . $repeat ); }
        $age = null;
        if ( ! empty( $input['updatedAt'] ) && false !== ( $time = strtotime( $input['updatedAt'] ) ) ) { $age = max( 0, ( ( null === $now ? time() : $now ) - $time ) / 86400 ); if ( $age > $c['freshDays'] ) { $score -= 4; $opportunities[] = $issue( 'CONTENT_REFRESH', 'opportunity', 'ageDays=' . (int) round( $age ) ); } }
        if ( isset( $input['sourceComplete'] ) && false === $input['sourceComplete'] ) { $score -= 7; $warnings[] = $issue( 'PROVENANCE_INCOMPLETE', 'warning' ); }
        $missing = array_values( array_diff( $c['requiredSchemaByPageType'][ $input['pageType'] ?? '' ] ?? array(), $input['schemaTypes'] ?? array() ) );
        if ( $missing ) { $score -= 8; $warnings[] = $issue( 'SCHEMA_INCOMPLETE', 'warning', 'missing=' . implode( ',', $missing ) ); }
        $images = $input['images'] ?? array(); $coverage = $images ? count( array_filter( $images, static function ( $image ) { return '' !== trim( $image['alt'] ?? '' ); } ) ) / count( $images ) : 1;
        if ( $coverage < 1 ) { $score -= (int) ceil( ( 1 - $coverage ) * 8 ); $warnings[] = $issue( 'IMAGE_ALT_GAPS', 'warning', 'coverage=' . number_format( $coverage, 2, '.', '' ) ); }
        if ( ( $input['internalLinks'] ?? 0 ) < $c['minInternalLinks'] ) { $score -= 5; $opportunities[] = $issue( 'INTERNAL_LINK_OPPORTUNITY', 'opportunity' ); }
        if ( $c['requireExternalAuthority'] && empty( $input['hasAuthoritativeExternalSource'] ) ) { $score -= 4; $opportunities[] = $issue( 'AUTHORITATIVE_SOURCE_OPPORTUNITY', 'opportunity' ); }
        if ( ! empty( $input['duplicateContentSignal'] ) ) { $score -= 8; $warnings[] = $issue( 'DUPLICATE_CONTENT_SIGNAL', 'warning' ); }
        return array( 'score' => max( 0, (int) round( $score ) ), 'blockingIssues' => $blocking, 'warnings' => $warnings, 'opportunities' => $opportunities, 'recommendations' => $recommendations, 'signals' => array( 'termCount' => $terms, 'sentenceCount' => $sentences, 'averageSentenceLength' => $avg, 'maxParagraphTerms' => $max_para, 'keywordOccurrenceRatio' => $ratio, 'maxRepeatedTrigram' => $repeat, 'freshnessDays' => $age, 'imageAltCoverage' => $coverage, 'missingSchema' => $missing, 'titleH1Duplicate' => $title_h1_duplicate, 'heuristic' => $thai ), 'policyVersion' => '1' );
    }
}

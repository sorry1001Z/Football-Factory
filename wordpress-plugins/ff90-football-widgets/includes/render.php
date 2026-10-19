<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
function ff90_football_render( $kind, $args = array() ) {
    $args = shortcode_atts( array( 'competition' => '', 'date' => '' ), $args );
    $data = function_exists( 'ff90_football_get' ) ? ff90_football_get( 'standings' === $kind ? 'standings' : 'matches', $args['competition'], $args['date'] ) : new WP_Error( 'dependency_missing', 'Football Data Engine not active.' );
    if ( is_wp_error( $data ) ) { return '<p class="ff90-football-unavailable">' . esc_html( $data->get_error_message() ) . '</p>'; }
    $html = '<section class="ff90-football-data"><p>Source: <a rel="nofollow" href="' . esc_url( $data['source_url'] ) . '">' . esc_html( $data['provider'] ) . '</a> · <time datetime="' . esc_attr( $data['fetched_at'] ) . '">' . esc_html( $data['fetched_at'] ) . '</time>' . ( $data['stale'] ? ' · ข้อมูลแคชเก่า — ยังอัปเดตจากแหล่งข้อมูลไม่ได้' : '' ) . '</p>';
    if ( ! empty( $data['season_label'] ) ) { $html .= '<p>ฤดูกาล ' . esc_html( $data['season_label'] ) . '</p>'; }
    elseif ( ! empty( $data['season'] ) ) { $html .= '<p>ฤดูกาลเริ่มปี ' . esc_html( (string) $data['season'] ) . ' — เป็นตารางของฤดูกาลที่เลือก ไม่ใช่การยืนยันตารางฤดูกาลปัจจุบัน</p>'; }
    if ( ! $data['data'] ) { return $html . '<p>ยังไม่มีรายการจากแหล่งข้อมูลในช่วงที่เลือก</p></section>'; }
    if ( 'standings' === $kind ) {
        foreach ( $data['data'] as $group ) {
            $html .= '<div role="region" aria-label="ตารางคะแนน" tabindex="0" style="overflow-x:auto;max-width:100%"><table style="min-width:720px;width:100%;border-collapse:collapse"><caption style="text-align:start">' . esc_html( $data['competition'] . ' — ' . $group['group'] ) . '</caption><thead><tr>';
            foreach ( array( 'อันดับ', 'ทีม', 'แข่ง', 'ชนะ', 'เสมอ', 'แพ้', 'ได้', 'เสีย', '+/-', 'คะแนน' ) as $label ) { $html .= '<th scope="col" style="white-space:nowrap">' . esc_html( $label ) . '</th>'; } $html .= '</tr></thead><tbody>';
            foreach ( $group['rows'] as $row ) { $html .= '<tr>'; foreach ( array( 'position', 'team', 'playedGames', 'won', 'draw', 'lost', 'goalsFor', 'goalsAgainst', 'goalDifference', 'points' ) as $field ) { $tag = 'team' === $field ? 'th' : 'td'; $html .= '<' . $tag . ( 'th' === $tag ? ' scope="row" style="min-width:12rem;text-align:start"' : '' ) . '>' . esc_html( (string) $row[ $field ] ) . '</' . $tag . '>'; } $html .= '</tr>'; } $html .= '</tbody></table></div>';
        }
    } else {
        $shown = 0; $html .= '<ul style="padding-inline-start:1.25rem;overflow-wrap:anywhere">';
        foreach ( $data['data'] as $match ) {
            if ( 'results' === $kind && 'finished' !== $match['status'] ) { continue; } ++$shown;
            $score = null === $match['score']['home'] || null === $match['score']['away'] ? '–' : $match['score']['home'] . ' : ' . $match['score']['away'];
            $when = ( new DateTimeImmutable( $match['kickoff'] ) )->setTimezone( wp_timezone() );
            $html .= '<li><time datetime="' . esc_attr( $match['kickoff'] ) . '">' . esc_html( $when->format( 'H:i T' ) ) . '</time> ' . esc_html( $match['home'] . ' ' . $score . ' ' . $match['away'] . ' (' . $match['status'] . ')' ) . '</li>';
        } $html .= '</ul>'; if ( ! $shown ) { $html .= '<p>ยังไม่มีผลจบการแข่งขันจากแหล่งข้อมูลในวันที่เลือก</p>'; }
    }
    return $html . '</section>';
}
foreach ( array( 'fixtures', 'results', 'standings' ) as $kind ) {
    add_shortcode( 'ff90_' . $kind, function ( $args ) use ( $kind ) { return ff90_football_render( $kind, $args ); } );
    add_action( 'ff90_' . $kind, function ( $date = '' ) use ( $kind ) { echo ff90_football_render( $kind, array( 'date' => is_string( $date ) ? $date : '' ) ); } );
}

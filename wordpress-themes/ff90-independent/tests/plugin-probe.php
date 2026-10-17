<?php
/**
 * Plugin Name: FF90 QA Presentation Probe (test double)
 * Description: Local sandbox hook probe, NOT SEO Growth V4 or Analytics.
 */
if ( ! defined( 'ABSPATH' ) || ! defined( 'FF90_QA_SANDBOX' ) || ! FF90_QA_SANDBOX ) { return; }
add_action( 'ff90_fixtures', function ( $date ) { echo '<p id="ff90-qa-fixtures" data-date="' . esc_attr( $date ) . '">QA hook probe — no live fixture data.</p>'; } );
add_action( 'ff90_results', function () { echo '<p id="ff90-qa-results">QA hook probe — no live results.</p>'; } );
add_action( 'ff90_standings', function () { echo '<p id="ff90-qa-standings">QA hook probe — no live standings.</p>'; } );
// Mimic a responsible SEO plugin replacing native canonical; do not claim real-plugin QA.
remove_action( 'wp_head', 'rel_canonical' );
add_action( 'wp_head', function () {
    if ( is_singular() ) { echo '<link rel="canonical" href="' . esc_url( get_permalink() ) . '">'; }
    echo '<script id="ff90-qa-schema" type="application/ld+json">' . wp_json_encode( array( '@context' => 'https://schema.org', '@type' => 'WebPage', 'name' => 'Synthetic FF90 QA probe' ) ) . '</script>';
} );
add_action( 'wp_footer', function () { echo '<script id="ff90-qa-analytics">window.ff90QaAnalyticsLoaded=true;</script>'; } );

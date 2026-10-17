<?php
require_once __DIR__ . '/../includes/Quality.php';
require_once __DIR__ . '/../includes/Intent.php';
require_once __DIR__ . '/../includes/Schema.php';
$cases = json_decode( file_get_contents( __DIR__ . '/v3-parity.json' ), true ); $checks = 0;
foreach ( $cases as $i => $case ) {
    switch ( $case['kind'] ) {
        case 'quality': $got = \FF90\SEO\Quality::score( $case['input'], $case['thresholds'], $case['now'] ); break;
        case 'intent': $got = \FF90\SEO\Intent::classify( $case['input'], $case['rules'], $case['options'] ); break;
        case 'schema': $got = \FF90\SEO\Schema::validate( $case['input'] ); break;
    }
    $expected = $case['expected'];
    // V3 exception descriptions differ slightly; compare issue codes and all functional signals.
    if ( 'schema' === $case['kind'] ) { $got = array( 'valid' => $got['valid'], 'codes' => array_column( $got['issues'], 'code' ) ); $expected = array( 'valid' => $expected['valid'], 'codes' => array_column( $expected['issues'], 'code' ) ); }
    if ( $got != $expected ) { echo 'FAIL ' . $i . ' ' . $case['kind'] . "\n" . json_encode( array( 'actual' => $got, 'expected' => $expected ), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE ) . "\n"; exit( 1 ); }
    ++$checks;
}
echo "PASS: $checks PHP cases match original TypeScript V3 reference behavior\n";

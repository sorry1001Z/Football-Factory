<?php
/** Plugin-owned fixtures. Date navigation uses WP site timezone. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
$date = ff90_fixture_date();
?>
<section class="fixtures-strip" aria-label="<?php esc_attr_e( 'โปรแกรมการแข่งขัน', 'ff90-independent' ); ?>"><div class="fixture-heading"><strong><?php esc_html_e( 'โปรแกรมแข่งขัน', 'ff90-independent' ); ?></strong><nav class="fixture-nav" aria-label="<?php esc_attr_e( 'เลือกวันแข่งขัน', 'ff90-independent' ); ?>"><a aria-label="<?php esc_attr_e( 'วันก่อนหน้า', 'ff90-independent' ); ?>" href="<?php echo esc_url( add_query_arg( 'ff90_date', $date->modify( '-1 day' )->format( 'Y-m-d' ), home_url( '/' ) ) ); ?>">←</a><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'วันนี้', 'ff90-independent' ); ?></a><a aria-label="<?php esc_attr_e( 'วันถัดไป', 'ff90-independent' ); ?>" href="<?php echo esc_url( add_query_arg( 'ff90_date', $date->modify( '+1 day' )->format( 'Y-m-d' ), home_url( '/' ) ) ); ?>">→</a></nav></div>
<div class="fixture-content"><time datetime="<?php echo esc_attr( $date->format( 'Y-m-d' ) ); ?>"><?php echo esc_html( wp_date( 'j M Y', $date->getTimestamp(), wp_timezone() ) ); ?></time>
<?php if ( has_action( 'ff90_fixtures' ) ) { do_action( 'ff90_fixtures', $date->format( 'Y-m-d' ) ); } else { ?><span class="muted"><?php esc_html_e( 'ยังไม่มีข้อมูลจากปลั๊กอินฟุตบอล', 'ff90-independent' ); ?></span><?php } ?></div></section>

<?php
/** Unique labeled search form. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
$id = wp_unique_id( 'ff90-search-' );
?><form role="search" method="get" class="search-form" action="<?php echo esc_url( home_url( '/' ) ); ?>"><label class="screen-reader-text" for="<?php echo esc_attr( $id ); ?>"><?php esc_html_e( 'ค้นหาข่าว', 'ff90-independent' ); ?></label><input id="<?php echo esc_attr( $id ); ?>" type="search" name="s" value="<?php echo esc_attr( get_search_query() ); ?>" placeholder="<?php esc_attr_e( 'ค้นหาข่าวฟุตบอล', 'ff90-independent' ); ?>"><button type="submit"><?php esc_html_e( 'ค้นหา', 'ff90-independent' ); ?></button></form>

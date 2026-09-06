<?php
/**
 * Sidebar template.
 *
 * Phase 6B scaffold. The Theme does not register any
 * widget areas in Phase 6B; the sidebar slot is reserved
 * for use by later phases. This template is included as
 * part of the standard WordPress hierarchy so authors
 * can call `get_sidebar()` without a missing-template
 * error.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

if ( ! is_active_sidebar( 'sidebar-1' ) ) {
	return;
}
?>
<aside
	id="secondary"
	class="ff-sidebar"
	role="complementary"
	aria-label="<?php esc_attr_e( 'Sidebar', 'football-factory' ); ?>"
>
	<?php dynamic_sidebar( 'sidebar-1' ); ?>
</aside>

<?php
/**
 * Template Part: Atoms (TP-049)
 *
 * Composite atomic primitives. Each atom is rendered on demand via
 * sub-helpers. Most pages will not load this directly; instead they
 * compose the atoms inline. This template part exists so atoms can be
 * previewed, unit-tested, and reused without rewriting.
 *
 * @var array<string, mixed> $args {
 *     @type string $type   Atom type (cta, tag, stat, badge, btn, icon-btn, logo).
 *     @type array  $props  Atom-specific props.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_type  = isset( $args['type'] ) ? (string) $args['type'] : '';
$football_factory_props = isset( $args['props'] ) && is_array( $args['props'] ) ? $args['props'] : array();

$football_factory_label_atoms = __( 'อะตอม', 'football-factory' );

if ( '' === $football_factory_type ) {
	return; // Nothing to render without a type.
}

// Resolve common props.
$football_factory_label = isset( $football_factory_props['label'] ) ? (string) $football_factory_props['label'] : '';
$football_factory_url   = isset( $football_factory_props['url'] ) ? (string) $football_factory_props['url'] : '';
$football_factory_icon  = isset( $football_factory_props['icon'] ) ? (string) $football_factory_props['icon'] : '';
$football_factory_class = isset( $football_factory_props['class'] ) ? (string) $football_factory_props['class'] : '';
?>
<div
	class="ff-atoms" data-tp="ui/atoms" data-atom-type="
	<?php echo esc_attr( $football_factory_type ); ?>
	" data-demo="true" aria-label="
	<?php echo esc_attr( $football_factory_label_atoms ); ?>
	"
>
	<?php if ( 'btn' === $football_factory_type || 'cta' === $football_factory_type ) : ?>
		<?php
		$football_factory_visual = '' !== $football_factory_url ? 'a' : 'button';
		$football_factory_xtra   = '' !== $football_factory_url
			? ' href="' . esc_url( $football_factory_url ) . '"'
			: ' type="button"';
		$football_factory_cls    = 'ff-btn ff-btn--primary'
			. (
				'' !== $football_factory_class
					? ' ' . esc_attr( $football_factory_class )
					: ''
			);
		?>
		<
		<?php
			echo esc_html(
				$football_factory_visual . $football_factory_xtra
			); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
		?>
		class="<?php echo esc_attr( $football_factory_cls ); ?>">
			<?php if ( '' !== $football_factory_icon ) : ?>
				<svg
					width="16" height="16" aria-hidden="true"
				>
			<?php endif; ?>
			<span><?php echo esc_html( $football_factory_label ); ?></span>
		</
		<?php
			echo $football_factory_visual; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- constant.
		?>
		>
	<?php elseif ( 'tag' === $football_factory_type ) : ?>
		<a
			class="ff-tag
			<?php
			echo '' !== $football_factory_class
				? ' ' . esc_attr( $football_factory_class )
				: '';
			?>
			" href="
			<?php
			echo '' !== $football_factory_url
				? esc_url( $football_factory_url )
				: '#';
			?>
			"
		>
			<?php echo esc_html( $football_factory_label ); ?>
		</a>
	<?php elseif ( 'stat' === $football_factory_type ) : ?>
		<div class="ff-stat">
			<span class="ff-stat__value"><?php echo esc_html( $football_factory_label ); ?></span>
			<?php
			$football_factory_sublabel = isset( $football_factory_props['sublabel'] )
				? (string) $football_factory_props['sublabel']
				: '';
			if ( '' !== $football_factory_sublabel ) :
				?>
				<span class="ff-stat__label"><?php echo esc_html( $football_factory_sublabel ); ?></span>
			<?php endif; ?>
		</div>
	<?php elseif ( 'badge' === $football_factory_type ) : ?>
		<span
		>
			<?php echo esc_html( $football_factory_label ); ?>
		</span>
	<?php elseif ( 'icon-btn' === $football_factory_type ) : ?>
		<button
			type="button" class="ff-icon-btn
			<?php
			echo '' !== $football_factory_class
				? ' ' . esc_attr( $football_factory_class )
				: '';
			?>
			" aria-label="
			<?php echo esc_attr( $football_factory_label ); ?>
			"
		>
			<?php if ( '' !== $football_factory_icon ) : ?>
				<svg
					width="20" height="20" aria-hidden="true"
				>
			<?php endif; ?>
		</button>
	<?php elseif ( 'logo' === $football_factory_type ) : ?>
		<a
			class="ff-logo
			<?php
			echo '' !== $football_factory_class
				? ' ' . esc_attr( $football_factory_class )
				: '';
			?>
			" href="
			<?php
			echo '' !== $football_factory_url
				? esc_url( $football_factory_url )
				: esc_url( home_url( '/' ) );
			?>
			"
		>
			<span class="ff-logo__mark" aria-hidden="true">F</span>
			<span class="ff-logo__text">
				<strong><?php echo esc_html( $football_factory_label ); ?></strong>
			</span>
		</a>
	<?php endif; ?>
</div>

<?php
/**
 * Template Part: Hero Card (TP-038)
 *
 * Home hero composition: featured story with optional secondary cards.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $card   HeroCardViewModel.
 *     @type array<string, mixed> $extras Optional secondary cards.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_card   = isset( $args['card'] ) && is_array( $args['card'] ) ? $args['card'] : array();
$football_factory_extras = isset( $args['extras'] ) && is_array( $args['extras'] ) ? $args['extras'] : array();

$football_factory_label_hero = __( 'เรื่องเด่น', 'football-factory' );
$football_factory_label_more = __( 'อ่านเพิ่มเติม', 'football-factory' );

$football_factory_title    = isset( $football_factory_card['title'] ) ? (string) $football_factory_card['title'] : '';
$football_factory_excerpt  = isset( $football_factory_card['excerpt'] )
	? (string) $football_factory_card['excerpt']
	: '';
$football_factory_url      = isset( $football_factory_card['url'] ) ? (string) $football_factory_card['url'] : '#';
$football_factory_palette  = isset( $football_factory_card['palette'] )
	? (string) $football_factory_card['palette']
	: '';
$football_factory_category = isset( $football_factory_card['category'] )
	? (string) $football_factory_card['category']
	: '';
$football_factory_meta     = isset( $football_factory_card['meta'] ) ? (string) $football_factory_card['meta'] : '';
?>
<section
	class="ff-hero-grid" aria-label="
	<?php echo esc_attr( $football_factory_label_hero ); ?>
	" data-tp="cards/hero" data-demo="true"
>
	<a class="ff-hero-card" href="<?php echo esc_url( $football_factory_url ); ?>">
		<div
		>
			<?php if ( '' !== $football_factory_category ) : ?>
				<span
					class="ff-badge ff-badge--brand ff-hero-card__badge"
				>
			<?php endif; ?>
		</div>
		<div class="ff-hero-card__body">
			<h1 class="ff-hero-card__title"><?php echo esc_html( $football_factory_title ); ?></h1>
			<?php if ( '' !== $football_factory_excerpt ) : ?>
				<p class="ff-hero-card__excerpt"><?php echo esc_html( $football_factory_excerpt ); ?></p>
			<?php endif; ?>
			<?php if ( '' !== $football_factory_meta ) : ?>
				<p class="ff-hero-card__meta"><?php echo esc_html( $football_factory_meta ); ?></p>
			<?php endif; ?>
			<span
				class="ff-hero-card__cta ff-btn ff-btn--primary"
			>
		</div>
	</a>
	<?php if ( ! empty( $football_factory_extras ) ) : ?>
		<div class="ff-hero-grid__extras">
			<?php foreach ( $football_factory_extras as $football_factory_extra ) : ?>
				<?php
				if ( ! is_array( $football_factory_extra ) ) {
					continue;
				}
				$football_factory_arg_card    = $football_factory_extra;
				$football_factory_arg_variant = 'compact';
				?>
				<div class="ff-hero-grid__extra">
					<?php include __DIR__ . '/../news/news-card.php'; ?>
				</div>
			<?php endforeach; ?>
		</div>
	<?php endif; ?>
</section>

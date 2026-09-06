<?php
/**
 * Template Part: News Card (TP-006)
 *
 * Single news item rendering: media, category badge, title, excerpt, meta.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $card {
 *         @type int    $id           Post ID.
 *         @type string $title        Headline (Thai).
 *         @type string $excerpt      Excerpt text.
 *         @type string $category     Category label.
 *         @type string $url          Article URL.
 *         @type string $image        Image URL (optional).
 *         @type string $palette      Background palette for inline stadium.
 *         @type string $published_at ISO date string.
 *         @type int    $read_time    Read time in minutes.
 *         @type int    $views        View count.
 *         @type int    $comments     Comment count.
 *     }
 *     @type string $variant Card variant: default | featured | compact.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

// Allow include() or get_template_part() to pass $football_factory_arg_card
// (and optional $football_factory_arg_variant) as direct locals.
$football_factory_card_data = isset( $football_factory_arg_card ) && is_array( $football_factory_arg_card )
	? $football_factory_arg_card
	: ( isset( $args['card'] ) && is_array( $args['card'] ) ? $args['card'] : array() );
$football_factory_variant   = isset( $football_factory_arg_variant )
	? (string) $football_factory_arg_variant
	: ( isset( $args['variant'] ) ? (string) $args['variant'] : 'default' );

$football_factory_id        = isset( $football_factory_card_data['id'] ) ? (int) $football_factory_card_data['id'] : 0;
$football_factory_title     = isset( $football_factory_card_data['title'] )
	? (string) $football_factory_card_data['title']
	: '';
$football_factory_excerpt   = isset( $football_factory_card_data['excerpt'] )
	? (string) $football_factory_card_data['excerpt']
	: '';
$football_factory_category  = isset( $football_factory_card_data['category'] )
	? (string) $football_factory_card_data['category']
	: '';
$football_factory_url       = isset( $football_factory_card_data['url'] )
	? (string) $football_factory_card_data['url']
	: '#';
$football_factory_palette   = isset( $football_factory_card_data['palette'] )
	? (string) $football_factory_card_data['palette']
	: '';
$football_factory_published = isset( $football_factory_card_data['published_at'] )
	? (string) $football_factory_card_data['published_at']
	: '';
$football_factory_read_time = isset( $football_factory_card_data['read_time'] )
	? (int) $football_factory_card_data['read_time']
	: 0;
$football_factory_views     = isset( $football_factory_card_data['views'] )
	? (int) $football_factory_card_data['views']
	: 0;
$football_factory_comments  = isset( $football_factory_card_data['comments'] )
	? (int) $football_factory_card_data['comments']
	: 0;

if ( '' === $football_factory_title ) {
	return; // Skip empty cards.
}

// Format date in Thai style.
$football_factory_date_th = '';
if ( '' !== $football_factory_published ) {
	$football_factory_ts = strtotime( $football_factory_published );
	if ( false !== $football_factory_ts ) {
		$football_factory_date_th = date_i18n( 'j M Y', $football_factory_ts );
	}
}

$football_factory_label_read  = __( 'อ่าน', 'football-factory' );
$football_factory_label_min   = __( 'นาที', 'football-factory' );
$football_factory_label_views = __( 'เข้าชม', 'football-factory' );
$football_factory_label_cmt   = __( 'ความคิดเห็น', 'football-factory' );

$football_factory_class = 'ff-news-card';
if ( 'featured' === $football_factory_variant ) {
	$football_factory_class .= ' ff-news-card--featured';
} elseif ( 'compact' === $football_factory_variant ) {
	$football_factory_class .= ' ff-news-card--compact';
}
?>
<a
	class="
	<?php echo esc_attr( $football_factory_class ); ?>
	" href="
	<?php echo esc_url( $football_factory_url ); ?>
	" data-tp="news/news-card" data-demo="true" data-id="
	<?php echo (int) $football_factory_id; ?>
	"
>
	<div
	>
		<?php if ( '' !== $football_factory_category && 'featured' === $football_factory_variant ) : ?>
			<span
				class="ff-badge ff-badge--brand" style="position:absolute;top:12px;left:12px"
			>
		<?php endif; ?>
	</div>
	<div class="ff-news-card__body">
		<?php if ( '' !== $football_factory_category && 'featured' !== $football_factory_variant ) : ?>
			<span
				class="ff-badge ff-badge--brand ff-news-card__category"
			>
		<?php endif; ?>
		<h3 class="ff-news-card__title"><?php echo esc_html( $football_factory_title ); ?></h3>
		<?php if ( '' !== $football_factory_excerpt ) : ?>
			<p class="ff-news-card__excerpt"><?php echo esc_html( $football_factory_excerpt ); ?></p>
		<?php endif; ?>
		<div class="ff-news-card__meta">
			<?php if ( '' !== $football_factory_date_th ) : ?>
				<span class="ff-news-card__date"><?php echo esc_html( $football_factory_date_th ); ?></span>
			<?php endif; ?>
			<?php if ( $football_factory_read_time > 0 ) : ?>
				<span class="ff-news-card__sep" aria-hidden="true">·</span>
				<span
					class="ff-news-card__time"
				>
			<?php endif; ?>
			<?php if ( $football_factory_views > 0 ) : ?>
				<span class="ff-news-card__sep" aria-hidden="true">·</span>
				<span
					class="ff-news-card__views"
				>
			<?php endif; ?>
			<?php if ( $football_factory_comments > 0 ) : ?>
				<span class="ff-news-card__sep" aria-hidden="true">·</span>
				<span
					class="ff-news-card__comments"
				>
			<?php endif; ?>
		</div>
	</div>
</a>

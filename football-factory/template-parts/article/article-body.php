<?php
/**
 * Template Part: Article Body (TP-007)
 *
 * Editorial body rendering for single article pages.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $article {
 *         @type int    $id          Post ID.
 *         @type string $title       Article title.
 *         @type string $dek         Standfirst / sub-headline.
 *         @type string $content     Full HTML content.
 *         @type string $category    Category label.
 *         @type string $author      Author name.
 *         @type string $role        Author role.
 *         @type string $author_avatar Avatar data-attr.
 *         @type string $author_palette Avatar palette.
 *         @type string $published_at ISO date.
 *         @type string $updated_at  ISO date.
 *         @type int    $views       View count.
 *         @type string $hero_palette Hero image palette.
 *         @type string $attribution Photo attribution.
 *     }
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_article = isset( $args['article'] ) && is_array( $args['article'] ) ? $args['article'] : array();
// Also support include() pattern: $football_factory_arg_article
if (
	empty( $football_factory_article )
	&& isset( $football_factory_arg_article )
	&& is_array( $football_factory_arg_article )
	) {
	$football_factory_article = $football_factory_arg_article;
}

$football_factory_id          = isset( $football_factory_article['id'] ) ? (int) $football_factory_article['id'] : 0;
$football_factory_title       = isset( $football_factory_article['title'] )
	? (string) $football_factory_article['title']
	: '';
$football_factory_dek         = isset( $football_factory_article['dek'] )
	? (string) $football_factory_article['dek']
	: '';
$football_factory_content     = isset( $football_factory_article['content'] )
	? (string) $football_factory_article['content']
	: '';
$football_factory_category    = isset( $football_factory_article['category'] )
	? (string) $football_factory_article['category']
	: '';
$football_factory_author      = isset( $football_factory_article['author'] )
	? (string) $football_factory_article['author']
	: '';
$football_factory_role        = isset( $football_factory_article['role'] )
	? (string) $football_factory_article['role']
	: '';
$football_factory_author_av   = isset( $football_factory_article['author_avatar'] )
	? (string) $football_factory_article['author_avatar']
	: '';
$football_factory_author_pal  = isset( $football_factory_article['author_palette'] )
	? (string) $football_factory_article['author_palette']
	: '';
$football_factory_published   = isset( $football_factory_article['published_at'] )
	? (string) $football_factory_article['published_at']
	: '';
$football_factory_updated     = isset( $football_factory_article['updated_at'] )
	? (string) $football_factory_article['updated_at']
	: '';
$football_factory_views       = isset( $football_factory_article['views'] )
	? (int) $football_factory_article['views']
	: 0;
$football_factory_hero_pal    = isset( $football_factory_article['hero_palette'] )
	? (string) $football_factory_article['hero_palette']
	: '';
$football_factory_attribution = isset( $football_factory_article['attribution'] )
	? (string) $football_factory_article['attribution']
	: '';

if ( '' === $football_factory_title ) {
	return;
}

$football_factory_date_th    = '';
$football_factory_updated_th = '';
if ( '' !== $football_factory_published ) {
	$football_factory_ts = strtotime( $football_factory_published );
	if ( false !== $football_factory_ts ) {
		$football_factory_date_th = date_i18n( 'j F Y', $football_factory_ts );
	}
}
if ( '' !== $football_factory_updated ) {
	$football_factory_ts = strtotime( $football_factory_updated );
	if ( false !== $football_factory_ts ) {
		$football_factory_updated_th = date_i18n( 'H:i', $football_factory_ts );
	}
}

$football_factory_label_published = __( 'เผยแพร่เมื่อ', 'football-factory' );
$football_factory_label_updated   = __( 'อัปเดตเมื่อ', 'football-factory' );
$football_factory_label_views     = __( 'ยอดอ่าน', 'football-factory' );
$football_factory_label_save      = __( 'บันทึก', 'football-factory' );
$football_factory_label_share     = __( 'แชร์', 'football-factory' );
?>
<article
	class="ff-article" data-tp="article/article-body" data-demo="true" data-id="
	<?php echo (int) $football_factory_id; ?>
	"
>
	<?php if ( '' !== $football_factory_category ) : ?>
		<span class="ff-article__category"><?php echo esc_html( $football_factory_category ); ?></span>
	<?php endif; ?>
	<h1 class="ff-article__title"><?php echo esc_html( $football_factory_title ); ?></h1>
	<?php if ( '' !== $football_factory_dek ) : ?>
		<p class="ff-article__dek"><?php echo esc_html( $football_factory_dek ); ?></p>
	<?php endif; ?>
	<div class="ff-article__meta">
		<?php if ( '' !== $football_factory_author ) : ?>
			<div class="ff-article__author">
				<div
					class="ff-article__author-avatar"
					<?php
					echo '' !== $football_factory_author_av
						? 'data-player="' . esc_attr( $football_factory_author_av ) . '"'
						: '';
					?>
					<?php
					echo '' !== $football_factory_author_pal
						? 'data-palette="' . esc_attr( $football_factory_author_pal ) . '"'
						: '';
					?>
					data-size="64"
				>
				<div>
					<div
						class="ff-article__author-name"
					>
					<?php if ( '' !== $football_factory_role ) : ?>
						<div class="ff-article__author-role"><?php echo esc_html( $football_factory_role ); ?></div>
					<?php endif; ?>
				</div>
			</div>
		<?php endif; ?>
		<?php if ( '' !== $football_factory_date_th ) : ?>
			<span class="ff-article__sep" aria-hidden="true">·</span>
			<span
				class="ff-article__date"
			>
		<?php endif; ?>
		<?php if ( '' !== $football_factory_updated_th ) : ?>
			<span class="ff-article__sep" aria-hidden="true">·</span>
			<span
				class="ff-article__updated"
			>
		<?php endif; ?>
		<?php if ( $football_factory_views > 0 ) : ?>
			<span class="ff-article__sep" aria-hidden="true">·</span>
			<span
				class="ff-article__views"
			>
		<?php endif; ?>
		<span class="ff-article__actions">
			<button
				type="button" class="ff-icon-btn" aria-label="
				<?php echo esc_attr( $football_factory_label_save ); ?>
				"
			>
				<svg width="18" height="18" aria-hidden="true"><use href="#i-bookmark"/></svg>
			</button>
			<button
				type="button" class="ff-icon-btn" aria-label="
				<?php echo esc_attr( $football_factory_label_share ); ?>
				"
			>
				<svg width="18" height="18" aria-hidden="true"><use href="#i-share"/></svg>
			</button>
		</span>
	</div>
	<?php if ( '' !== $football_factory_hero_pal ) : ?>
		<div
			class="ff-article__hero" data-stadium="article-hero" data-palette="
			<?php echo esc_attr( $football_factory_hero_pal ); ?>
			" role="img" aria-label="
			<?php echo esc_attr( $football_factory_title ); ?>
			"
		>
		<?php if ( '' !== $football_factory_attribution ) : ?>
			<p class="ff-article__attribution"><?php echo esc_html( $football_factory_attribution ); ?></p>
		<?php endif; ?>
	<?php endif; ?>
	<div class="ff-article__body">
		<?php
		// Content is trusted editorial content (already sanitized in WP editor).
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Content escaped in editor.
		echo $football_factory_content;
		?>
	</div>
</article>

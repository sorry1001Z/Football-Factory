<?php
/**
 * Template Part: Team Tags (TP-024)
 *
 * Tag/chip list of teams or leagues.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $tags  Array of { id, label, count?, url? }.
 *     @type string               $title Section title.
 *     @type string               $kind  "team" or "league".
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_tags  = isset( $args['tags'] ) && is_array( $args['tags'] ) ? $args['tags'] : array();
$football_factory_title = isset( $args['title'] ) ? (string) $args['title'] : __( 'ทีม', 'football-factory' );
$football_factory_kind  = isset( $args['kind'] ) ? (string) $args['kind'] : 'team';

$football_factory_label_empty = __( 'ไม่มีรายการ', 'football-factory' );
?>
<section
	class="ff-team-tags" aria-label="
	<?php echo esc_attr( $football_factory_title ); ?>
	" data-tp="league/team-tags" data-demo="true" data-kind="
	<?php echo esc_attr( $football_factory_kind ); ?>
	"
>
	<?php if ( '' !== $football_factory_title ) : ?>
		<h3 class="ff-section-title"><?php echo esc_html( $football_factory_title ); ?></h3>
	<?php endif; ?>
	<?php if ( empty( $football_factory_tags ) ) : ?>
		<p class="ff-team-tags__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<ul class="ff-team-tags__list ff-tag-list">
			<?php foreach ( $football_factory_tags as $football_factory_tag ) : ?>
				<?php
				if ( ! is_array( $football_factory_tag ) ) {
					continue;
				}
				$football_factory_tag_id  = isset( $football_factory_tag['id'] )
					? (string) $football_factory_tag['id']
					: '';
				$football_factory_tag_lbl = isset( $football_factory_tag['label'] )
					? (string) $football_factory_tag['label']
					: '';
				$football_factory_tag_url = isset( $football_factory_tag['url'] )
					? (string) $football_factory_tag['url']
					: '#';
				$football_factory_tag_cnt = isset( $football_factory_tag['count'] )
					? (int) $football_factory_tag['count']
					: 0;
				$football_factory_tag_pal = isset( $football_factory_tag['palette'] )
					? (string) $football_factory_tag['palette']
					: '';
				if ( '' === $football_factory_tag_lbl ) {
					continue;
				}
				?>
				<li class="ff-tag-list__item">
					<a
						class="ff-tag" href="
						<?php echo esc_url( $football_factory_tag_url ); ?>
						" data-tag-id="
						<?php echo esc_attr( $football_factory_tag_id ); ?>
						"
						<?php
						echo '' !== $football_factory_tag_pal
							? 'data-palette="' . esc_attr( $football_factory_tag_pal ) . '"'
							: '';
						?>
					>
						<span class="ff-tag__label"><?php echo esc_html( $football_factory_tag_lbl ); ?></span>
						<?php if ( $football_factory_tag_cnt > 0 ) : ?>
							<span
								class="ff-tag__count" aria-hidden="true"
							>
						<?php endif; ?>
					</a>
				</li>
			<?php endforeach; ?>
		</ul>
	<?php endif; ?>
</section>

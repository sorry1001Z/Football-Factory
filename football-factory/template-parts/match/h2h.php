<?php
/**
 * Template Part: Head-to-Head (TP-017)
 *
 * H2H list of recent matches between two teams.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $rows  Array of { home, away, score, date, url, palette? }.
 *     @type string               $title Section title.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_rows  = isset( $args['rows'] ) && is_array( $args['rows'] ) ? $args['rows'] : array();
$football_factory_title = isset( $args['title'] ) ? (string) $args['title'] : __( 'ประวัติพบกัน', 'football-factory' );

$football_factory_label_empty = __( 'ไม่มีข้อมูล', 'football-factory' );
$football_factory_label_h2h   = __( 'ผลการแข่งขัน', 'football-factory' );
?>
<section
	class="ff-h2h" aria-label="
	<?php echo esc_attr( $football_factory_title ); ?>
	" data-tp="match/h2h" data-demo="true"
>
	<h3 class="ff-section-title"><?php echo esc_html( $football_factory_title ); ?></h3>
	<?php if ( empty( $football_factory_rows ) ) : ?>
		<p class="ff-h2h__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<ul class="ff-h2h__list">
			<?php foreach ( $football_factory_rows as $football_factory_row ) : ?>
				<?php
				if ( ! is_array( $football_factory_row ) ) {
					continue;
				}
				$football_factory_row_home    = isset( $football_factory_row['home'] )
					? (string) $football_factory_row['home']
					: '';
				$football_factory_row_away    = isset( $football_factory_row['away'] )
					? (string) $football_factory_row['away']
					: '';
				$football_factory_row_score   = isset( $football_factory_row['score'] )
					? (string) $football_factory_row['score']
					: '';
				$football_factory_row_date    = isset( $football_factory_row['date'] )
					? (string) $football_factory_row['date']
					: '';
				$football_factory_row_url     = isset( $football_factory_row['url'] )
					? (string) $football_factory_row['url']
					: '#';
				$football_factory_row_pal     = isset( $football_factory_row['palette'] )
					? (string) $football_factory_row['palette']
					: '';
				$football_factory_row_date_th = '';
				if ( '' !== $football_factory_row_date ) {
					$football_factory_ts = strtotime( $football_factory_row_date );
					if ( false !== $football_factory_ts ) {
						$football_factory_row_date_th = date_i18n( 'j M Y', $football_factory_ts );
					}
				}
				?>
				<li class="ff-stat-row">
					<a
	class="ff-stat-row__link"
	href="<?php echo esc_url( $football_factory_row_url ); ?>"
	aria-label="
				<?php
				echo esc_attr(
					$football_factory_row_home . ' ' . $football_factory_row_score . ' ' . $football_factory_row_away
				);
				?>
	"
>
						<div class="ff-stat-row__main">
							<?php if ( '' !== $football_factory_row_pal ) : ?>
								<span
									class="ff-stat-row__crest" data-palette="
									<?php echo esc_attr( $football_factory_row_pal ); ?>
									" aria-hidden="true"
								>
							<?php endif; ?>
							<span
								class="ff-stat-row__teams"
							>
						</div>
						<?php if ( '' !== $football_factory_row_date_th ) : ?>
							<time
								class="ff-stat-row__date" datetime="
								<?php echo esc_attr( $football_factory_row_date ); ?>
								"
							>
						<?php endif; ?>
					</a>
				</li>
			<?php endforeach; ?>
		</ul>
	<?php endif; ?>
</section>

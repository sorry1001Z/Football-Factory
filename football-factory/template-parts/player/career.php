<?php
/**
 * Template Part: Player Career (TP-033)
 *
 * Career timeline with seasons, clubs, and appearances.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $seasons Array of CareerSeasonViewModel {
 *         Each: { season, club, club_code, apps, goals, palette? }
 *     }
 *     @type string $title Section title.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_seasons = isset( $args['seasons'] ) && is_array( $args['seasons'] ) ? $args['seasons'] : array();
$football_factory_title   = isset( $args['title'] ) ? (string) $args['title'] : __( 'อาชีพ', 'football-factory' );

$football_factory_label_empty  = __( 'ยังไม่มีข้อมูลอาชีพ', 'football-factory' );
$football_factory_label_season = __( 'ฤดูกาล', 'football-factory' );
$football_factory_label_club   = __( 'สโมสร', 'football-factory' );
$football_factory_label_apps   = __( 'นัด', 'football-factory' );
$football_factory_label_goals  = __( 'ประตู', 'football-factory' );
?>
<section
	class="ff-timeline ff-player-career" aria-label="
	<?php echo esc_attr( $football_factory_title ); ?>
	" data-tp="player/career" data-demo="true"
>
	<h3 class="ff-section-title"><?php echo esc_html( $football_factory_title ); ?></h3>
	<?php if ( empty( $football_factory_seasons ) ) : ?>
		<p class="ff-player-career__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<ol class="ff-timeline__list">
			<?php foreach ( $football_factory_seasons as $football_factory_season ) : ?>
				<?php
				if ( ! is_array( $football_factory_season ) ) {
					continue;
				}
				$football_factory_season_name  = isset( $football_factory_season['season'] )
					? (string) $football_factory_season['season']
					: '';
				$football_factory_season_club  = isset( $football_factory_season['club'] )
					? (string) $football_factory_season['club']
					: '';
				$football_factory_season_code  = isset( $football_factory_season['club_code'] )
					? (string) $football_factory_season['club_code']
					: '';
				$football_factory_season_apps  = isset( $football_factory_season['apps'] )
					? (int) $football_factory_season['apps']
					: 0;
				$football_factory_season_goals = isset( $football_factory_season['goals'] )
					? (int) $football_factory_season['goals']
					: 0;
				$football_factory_season_pal   = isset( $football_factory_season['palette'] )
					? (string) $football_factory_season['palette']
					: '';
				?>
				<li class="ff-timeline__item ff-player-career__item">
					<div class="ff-timeline__dot" aria-hidden="true"></div>
					<div class="ff-timeline__content ff-player-career__content">
						<div
							class="ff-player-career__season"
						>
						<div
						>
							<?php if ( '' !== $football_factory_season_code ) : ?>
								<span
									class="ff-standings__crest" data-crest="
									<?php echo esc_attr( $football_factory_season_code ); ?>
									" data-size="18" aria-hidden="true"
								>
							<?php endif; ?>
							<span
								class="ff-player-career__club-name"
							>
						</div>
						<div class="ff-player-career__numbers">
							<span
							>
							<span>·</span>
							<span
							>
						</div>
					</div>
				</li>
			<?php endforeach; ?>
		</ol>
	<?php endif; ?>
</section>

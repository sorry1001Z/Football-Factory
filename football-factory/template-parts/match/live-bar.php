<?php
/**
 * Template Part: Live Bar (TP-010)
 *
 * Marquee ticker of live and recent matches.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $matches Array of LiveMatchViewModel.
 *     @type string               $title  Section title.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_matches = isset( $args['matches'] ) && is_array( $args['matches'] ) ? $args['matches'] : array();
$football_factory_title   = isset( $args['title'] )
	? (string) $args['title']
	: __( 'ศูนย์การแข่งขันสด', 'football-factory' );

$football_factory_label_live  = __( 'ถ่ายทอดสด', 'football-factory' );
$football_factory_label_match = __( 'การแข่งขันสด', 'football-factory' );
$football_factory_label_score = __( 'คะแนน', 'football-factory' );
?>
<section
	class="ff-live-bar" aria-label="
	<?php echo esc_attr( $football_factory_title ); ?>
	" data-tp="match/live-bar" data-demo="true"
>
	<div class="ff-container">
		<div class="ff-live-bar__inner">
			<div class="ff-live-bar__brand" aria-hidden="true">
				<div class="ff-live-bar__brand-mark">FF</div>
				<div class="ff-live-bar__brand-text">
					<strong><?php echo esc_html( $football_factory_label_live ); ?></strong>
					<small><?php echo esc_html( $football_factory_title ); ?></small>
				</div>
			</div>
			<div
				class="ff-live-bar__ticker" role="region" aria-label="
				<?php echo esc_attr( $football_factory_label_match ); ?>
				"
			>
				<?php if ( empty( $football_factory_matches ) ) : ?>
					<p
						class="ff-live-bar__empty"
					>
				<?php else : ?>
					<?php foreach ( $football_factory_matches as $football_factory_match ) : ?>
						<?php
						if ( ! is_array( $football_factory_match ) ) {
							continue;
						}
						$football_factory_match_url       = isset( $football_factory_match['url'] )
							? (string) $football_factory_match['url']
							: '#';
						$football_factory_match_league    = isset( $football_factory_match['league'] )
							? (string) $football_factory_match['league']
							: '';
						$football_factory_match_minute    = isset( $football_factory_match['minute'] )
							? (string) $football_factory_match['minute']
							: '';
						$football_factory_match_home      = isset( $football_factory_match['home'] )
							? (string) $football_factory_match['home']
							: '';
						$football_factory_match_away      = isset( $football_factory_match['away'] )
							? (string) $football_factory_match['away']
							: '';
						$football_factory_match_home_code = isset( $football_factory_match['home_code'] )
							? (string) $football_factory_match['home_code']
							: '';
						$football_factory_match_away_code = isset( $football_factory_match['away_code'] )
							? (string) $football_factory_match['away_code']
							: '';
						$football_factory_match_score     = isset( $football_factory_match['score'] )
							? (string) $football_factory_match['score']
							: '';
						$football_factory_match_status    = isset( $football_factory_match['status'] )
							? (string) $football_factory_match['status']
							: '';
						?>
						<a
							class="ff-live-bar__item" href="
							<?php echo esc_url( $football_factory_match_url ); ?>
							" data-ticker
						>
							<div>
								<div class="ff-live-bar__top">
									<?php if ( '' !== $football_factory_match_league ) : ?>
										<span
											class="ff-badge ff-badge--brand"
										>
									<?php endif; ?>
									<?php if ( '' !== $football_factory_match_minute ) : ?>
										<span
											class="ff-live-bar__minute" aria-label="
											<?php echo esc_attr( $football_factory_label_match ); ?>
											"
										>
									<?php elseif ( '' !== $football_factory_match_status ) : ?>
										<span
											class="ff-live-bar__status"
										>
									<?php endif; ?>
								</div>
								<div
	class="ff-live-bar__teams"
	aria-label="
						<?php
						echo esc_attr(
							$football_factory_match_home
							. ' ' . $football_factory_label_score
							. ' ' . $football_factory_match_away
						);
						?>
	"
>
									<?php if ( '' !== $football_factory_match_home_code ) : ?>
										<span
											class="ff-live-bar__crest" data-crest="
											<?php echo esc_attr( $football_factory_match_home_code ); ?>
											" data-size="18" aria-hidden="true"
										>
									<?php endif; ?>
									<span
										class="ff-live-bar__home"
									>
									<span
										class="ff-live-bar__score"
									>
									<span
										class="ff-live-bar__away"
									>
									<?php if ( '' !== $football_factory_match_away_code ) : ?>
										<span
											class="ff-live-bar__crest" data-crest="
											<?php echo esc_attr( $football_factory_match_away_code ); ?>
											" data-size="18" aria-hidden="true"
										>
									<?php endif; ?>
								</div>
							</div>
						</a>
					<?php endforeach; ?>
				<?php endif; ?>
			</div>
		</div>
	</div>
</section>

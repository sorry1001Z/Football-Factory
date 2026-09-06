<?php
/**
 * Template Part: Match Hero (TP-011)
 *
 * Full-bleed match header used in match preview and match report pages.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $match MatchHeroViewModel {
 *         @type string $home          Home team name.
 *         @type string $away          Away team name.
 *         @type string $home_code     Home team code.
 *         @type string $away_code     Away team code.
 *         @type string $league        League label.
 *         @type string $matchweek     Matchweek number.
 *         @type string $kickoff       ISO datetime.
 *         @type string $venue         Stadium/venue.
 *         @type string $broadcast     Broadcast info.
 *         @type int    $score_home    Home score (if played).
 *         @type int    $score_away    Away score (if played).
 *         @type string $status        Status: scheduled | live | final.
 *         @type string $status_label  Localized status text.
 *         @type int    $match_id      Match ID.
 *     }
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_match = isset( $args['match'] ) && is_array( $args['match'] ) ? $args['match'] : array();
if (
	empty( $football_factory_match )
	&& isset( $football_factory_arg_match )
	&& is_array( $football_factory_arg_match )
	) {
	$football_factory_match = $football_factory_arg_match;
}

$football_factory_home       = isset( $football_factory_match['home'] ) ? (string) $football_factory_match['home'] : '';
$football_factory_away       = isset( $football_factory_match['away'] ) ? (string) $football_factory_match['away'] : '';
$football_factory_home_code  = isset( $football_factory_match['home_code'] )
	? (string) $football_factory_match['home_code']
	: '';
$football_factory_away_code  = isset( $football_factory_match['away_code'] )
	? (string) $football_factory_match['away_code']
	: '';
$football_factory_league     = isset( $football_factory_match['league'] )
	? (string) $football_factory_match['league']
	: '';
$football_factory_matchweek  = isset( $football_factory_match['matchweek'] )
	? (string) $football_factory_match['matchweek']
	: '';
$football_factory_kickoff    = isset( $football_factory_match['kickoff'] )
	? (string) $football_factory_match['kickoff']
	: '';
$football_factory_venue      = isset( $football_factory_match['venue'] )
	? (string) $football_factory_match['venue']
	: '';
$football_factory_broadcast  = isset( $football_factory_match['broadcast'] )
	? (string) $football_factory_match['broadcast']
	: '';
$football_factory_score_home = isset( $football_factory_match['score_home'] )
	? (int) $football_factory_match['score_home']
	: null;
$football_factory_score_away = isset( $football_factory_match['score_away'] )
	? (int) $football_factory_match['score_away']
	: null;
$football_factory_status     = isset( $football_factory_match['status'] )
	? (string) $football_factory_match['status']
	: 'scheduled';
$football_factory_status_lbl = isset( $football_factory_match['status_label'] )
	? (string) $football_factory_match['status_label']
	: '';
$football_factory_match_id   = isset( $football_factory_match['match_id'] )
	? (int) $football_factory_match['match_id']
	: 0;

if ( '' === $football_factory_home || '' === $football_factory_away ) {
	return;
}

$football_factory_kickoff_th = '';
if ( '' !== $football_factory_kickoff ) {
	$football_factory_ts = strtotime( $football_factory_kickoff );
	if ( false !== $football_factory_ts ) {
		$football_factory_kickoff_th = date_i18n( 'j F Y · H:i', $football_factory_ts );
	}
}

$football_factory_label_kickoff = __( 'เริ่ม', 'football-factory' );
$football_factory_label_date    = __( 'วันที่', 'football-factory' );
$football_factory_label_venue   = __( 'สนาม', 'football-factory' );
$football_factory_label_tv      = __( 'ถ่ายทอด', 'football-factory' );
?>
<section
	class="ff-match-hero" data-tp="match/match-hero" data-demo="true" data-match-id="
	<?php echo (int) $football_factory_match_id; ?>
	" data-status="
	<?php echo esc_attr( $football_factory_status ); ?>
	" aria-label="
	<?php echo esc_attr( $football_factory_home . ' vs ' . $football_factory_away ); ?>
	"
>
	<div class="ff-match-hero__inner">
		<div class="ff-match-hero__league">
			<?php if ( '' !== $football_factory_league ) : ?>
				<?php echo esc_html( $football_factory_league ); ?>
				<?php if ( '' !== $football_factory_matchweek ) : ?>
					<?php
					echo ' • '
						. esc_html__( 'นัดที่', 'football-factory' )
						. ' '
						. esc_html( $football_factory_matchweek );
					?>
				<?php endif; ?>
			<?php endif; ?>
		</div>
		<div class="ff-match-hero__teams">
			<div class="ff-match-hero__team ff-match-hero__team--home">
				<?php if ( '' !== $football_factory_home_code ) : ?>
					<span
						class="ff-match-hero__crest" data-crest="
						<?php echo esc_attr( $football_factory_home_code ); ?>
						" data-size="80" aria-hidden="true"
					>
				<?php endif; ?>
				<h2 class="ff-match-hero__name"><?php echo esc_html( $football_factory_home ); ?></h2>
			</div>
			<div class="ff-match-hero__score">
				<?php if ( null !== $football_factory_score_home && null !== $football_factory_score_away ) : ?>
					<span class="ff-match-hero__score-home"><?php echo (int) $football_factory_score_home; ?></span>
					<span class="ff-match-hero__score-sep" aria-hidden="true">-</span>
					<span class="ff-match-hero__score-away"><?php echo (int) $football_factory_score_away; ?></span>
				<?php else : ?>
					<span><?php echo esc_html_e( 'VS', 'football-factory' ); ?></span>
				<?php endif; ?>
			</div>
			<div class="ff-match-hero__team ff-match-hero__team--away">
				<?php if ( '' !== $football_factory_away_code ) : ?>
					<span
						class="ff-match-hero__crest" data-crest="
						<?php echo esc_attr( $football_factory_away_code ); ?>
						" data-size="80" aria-hidden="true"
					>
				<?php endif; ?>
				<h2 class="ff-match-hero__name"><?php echo esc_html( $football_factory_away ); ?></h2>
			</div>
		</div>
		<?php if ( '' !== $football_factory_status_lbl ) : ?>
			<div
				class="ff-match-hero__status" data-status="
				<?php echo esc_attr( $football_factory_status ); ?>
				"
			>
		<?php endif; ?>
		<dl class="ff-match-hero__meta">
			<?php if ( '' !== $football_factory_kickoff_th ) : ?>
				<div class="ff-match-hero__meta-item">
					<dt class="ff-sr"><?php echo esc_html( $football_factory_label_date ); ?></dt>
					<dd><?php echo esc_html( $football_factory_kickoff_th ); ?></dd>
				</div>
			<?php endif; ?>
			<?php if ( '' !== $football_factory_venue ) : ?>
				<div class="ff-match-hero__meta-item">
					<dt class="ff-sr"><?php echo esc_html( $football_factory_label_venue ); ?></dt>
					<dd><?php echo esc_html( $football_factory_venue ); ?></dd>
				</div>
			<?php endif; ?>
			<?php if ( '' !== $football_factory_broadcast ) : ?>
				<div class="ff-match-hero__meta-item">
					<dt class="ff-sr"><?php echo esc_html( $football_factory_label_tv ); ?></dt>
					<dd><?php echo esc_html( $football_factory_broadcast ); ?></dd>
				</div>
			<?php endif; ?>
		</dl>
	</div>
</section>

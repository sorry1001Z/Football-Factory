<?php
/**
 * Template Part: Match Card (TP-012)
 *
 * Compact match summary card.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $match MatchCardViewModel.
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

$football_factory_home    = isset( $football_factory_match['home'] ) ? (string) $football_factory_match['home'] : '';
$football_factory_away    = isset( $football_factory_match['away'] ) ? (string) $football_factory_match['away'] : '';
$football_factory_home_c  = isset( $football_factory_match['home_code'] )
	? (string) $football_factory_match['home_code']
	: '';
$football_factory_away_c  = isset( $football_factory_match['away_code'] )
	? (string) $football_factory_match['away_code']
	: '';
$football_factory_url     = isset( $football_factory_match['url'] ) ? (string) $football_factory_match['url'] : '#';
$football_factory_league  = isset( $football_factory_match['league'] )
	? (string) $football_factory_match['league']
	: '';
$football_factory_kickoff = isset( $football_factory_match['kickoff'] )
	? (string) $football_factory_match['kickoff']
	: '';
$football_factory_status  = isset( $football_factory_match['status'] )
	? (string) $football_factory_match['status']
	: 'scheduled';
$football_factory_score_h = isset( $football_factory_match['score_home'] )
	? (int) $football_factory_match['score_home']
	: null;
$football_factory_score_a = isset( $football_factory_match['score_away'] )
	? (int) $football_factory_match['score_away']
	: null;

if ( '' === $football_factory_home || '' === $football_factory_away ) {
	return;
}

$football_factory_kickoff_th = '';
if ( '' !== $football_factory_kickoff ) {
	$football_factory_ts = strtotime( $football_factory_kickoff );
	if ( false !== $football_factory_ts ) {
		$football_factory_kickoff_th = date_i18n( 'D j M H:i', $football_factory_ts );
	}
}

$football_factory_label_score = __( 'คะแนน', 'football-factory' );
?>
<a
	class="ff-match-card" href="
	<?php echo esc_url( $football_factory_url ); ?>
	" data-tp="match/match-card" data-demo="true" data-status="
	<?php echo esc_attr( $football_factory_status ); ?>
	" aria-label="
	<?php echo esc_attr( $football_factory_home . ' vs ' . $football_factory_away ); ?>
	"
>
	<div class="ff-match-card__head">
		<?php if ( '' !== $football_factory_league ) : ?>
			<span class="ff-badge ff-badge--brand"><?php echo esc_html( $football_factory_league ); ?></span>
		<?php endif; ?>
		<?php if ( '' !== $football_factory_kickoff_th ) : ?>
			<time
				class="ff-match-card__time" datetime="
				<?php echo esc_attr( $football_factory_kickoff ); ?>
				"
			>
		<?php endif; ?>
	</div>
	<div class="ff-match-card__teams" aria-label="<?php echo esc_attr( $football_factory_label_score ); ?>">
		<div class="ff-match-card__team ff-match-card__team--home">
			<span
				class="ff-live-bar__crest" data-crest="
				<?php echo esc_attr( $football_factory_home_c ); ?>
				" data-size="24" aria-hidden="true"
			>
			<span class="ff-match-card__team-name"><?php echo esc_html( $football_factory_home ); ?></span>
		</div>
		<div class="ff-match-card__score">
			<?php if ( null !== $football_factory_score_h && null !== $football_factory_score_a ) : ?>
				<strong
				>
			<?php else : ?>
				<span aria-hidden="true">vs</span>
			<?php endif; ?>
		</div>
		<div class="ff-match-card__team ff-match-card__team--away">
			<span class="ff-match-card__team-name"><?php echo esc_html( $football_factory_away ); ?></span>
			<span
				class="ff-live-bar__crest" data-crest="
				<?php echo esc_attr( $football_factory_away_c ); ?>
				" data-size="24" aria-hidden="true"
			>
		</div>
	</div>
</a>

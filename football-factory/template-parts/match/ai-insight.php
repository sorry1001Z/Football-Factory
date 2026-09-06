<?php
/**
 * Template Part: AI Insight (TP-021)
 *
 * AI match prediction widget with probability bars.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $insight {
 *         @type int    $home_prob     Home win probability (0-100).
 *         @type int    $draw_prob     Draw probability (0-100).
 *         @type int    $away_prob     Away win probability (0-100).
 *         @type string $home_team     Home team name.
 *         @type string $away_team     Away team name.
 *         @type string $league        League label.
 *         @type string $kickoff       ISO datetime.
 *         @type string $key_player    Key player to watch.
 *         @type string $key_player_code Key player code.
 *         @type string $key_player_palette Key player palette.
 *         @type string $disclaimer    Disclaimer text.
 *         @type string $confidence    Confidence: low|medium|high.
 *     }
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_insight = isset( $args['insight'] ) && is_array( $args['insight'] ) ? $args['insight'] : array();
if (
	empty( $football_factory_insight )
	&& isset( $football_factory_arg_insight )
	&& is_array( $football_factory_arg_insight )
	) {
	$football_factory_insight = $football_factory_arg_insight;
}

$football_factory_home       = isset( $football_factory_insight['home_team'] )
	? (string) $football_factory_insight['home_team']
	: '';
$football_factory_away       = isset( $football_factory_insight['away_team'] )
	? (string) $football_factory_insight['away_team']
	: '';
$football_factory_league     = isset( $football_factory_insight['league'] )
	? (string) $football_factory_insight['league']
	: '';
$football_factory_kickoff    = isset( $football_factory_insight['kickoff'] )
	? (string) $football_factory_insight['kickoff']
	: '';
$football_factory_home_prob  = isset( $football_factory_insight['home_prob'] )
	? max( 0, min( 100, (int) $football_factory_insight['home_prob'] ) )
	: 0;
$football_factory_draw_prob  = isset( $football_factory_insight['draw_prob'] )
	? max( 0, min( 100, (int) $football_factory_insight['draw_prob'] ) )
	: 0;
$football_factory_away_prob  = isset( $football_factory_insight['away_prob'] )
	? max( 0, min( 100, (int) $football_factory_insight['away_prob'] ) )
	: 0;
$football_factory_key_player = isset( $football_factory_insight['key_player'] )
	? (string) $football_factory_insight['key_player']
	: '';
$football_factory_key_code   = isset( $football_factory_insight['key_player_code'] )
	? (string) $football_factory_insight['key_player_code']
	: '';
$football_factory_key_pal    = isset( $football_factory_insight['key_player_palette'] )
	? (string) $football_factory_insight['key_player_palette']
	: '';
$football_factory_disclaimer = isset( $football_factory_insight['disclaimer'] )
	? (string) $football_factory_insight['disclaimer']
	: __( 'ผลจาก AI เป็นเพียงการคาดการณ์ ไม่รับประกันผลลัพธ์', 'football-factory' );
$football_factory_confidence = isset( $football_factory_insight['confidence'] )
	? (string) $football_factory_insight['confidence']
	: 'medium';

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

$football_factory_label_title      = __( 'AI วิเคราะห์', 'football-factory' );
$football_factory_label_home       = __( 'เจ้าบ้านชนะ', 'football-factory' );
$football_factory_label_draw       = __( 'เสมอ', 'football-factory' );
$football_factory_label_away       = __( 'ทีมเยือนชนะ', 'football-factory' );
$football_factory_label_player     = __( 'ผู้เล่นที่น่าจับตา', 'football-factory' );
$football_factory_label_confidence = __( 'ความเชื่อมั่น', 'football-factory' );
?>
<section
	class="ff-ai-insight" data-tp="match/ai-insight" data-demo="true" data-confidence="
	<?php echo esc_attr( $football_factory_confidence ); ?>
	" aria-labelledby="ff-ai-insight-title"
>
	<div class="ff-ai-insight__head">
		<?php if ( '' !== $football_factory_league ) : ?>
			<span
				class="ff-ai-insight__league ff-badge ff-badge--brand"
			>
		<?php endif; ?>
		<?php if ( '' !== $football_factory_kickoff_th ) : ?>
			<span class="ff-ai-insight__time"><?php echo esc_html( $football_factory_kickoff_th ); ?></span>
		<?php endif; ?>
	</div>
	<h3
		id="ff-ai-insight-title" class="ff-ai-insight__title"
	>
	<div class="ff-prediction-line">
		<div class="ff-prediction-line__row">
			<span
				class="ff-prediction-line__label"
			>
			<span
				class="ff-prediction-line__bar"
			>
			<span class="ff-prediction-line__value"><?php echo (int) $football_factory_home_prob; ?>%</span>
		</div>
		<div class="ff-prediction-line__row">
			<span class="ff-prediction-line__label"><?php echo esc_html( $football_factory_label_draw ); ?></span>
			<span
				class="ff-prediction-line__bar"
			>
			<span class="ff-prediction-line__value"><?php echo (int) $football_factory_draw_prob; ?>%</span>
		</div>
		<div class="ff-prediction-line__row">
			<span
				class="ff-prediction-line__label"
			>
			<span
				class="ff-prediction-line__bar"
			>
			<span class="ff-prediction-line__value"><?php echo (int) $football_factory_away_prob; ?>%</span>
		</div>
	</div>
	<?php if ( '' !== $football_factory_key_player ) : ?>
		<p class="ff-ai-insight__key-player">
			<?php if ( '' !== $football_factory_key_pal ) : ?>
				<span
					class="ff-ai-insight__key-player-avatar" data-palette="
					<?php echo esc_attr( $football_factory_key_pal ); ?>
					"
					<?php
					echo '' !== $football_factory_key_code
						? 'data-player="' . esc_attr( $football_factory_key_code ) . '"'
						: '';
					?>
					aria-hidden="true"
				>
			<?php endif; ?>
			<span
				class="ff-ai-insight__key-player-label"
			>
			<strong
				class="ff-ai-insight__key-player-code"
			>
		</p>
	<?php endif; ?>
	<p
		class="ff-ai-insight__disclaimer"
	>
</section>

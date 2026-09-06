<?php
/**
 * Template Part: Preview Card (TP-039)
 *
 * Match preview card with home/away teams, kickoff, and venue.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $preview {
 *         @type string $home        Home team name.
 *         @type string $away        Away team name.
 *         @type string $home_code   Home team short code.
 *         @type string $away_code   Away team short code.
 *         @type string $league      League label.
 *         @type string $kickoff     ISO datetime.
 *         @type string $venue       Stadium/venue.
 *         @type string $url         Link to full preview.
 *         @type string $palette     Background palette.
 *         @type string $prediction  Optional AI prediction text.
 *     }
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_preview = isset( $args['preview'] ) && is_array( $args['preview'] ) ? $args['preview'] : array();
if (
	empty( $football_factory_preview )
	&& isset( $football_factory_arg_preview )
	&& is_array( $football_factory_arg_preview )
	) {
	$football_factory_preview = $football_factory_arg_preview;
}

$football_factory_home    = isset( $football_factory_preview['home'] )
	? (string) $football_factory_preview['home']
	: '';
$football_factory_away    = isset( $football_factory_preview['away'] )
	? (string) $football_factory_preview['away']
	: '';
$football_factory_home_c  = isset( $football_factory_preview['home_code'] )
	? (string) $football_factory_preview['home_code']
	: '';
$football_factory_away_c  = isset( $football_factory_preview['away_code'] )
	? (string) $football_factory_preview['away_code']
	: '';
$football_factory_league  = isset( $football_factory_preview['league'] )
	? (string) $football_factory_preview['league']
	: '';
$football_factory_kickoff = isset( $football_factory_preview['kickoff'] )
	? (string) $football_factory_preview['kickoff']
	: '';
$football_factory_venue   = isset( $football_factory_preview['venue'] )
	? (string) $football_factory_preview['venue']
	: '';
$football_factory_url     = isset( $football_factory_preview['url'] ) ? (string) $football_factory_preview['url'] : '#';
$football_factory_palette = isset( $football_factory_preview['palette'] )
	? (string) $football_factory_preview['palette']
	: '';
$football_factory_pred    = isset( $football_factory_preview['prediction'] )
	? (string) $football_factory_preview['prediction']
	: '';

if ( '' === $football_factory_home || '' === $football_factory_away ) {
	return;
}

$football_factory_kickoff_th = '';
if ( '' !== $football_factory_kickoff ) {
	$football_factory_ts = strtotime( $football_factory_kickoff );
	if ( false !== $football_factory_ts ) {
		$football_factory_kickoff_th = date_i18n( 'D j M · H:i', $football_factory_ts );
	}
}

$football_factory_label_preview = __( 'พรีวิว', 'football-factory' );
$football_factory_label_kickoff = __( 'เวลาเตะ', 'football-factory' );
$football_factory_label_venue   = __( 'สนาม', 'football-factory' );
?>
<a
	class="ff-preview-card" href="
	<?php echo esc_url( $football_factory_url ); ?>
	" data-tp="cards/preview" data-demo="true" aria-label="
	<?php echo esc_attr( $football_factory_home . ' vs ' . $football_factory_away ); ?>
	"
>
	<div
	>
		<?php if ( '' !== $football_factory_league ) : ?>
			<span class="ff-badge ff-badge--brand"><?php echo esc_html( $football_factory_league ); ?></span>
		<?php endif; ?>
		<span class="ff-preview-card__label"><?php echo esc_html( $football_factory_label_preview ); ?></span>
	</div>
	<div class="ff-preview-card__teams">
		<div class="ff-preview-card__team ff-preview-card__team--home">
			<span
				class="ff-live-bar__crest" data-crest="
				<?php echo esc_attr( $football_factory_home_c ); ?>
				" data-size="40" aria-hidden="true"
			>
			<span class="ff-preview-card__team-name"><?php echo esc_html( $football_factory_home ); ?></span>
		</div>
		<div class="ff-preview-card__vs" aria-hidden="true">VS</div>
		<div class="ff-preview-card__team ff-preview-card__team--away">
			<span
				class="ff-live-bar__crest" data-crest="
				<?php echo esc_attr( $football_factory_away_c ); ?>
				" data-size="40" aria-hidden="true"
			>
			<span class="ff-preview-card__team-name"><?php echo esc_html( $football_factory_away ); ?></span>
		</div>
	</div>
	<dl class="ff-preview-card__meta">
		<?php if ( '' !== $football_factory_kickoff_th ) : ?>
			<div class="ff-preview-card__meta-item">
				<dt class="ff-sr"><?php echo esc_html( $football_factory_label_kickoff ); ?></dt>
				<dd class="ff-preview-card__meta-value"><?php echo esc_html( $football_factory_kickoff_th ); ?></dd>
			</div>
		<?php endif; ?>
		<?php if ( '' !== $football_factory_venue ) : ?>
			<div class="ff-preview-card__meta-item">
				<dt class="ff-sr"><?php echo esc_html( $football_factory_label_venue ); ?></dt>
				<dd class="ff-preview-card__meta-value"><?php echo esc_html( $football_factory_venue ); ?></dd>
			</div>
		<?php endif; ?>
	</dl>
	<?php if ( '' !== $football_factory_pred ) : ?>
		<p class="ff-preview-card__prediction"><?php echo esc_html( $football_factory_pred ); ?></p>
	<?php endif; ?>
</a>

<?php
/**
 * Template Part: Player Hero (TP-031)
 *
 * Player profile header with photo, name, position, team, nationality.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $player PlayerHeroViewModel {
 *         @type string $name          Player name (English).
 *         @type string $name_th       Player name (Thai).
 *         @type string $position      Position (GK, DF, MF, FW).
 *         @type int    $number        Shirt number.
 *         @type string $team          Team name.
 *         @type string $team_code     Team code.
 *         @type string $nationality   Nationality.
 *         @type int    $age           Age.
 *         @type int    $height_cm     Height in cm.
 *         @type int    $weight_kg     Weight in kg.
 *         @type string $preferred_foot Preferred foot.
 *         @type string $palette       Background palette.
 *         @type string $url           Player URL.
 *     }
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_player = isset( $args['player'] ) && is_array( $args['player'] ) ? $args['player'] : array();
if (
	empty( $football_factory_player )
	&& isset( $football_factory_arg_player )
	&& is_array( $football_factory_arg_player )
	) {
	$football_factory_player = $football_factory_arg_player;
}

$football_factory_player_name   = isset( $football_factory_player['name'] )
	? (string) $football_factory_player['name']
	: '';
$football_factory_player_name_t = isset( $football_factory_player['name_th'] )
	? (string) $football_factory_player['name_th']
	: '';
$football_factory_player_pos    = isset( $football_factory_player['position'] )
	? (string) $football_factory_player['position']
	: '';
$football_factory_player_num    = isset( $football_factory_player['number'] )
	? (int) $football_factory_player['number']
	: 0;
$football_factory_player_team   = isset( $football_factory_player['team'] )
	? (string) $football_factory_player['team']
	: '';
$football_factory_player_tcode  = isset( $football_factory_player['team_code'] )
	? (string) $football_factory_player['team_code']
	: '';
$football_factory_player_nat    = isset( $football_factory_player['nationality'] )
	? (string) $football_factory_player['nationality']
	: '';
$football_factory_player_age    = isset( $football_factory_player['age'] ) ? (int) $football_factory_player['age'] : 0;
$football_factory_player_h      = isset( $football_factory_player['height_cm'] )
	? (int) $football_factory_player['height_cm']
	: 0;
$football_factory_player_w      = isset( $football_factory_player['weight_kg'] )
	? (int) $football_factory_player['weight_kg']
	: 0;
$football_factory_player_foot   = isset( $football_factory_player['preferred_foot'] )
	? (string) $football_factory_player['preferred_foot']
	: '';
$football_factory_player_pal    = isset( $football_factory_player['palette'] )
	? (string) $football_factory_player['palette']
	: '';
$football_factory_player_url    = isset( $football_factory_player['url'] )
	? (string) $football_factory_player['url']
	: '#';

if ( '' === $football_factory_player_name && '' === $football_factory_player_name_t ) {
	return;
}

$football_factory_player_label = '' !== $football_factory_player_name_t
	? $football_factory_player_name_t
	: $football_factory_player_name;

$football_factory_label_pos  = __( 'ตำแหน่ง', 'football-factory' );
$football_factory_label_team = __( 'ทีม', 'football-factory' );
$football_factory_label_nat  = __( 'สัญชาติ', 'football-factory' );
$football_factory_label_age  = __( 'อายุ', 'football-factory' );
$football_factory_label_h    = __( 'ส่วนสูง', 'football-factory' );
$football_factory_label_w    = __( 'น้ำหนัก', 'football-factory' );
$football_factory_label_foot = __( 'เท้าถนัด', 'football-factory' );
?>
<section
	class="ff-player-hero" data-tp="player/hero" data-demo="true" data-player-code="
	<?php echo esc_attr( $football_factory_player_tcode ); ?>
	" aria-label="
	<?php echo esc_attr( $football_factory_player_label ); ?>
	"
>
	<div
	>
	<div class="ff-container ff-player-hero__inner">
		<div
			class="ff-player-hero__avatar" data-palette="
			<?php echo esc_attr( $football_factory_player_pal ); ?>
			"
			<?php
			echo '' !== $football_factory_player_tcode
				? 'data-player="' . esc_attr( $football_factory_player_tcode ) . '"'
				: '';
			?>
			data-size="160" aria-hidden="true"
		>
			<?php if ( $football_factory_player_num > 0 ) : ?>
				<span class="ff-player-hero__number"><?php echo (int) $football_factory_player_num; ?></span>
			<?php endif; ?>
		</div>
		<div class="ff-player-hero__body">
			<h1 class="ff-player-hero__name"><?php echo esc_html( $football_factory_player_label ); ?></h1>
			<?php if ( '' !== $football_factory_player_name && '' !== $football_factory_player_name_t ) : ?>
				<p class="ff-player-hero__name-en"><?php echo esc_html( $football_factory_player_name ); ?></p>
			<?php endif; ?>
			<div class="ff-player-hero__chips">
				<?php if ( '' !== $football_factory_player_pos ) : ?>
					<span
						class="ff-badge ff-badge--brand"
					>
				<?php endif; ?>
				<?php if ( '' !== $football_factory_player_team ) : ?>
					<span class="ff-player-hero__team">
						<?php if ( '' !== $football_factory_player_tcode ) : ?>
							<span
								class="ff-standings__crest" data-crest="
								<?php echo esc_attr( $football_factory_player_tcode ); ?>
								" data-size="14" aria-hidden="true"
							>
						<?php endif; ?>
						<?php echo esc_html( $football_factory_player_team ); ?>
					</span>
				<?php endif; ?>
			</div>
			<dl class="ff-player-hero__stats">
				<?php if ( '' !== $football_factory_player_nat ) : ?>
					<div class="ff-player-hero__stat">
						<dt><?php echo esc_html( $football_factory_label_nat ); ?></dt>
						<dd><?php echo esc_html( $football_factory_player_nat ); ?></dd>
					</div>
				<?php endif; ?>
				<?php if ( $football_factory_player_age > 0 ) : ?>
					<div class="ff-player-hero__stat">
						<dt><?php echo esc_html( $football_factory_label_age ); ?></dt>
						<dd><?php echo (int) $football_factory_player_age; ?></dd>
					</div>
				<?php endif; ?>
				<?php if ( $football_factory_player_h > 0 ) : ?>
					<div class="ff-player-hero__stat">
						<dt><?php echo esc_html( $football_factory_label_h ); ?></dt>
						<dd><?php echo (int) $football_factory_player_h; ?> cm</dd>
					</div>
				<?php endif; ?>
				<?php if ( $football_factory_player_w > 0 ) : ?>
					<div class="ff-player-hero__stat">
						<dt><?php echo esc_html( $football_factory_label_w ); ?></dt>
						<dd><?php echo (int) $football_factory_player_w; ?> kg</dd>
					</div>
				<?php endif; ?>
				<?php if ( '' !== $football_factory_player_foot ) : ?>
					<div class="ff-player-hero__stat">
						<dt><?php echo esc_html( $football_factory_label_foot ); ?></dt>
						<dd><?php echo esc_html( $football_factory_player_foot ); ?></dd>
					</div>
				<?php endif; ?>
			</dl>
		</div>
	</div>
</section>

<?php
/**
 * Template Part: Team Hero (TP-027)
 *
 * Team profile header with crest, name, league, manager, and key stats.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $team TeamHeroViewModel {
 *         @type string $name         Team name.
 *         @type string $name_th      Team name (Thai).
 *         @type string $code         Team code.
 *         @type string $league       League name.
 *         @type string $country      Country.
 *         @type string $city         City.
 *         @type string $stadium      Stadium name.
 *         @type int    $founded      Founded year.
 *         @type string $manager      Manager name.
 *         @type string $manager_th   Manager name (Thai).
 *         @type string $palette      Background palette.
 *         @type string $url          Team URL.
 *         @type int    $rank         League rank.
 *         @type int    $points       League points.
 *         @type string $form         Last-5 form letters.
 *     }
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_team = isset( $args['team'] ) && is_array( $args['team'] ) ? $args['team'] : array();
if (
	empty( $football_factory_team )
	&& isset( $football_factory_arg_team )
	&& is_array( $football_factory_arg_team )
	) {
	$football_factory_team = $football_factory_arg_team;
}

$football_factory_team_name   = isset( $football_factory_team['name'] ) ? (string) $football_factory_team['name'] : '';
$football_factory_team_name_t = isset( $football_factory_team['name_th'] )
	? (string) $football_factory_team['name_th']
	: '';
$football_factory_team_code   = isset( $football_factory_team['code'] ) ? (string) $football_factory_team['code'] : '';
$football_factory_team_league = isset( $football_factory_team['league'] )
	? (string) $football_factory_team['league']
	: '';
$football_factory_team_ctry   = isset( $football_factory_team['country'] )
	? (string) $football_factory_team['country']
	: '';
$football_factory_team_city   = isset( $football_factory_team['city'] ) ? (string) $football_factory_team['city'] : '';
$football_factory_team_stad   = isset( $football_factory_team['stadium'] )
	? (string) $football_factory_team['stadium']
	: '';
$football_factory_team_found  = isset( $football_factory_team['founded'] )
	? (int) $football_factory_team['founded']
	: 0;
$football_factory_team_mgr    = isset( $football_factory_team['manager'] )
	? (string) $football_factory_team['manager']
	: '';
$football_factory_team_mgr_t  = isset( $football_factory_team['manager_th'] )
	? (string) $football_factory_team['manager_th']
	: '';
$football_factory_team_pal    = isset( $football_factory_team['palette'] )
	? (string) $football_factory_team['palette']
	: '';
$football_factory_team_url    = isset( $football_factory_team['url'] ) ? (string) $football_factory_team['url'] : '#';
$football_factory_team_rank   = isset( $football_factory_team['rank'] ) ? (int) $football_factory_team['rank'] : 0;
$football_factory_team_pts    = isset( $football_factory_team['points'] ) ? (int) $football_factory_team['points'] : 0;
$football_factory_team_form   = isset( $football_factory_team['form'] ) && is_array( $football_factory_team['form'] )
	? $football_factory_team['form']
	: array();

if ( '' === $football_factory_team_name && '' === $football_factory_team_name_t ) {
	return;
}

$football_factory_label_team = '' !== $football_factory_team_name_t
	? $football_factory_team_name_t
	: $football_factory_team_name;
?>
<section
	class="ff-team-hero" data-tp="team/hero" data-demo="true" data-team-code="
	<?php echo esc_attr( $football_factory_team_code ); ?>
	" aria-label="
	<?php echo esc_attr( $football_factory_label_team ); ?>
	"
>
	<div
	>
	<div class="ff-container ff-team-hero__inner">
		<div
			class="ff-team-hero__crest" data-crest="
			<?php echo esc_attr( $football_factory_team_code ); ?>
			" data-size="120" aria-hidden="true"
		>
		<div class="ff-team-hero__body">
			<div class="ff-team-hero__meta">
				<?php if ( '' !== $football_factory_team_league ) : ?>
					<span
						class="ff-badge ff-badge--brand"
					>
				<?php endif; ?>
				<?php if ( '' !== $football_factory_team_ctry ) : ?>
					<span class="ff-team-hero__country"><?php echo esc_html( $football_factory_team_ctry ); ?></span>
				<?php endif; ?>
			</div>
			<h1 class="ff-team-hero__name"><?php echo esc_html( $football_factory_label_team ); ?></h1>
			<?php if ( '' !== $football_factory_team_name && '' !== $football_factory_team_name_t ) : ?>
				<p class="ff-team-hero__name-en"><?php echo esc_html( $football_factory_team_name ); ?></p>
			<?php endif; ?>
			<dl class="ff-team-hero__stats">
				<?php if ( $football_factory_team_rank > 0 ) : ?>
					<div class="ff-team-hero__stat">
						<dt><?php esc_html_e( 'อันดับ', 'football-factory' ); ?></dt>
						<dd><?php echo (int) $football_factory_team_rank; ?></dd>
					</div>
				<?php endif; ?>
				<?php if ( $football_factory_team_pts > 0 ) : ?>
					<div class="ff-team-hero__stat">
						<dt><?php esc_html_e( 'คะแนน', 'football-factory' ); ?></dt>
						<dd><?php echo (int) $football_factory_team_pts; ?></dd>
					</div>
				<?php endif; ?>
				<?php if ( ! empty( $football_factory_team_form ) ) : ?>
					<div class="ff-team-hero__stat">
						<dt><?php esc_html_e( 'ฟอร์ม', 'football-factory' ); ?></dt>
						<dd>
							<?php
							$football_factory_arg_form = $football_factory_team_form;
							$football_factory_arg_size = 'sm';
							include __DIR__ . '/../match/form.php';
							?>
						</dd>
					</div>
				<?php endif; ?>
			</dl>
			<div class="ff-team-hero__details">
				<?php if ( '' !== $football_factory_team_stad ) : ?>
					<span
					>
				<?php endif; ?>
				<?php if ( '' !== $football_factory_team_city ) : ?>
					<span
					>
				<?php endif; ?>
				<?php if ( $football_factory_team_found > 0 ) : ?>
					<span
					>
				<?php endif; ?>
				<?php if ( '' !== $football_factory_team_mgr_t || '' !== $football_factory_team_mgr ) : ?>
					<span
					>
				<?php endif; ?>
			</div>
		</div>
	</div>
</section>

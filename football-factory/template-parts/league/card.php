<?php
/**
 * Template Part: League Card (TP-026)
 *
 * Reusable league summary card.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $card LeagueCardViewModel {
 *         @type string $name       League name.
 *         @type string $code       League code.
 *         @type string $country    Country.
 *         @type int    $teams      Number of teams.
 *         @type int    $matchweek  Current matchweek.
 *         @type string $palette    Background palette.
 *         @type string $url        Link URL.
 *     }
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_card = isset( $args['card'] ) && is_array( $args['card'] ) ? $args['card'] : array();
if (
	empty( $football_factory_card )
	&& isset( $football_factory_arg_card )
	&& is_array( $football_factory_arg_card )
	) {
	$football_factory_card = $football_factory_arg_card;
}

$football_factory_card_name  = isset( $football_factory_card['name'] ) ? (string) $football_factory_card['name'] : '';
$football_factory_card_code  = isset( $football_factory_card['code'] ) ? (string) $football_factory_card['code'] : '';
$football_factory_card_ctry  = isset( $football_factory_card['country'] )
	? (string) $football_factory_card['country']
	: '';
$football_factory_card_teams = isset( $football_factory_card['teams'] ) ? (int) $football_factory_card['teams'] : 0;
$football_factory_card_mw    = isset( $football_factory_card['matchweek'] )
	? (int) $football_factory_card['matchweek']
	: 0;
$football_factory_card_pal   = isset( $football_factory_card['palette'] )
	? (string) $football_factory_card['palette']
	: '';
$football_factory_card_url   = isset( $football_factory_card['url'] ) ? (string) $football_factory_card['url'] : '#';

if ( '' === $football_factory_card_name ) {
	return;
}
?>
<a
	class="ff-league-card" href="
	<?php echo esc_url( $football_factory_card_url ); ?>
	" data-tp="league/card" data-demo="true" data-league-code="
	<?php echo esc_attr( $football_factory_card_code ); ?>
	"
>
	<div
	>
		<?php if ( '' !== $football_factory_card_code ) : ?>
			<span
				class="ff-league-card__logo" data-league-logo="
				<?php echo esc_attr( $football_factory_card_code ); ?>
				" data-size="48"
			>
		<?php endif; ?>
	</div>
	<div class="ff-league-card__body">
		<h3 class="ff-league-card__name"><?php echo esc_html( $football_factory_card_name ); ?></h3>
		<dl class="ff-league-card__meta">
			<?php if ( '' !== $football_factory_card_ctry ) : ?>
				<div class="ff-league-card__meta-item">
					<dt class="ff-sr"><?php esc_html_e( 'ประเทศ', 'football-factory' ); ?></dt>
					<dd><?php echo esc_html( $football_factory_card_ctry ); ?></dd>
				</div>
			<?php endif; ?>
			<?php if ( $football_factory_card_teams > 0 ) : ?>
				<div class="ff-league-card__meta-item">
					<dt class="ff-sr"><?php esc_html_e( 'จำนวนทีม', 'football-factory' ); ?></dt>
					<dd
					>
				</div>
			<?php endif; ?>
			<?php if ( $football_factory_card_mw > 0 ) : ?>
				<div class="ff-league-card__meta-item">
					<dt class="ff-sr"><?php esc_html_e( 'นัดที่', 'football-factory' ); ?></dt>
					<dd><?php echo (int) $football_factory_card_mw; ?></dd>
				</div>
			<?php endif; ?>
		</dl>
	</div>
</a>

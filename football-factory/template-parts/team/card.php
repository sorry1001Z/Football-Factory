<?php
/**
 * Template Part: Team Card (TP-030)
 *
 * Reusable team summary card.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $card TeamCardViewModel.
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

$football_factory_card_name   = isset( $football_factory_card['name'] ) ? (string) $football_factory_card['name'] : '';
$football_factory_card_name_t = isset( $football_factory_card['name_th'] )
	? (string) $football_factory_card['name_th']
	: '';
$football_factory_card_code   = isset( $football_factory_card['code'] ) ? (string) $football_factory_card['code'] : '';
$football_factory_card_league = isset( $football_factory_card['league'] )
	? (string) $football_factory_card['league']
	: '';
$football_factory_card_pal    = isset( $football_factory_card['palette'] )
	? (string) $football_factory_card['palette']
	: '';
$football_factory_card_url    = isset( $football_factory_card['url'] ) ? (string) $football_factory_card['url'] : '#';
$football_factory_card_form   = isset( $football_factory_card['form'] ) && is_array( $football_factory_card['form'] )
	? $football_factory_card['form']
	: array();
$football_factory_card_rank   = isset( $football_factory_card['rank'] ) ? (int) $football_factory_card['rank'] : 0;
$football_factory_card_pts    = isset( $football_factory_card['points'] ) ? (int) $football_factory_card['points'] : 0;

if ( '' === $football_factory_card_name && '' === $football_factory_card_name_t ) {
	return;
}
$football_factory_card_label = '' !== $football_factory_card_name_t
	? $football_factory_card_name_t
	: $football_factory_card_name;
?>
<a
	class="ff-team-card" href="
	<?php echo esc_url( $football_factory_card_url ); ?>
	" data-tp="team/card" data-demo="true" data-team-code="
	<?php echo esc_attr( $football_factory_card_code ); ?>
	" aria-label="
	<?php echo esc_attr( $football_factory_card_label ); ?>
	"
>
	<div
	>
		<span
			class="ff-team-card__crest" data-crest="
			<?php echo esc_attr( $football_factory_card_code ); ?>
			" data-size="48"
		>
	</div>
	<div class="ff-team-card__body">
		<h3 class="ff-team-card__name"><?php echo esc_html( $football_factory_card_label ); ?></h3>
		<?php if ( '' !== $football_factory_card_league ) : ?>
			<span class="ff-team-card__league"><?php echo esc_html( $football_factory_card_league ); ?></span>
		<?php endif; ?>
		<?php if ( $football_factory_card_rank > 0 || $football_factory_card_pts > 0 ) : ?>
			<dl class="ff-team-card__stats">
				<?php if ( $football_factory_card_rank > 0 ) : ?>
					<div class="ff-team-card__stat">
						<dt class="ff-sr"><?php esc_html_e( 'อันดับ', 'football-factory' ); ?></dt>
						<dd>#<?php echo (int) $football_factory_card_rank; ?></dd>
					</div>
				<?php endif; ?>
				<?php if ( $football_factory_card_pts > 0 ) : ?>
					<div class="ff-team-card__stat">
						<dt class="ff-sr"><?php esc_html_e( 'คะแนน', 'football-factory' ); ?></dt>
						<dd><?php echo (int) $football_factory_card_pts; ?> pts</dd>
					</div>
				<?php endif; ?>
			</dl>
		<?php endif; ?>
		<?php if ( ! empty( $football_factory_card_form ) ) : ?>
			<div class="ff-team-card__form">
				<?php
				$football_factory_arg_form = $football_factory_card_form;
				$football_factory_arg_size = 'sm';
				include __DIR__ . '/../match/form.php';
				?>
			</div>
		<?php endif; ?>
	</div>
</a>

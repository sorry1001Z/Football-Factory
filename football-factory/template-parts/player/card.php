<?php
/**
 * Template Part: Player Card (TP-034)
 *
 * Reusable player summary card.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $card PlayerCardViewModel.
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
$football_factory_variant     = isset( $args['variant'] ) ? (string) $args['variant'] : 'default';
$football_factory_arg_variant = $football_factory_variant;

$football_factory_card_name   = isset( $football_factory_card['name'] ) ? (string) $football_factory_card['name'] : '';
$football_factory_card_name_t = isset( $football_factory_card['name_th'] )
	? (string) $football_factory_card['name_th']
	: '';
$football_factory_card_pos    = isset( $football_factory_card['position'] )
	? (string) $football_factory_card['position']
	: '';
$football_factory_card_num    = isset( $football_factory_card['number'] ) ? (int) $football_factory_card['number'] : 0;
$football_factory_card_team   = isset( $football_factory_card['team'] ) ? (string) $football_factory_card['team'] : '';
$football_factory_card_tcode  = isset( $football_factory_card['team_code'] )
	? (string) $football_factory_card['team_code']
	: '';
$football_factory_card_pal    = isset( $football_factory_card['palette'] )
	? (string) $football_factory_card['palette']
	: '';
$football_factory_card_url    = isset( $football_factory_card['url'] ) ? (string) $football_factory_card['url'] : '#';

if ( '' === $football_factory_card_name && '' === $football_factory_card_name_t ) {
	return;
}
$football_factory_card_label = '' !== $football_factory_card_name_t
	? $football_factory_card_name_t
	: $football_factory_card_name;

$football_factory_class = 'ff-player-card';
if ( 'compact' === $football_factory_variant ) {
	$football_factory_class .= ' ff-player-card--compact';
}
?>
<a
	class="
	<?php echo esc_attr( $football_factory_class ); ?>
	" href="
	<?php echo esc_url( $football_factory_card_url ); ?>
	" data-tp="player/card" data-demo="true" data-player-code="
	<?php echo esc_attr( $football_factory_card_tcode ); ?>
	" aria-label="
	<?php echo esc_attr( $football_factory_card_label ); ?>
	"
>
	<div
		class="ff-player-card__avatar" data-palette="
		<?php echo esc_attr( $football_factory_card_pal ); ?>
		"
		<?php
		echo '' !== $football_factory_card_tcode
			? 'data-player="' . esc_attr( $football_factory_card_tcode ) . '"'
			: '';
		?>
		data-size="64" aria-hidden="true"
	>
		<?php if ( $football_factory_card_num > 0 ) : ?>
			<span class="ff-player-card__number"><?php echo (int) $football_factory_card_num; ?></span>
		<?php endif; ?>
	</div>
	<div class="ff-player-card__body">
		<h3 class="ff-player-card__name"><?php echo esc_html( $football_factory_card_label ); ?></h3>
		<div class="ff-player-card__meta">
			<?php if ( '' !== $football_factory_card_pos ) : ?>
				<span class="ff-player-card__position"><?php echo esc_html( $football_factory_card_pos ); ?></span>
			<?php endif; ?>
			<?php if ( '' !== $football_factory_card_team ) : ?>
				<span class="ff-player-card__team">
					<?php if ( '' !== $football_factory_card_tcode ) : ?>
						<span
							class="ff-standings__crest" data-crest="
							<?php echo esc_attr( $football_factory_card_tcode ); ?>
							" data-size="12" aria-hidden="true"
						>
					<?php endif; ?>
					<?php echo esc_html( $football_factory_card_team ); ?>
				</span>
			<?php endif; ?>
		</div>
	</div>
</a>

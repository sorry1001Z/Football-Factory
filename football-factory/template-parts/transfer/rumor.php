<?php
/**
 * Template Part: Transfer Rumor (TP-037)
 *
 * Rumor variant of transfer card. Marked as unverified.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $card RumorCardViewModel.
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

$football_factory_card_player      = isset( $football_factory_card['player'] )
	? (string) $football_factory_card['player']
	: '';
$football_factory_card_player_t    = isset( $football_factory_card['player_th'] )
	? (string) $football_factory_card['player_th']
	: '';
$football_factory_card_from        = isset( $football_factory_card['from'] )
	? (string) $football_factory_card['from']
	: '';
$football_factory_card_to          = isset( $football_factory_card['to'] ) ? (string) $football_factory_card['to'] : '';
$football_factory_card_from_c      = isset( $football_factory_card['from_code'] )
	? (string) $football_factory_card['from_code']
	: '';
$football_factory_card_to_c        = isset( $football_factory_card['to_code'] )
	? (string) $football_factory_card['to_code']
	: '';
$football_factory_card_fee         = isset( $football_factory_card['fee'] )
	? (string) $football_factory_card['fee']
	: '';
$football_factory_card_source      = isset( $football_factory_card['source'] )
	? (string) $football_factory_card['source']
	: '';
$football_factory_card_pal         = isset( $football_factory_card['palette'] )
	? (string) $football_factory_card['palette']
	: '';
$football_factory_card_url         = isset( $football_factory_card['url'] )
	? (string) $football_factory_card['url']
	: '#';
$football_factory_card_reliability = isset( $football_factory_card['reliability'] )
	? (string) $football_factory_card['reliability']
	: '';

if ( '' === $football_factory_card_player && '' === $football_factory_card_player_t ) {
	return;
}

$football_factory_card_label = '' !== $football_factory_card_player_t
	? $football_factory_card_player_t
	: $football_factory_card_player;

$football_factory_label_rumor       = __( 'ข่าวลือ', 'football-factory' );
$football_factory_label_source      = __( 'แหล่งข่าว', 'football-factory' );
$football_factory_label_reliability = __( 'ความน่าเชื่อถือ', 'football-factory' );
?>
<a
	class="ff-transfer-card ff-transfer-card--rumor" href="
	<?php echo esc_url( $football_factory_card_url ); ?>
	" data-tp="transfer/rumor" data-demo="true" data-reliability="
	<?php echo esc_attr( $football_factory_card_reliability ); ?>
	" aria-label="
	<?php echo esc_attr( $football_factory_card_label ); ?>
	"
>
	<div
		class="ff-transfer-card__kind" aria-hidden="true"
	>
	<div class="ff-transfer-card__player">
		<?php if ( '' !== $football_factory_card_pal ) : ?>
			<span
				class="ff-transfer-card__avatar" data-palette="
				<?php echo esc_attr( $football_factory_card_pal ); ?>
				" aria-hidden="true"
			>
		<?php endif; ?>
		<span class="ff-transfer-card__player-name"><?php echo esc_html( $football_factory_card_label ); ?></span>
	</div>
	<div class="ff-transfer-card__route">
		<?php if ( '' !== $football_factory_card_from_c ) : ?>
			<span class="ff-transfer-card__from">
				<span
					class="ff-standings__crest" data-crest="
					<?php echo esc_attr( $football_factory_card_from_c ); ?>
					" data-size="18" aria-hidden="true"
				>
				<?php echo esc_html( $football_factory_card_from ); ?>
			</span>
		<?php endif; ?>
		<span class="ff-transfer-card__arrow" aria-hidden="true">→</span>
		<?php if ( '' !== $football_factory_card_to_c ) : ?>
			<span class="ff-transfer-card__to">
				<span
					class="ff-standings__crest" data-crest="
					<?php echo esc_attr( $football_factory_card_to_c ); ?>
					" data-size="18" aria-hidden="true"
				>
				<?php echo esc_html( $football_factory_card_to ); ?>
			</span>
		<?php endif; ?>
	</div>
	<div class="ff-transfer-card__fee">
		<?php
		echo '' !== $football_factory_card_fee
			? esc_html( $football_factory_card_fee )
			: esc_html__( 'ไม่เปิดเผย', 'football-factory' );
		?>
	</div>
	<?php if ( '' !== $football_factory_card_source || '' !== $football_factory_card_reliability ) : ?>
		<div class="ff-transfer-card__source">
			<?php if ( '' !== $football_factory_card_source ) : ?>
				<span
				>
			<?php endif; ?>
			<?php if ( '' !== $football_factory_card_reliability ) : ?>
				<span
				>
			<?php endif; ?>
		</div>
	<?php endif; ?>
</a>

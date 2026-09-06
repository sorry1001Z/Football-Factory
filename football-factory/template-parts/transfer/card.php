<?php
/**
 * Template Part: Transfer Card (TP-035)
 *
 * Reusable transfer row.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $card TransferCardViewModel {
 *         @type string $player      Player name.
 *         @type string $player_th   Player name (Thai).
 *         @type string $from        From club.
 *         @type string $to          To club.
 *         @type string $from_code   From club code.
 *         @type string $to_code     To club code.
 *         @type string $fee         Transfer fee text.
 *         @type string $date        ISO date.
 *         @type string $kind        in | out | loan | rumor | free.
 *         @type string $palette     Background palette.
 *         @type string $url         Link URL.
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

$football_factory_card_player   = isset( $football_factory_card['player'] )
	? (string) $football_factory_card['player']
	: '';
$football_factory_card_player_t = isset( $football_factory_card['player_th'] )
	? (string) $football_factory_card['player_th']
	: '';
$football_factory_card_from     = isset( $football_factory_card['from'] )
	? (string) $football_factory_card['from']
	: '';
$football_factory_card_to       = isset( $football_factory_card['to'] ) ? (string) $football_factory_card['to'] : '';
$football_factory_card_from_c   = isset( $football_factory_card['from_code'] )
	? (string) $football_factory_card['from_code']
	: '';
$football_factory_card_to_c     = isset( $football_factory_card['to_code'] )
	? (string) $football_factory_card['to_code']
	: '';
$football_factory_card_fee      = isset( $football_factory_card['fee'] ) ? (string) $football_factory_card['fee'] : '';
$football_factory_card_date     = isset( $football_factory_card['date'] )
	? (string) $football_factory_card['date']
	: '';
$football_factory_card_kind     = isset( $football_factory_card['kind'] )
	? (string) $football_factory_card['kind']
	: 'in';
$football_factory_card_pal      = isset( $football_factory_card['palette'] )
	? (string) $football_factory_card['palette']
	: '';
$football_factory_card_url      = isset( $football_factory_card['url'] ) ? (string) $football_factory_card['url'] : '#';

if ( '' === $football_factory_card_player && '' === $football_factory_card_player_t ) {
	return;
}

$football_factory_card_player_label = '' !== $football_factory_card_player_t
	? $football_factory_card_player_t
	: $football_factory_card_player;

$football_factory_date_th = '';
if ( '' !== $football_factory_card_date ) {
	$football_factory_ts = strtotime( $football_factory_card_date );
	if ( false !== $football_factory_ts ) {
		$football_factory_date_th = date_i18n( 'j M Y', $football_factory_ts );
	}
}

$football_factory_label_kind_in   = __( 'เข้า', 'football-factory' );
$football_factory_label_kind_out  = __( 'ออก', 'football-factory' );
$football_factory_label_kind_loan = __( 'ยืมตัว', 'football-factory' );
$football_factory_label_kind_free = __( 'ฟรี', 'football-factory' );

$football_factory_kind_label = $football_factory_label_kind_in;
if ( 'out' === $football_factory_card_kind ) {
	$football_factory_kind_label = $football_factory_label_kind_out;
} elseif ( 'loan' === $football_factory_card_kind ) {
	$football_factory_kind_label = $football_factory_label_kind_loan;
} elseif ( 'free' === $football_factory_card_kind ) {
	$football_factory_kind_label = $football_factory_label_kind_free;
}
?>
<a
	class="ff-transfer-card ff-transfer-card--
	<?php echo esc_attr( sanitize_html_class( $football_factory_card_kind ) ); ?>
	" href="
	<?php echo esc_url( $football_factory_card_url ); ?>
	" data-tp="transfer/card" data-demo="true" aria-label="
	<?php echo esc_attr( $football_factory_card_player_label ); ?>
	"
>
	<div class="ff-transfer-card__kind" aria-hidden="true"><?php echo esc_html( $football_factory_kind_label ); ?></div>
	<div class="ff-transfer-card__player">
		<?php if ( '' !== $football_factory_card_pal ) : ?>
			<span
				class="ff-transfer-card__avatar" data-palette="
				<?php echo esc_attr( $football_factory_card_pal ); ?>
				" aria-hidden="true"
			>
		<?php endif; ?>
		<span
			class="ff-transfer-card__player-name"
		>
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
	<?php if ( '' !== $football_factory_date_th ) : ?>
		<time
			class="ff-transfer-card__date" datetime="
			<?php echo esc_attr( $football_factory_card_date ); ?>
			"
		>
	<?php endif; ?>
</a>

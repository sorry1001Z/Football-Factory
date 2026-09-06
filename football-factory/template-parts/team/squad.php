<?php
/**
 * Template Part: Squad (TP-028)
 *
 * Squad listing organized by position.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $players Array of PlayerViewModel {
 *         Each: { id, name, name_th, position, number, team_code, url? }
 *     }
 *     @type string $title Section title.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_players = isset( $args['players'] ) && is_array( $args['players'] ) ? $args['players'] : array();
$football_factory_title   = isset( $args['title'] ) ? (string) $args['title'] : __( 'ขุนพลทีม', 'football-factory' );

$football_factory_label_empty = __( 'ยังไม่มีรายชื่อผู้เล่น', 'football-factory' );
$football_factory_label_gk    = __( 'ผู้รักษาประตู', 'football-factory' );
$football_factory_label_def   = __( 'กองหลัง', 'football-factory' );
$football_factory_label_mid   = __( 'กองกลาง', 'football-factory' );
$football_factory_label_fwd   = __( 'กองหน้า', 'football-factory' );

// Group by position.
$football_factory_groups = array(
	'GK' => array(),
	'DF' => array(),
	'MF' => array(),
	'FW' => array(),
);
foreach ( $football_factory_players as $football_factory_player ) {
	if ( ! is_array( $football_factory_player ) ) {
		continue;
	}
	$football_factory_pos = isset( $football_factory_player['position'] )
		? (string) $football_factory_player['position']
		: 'MF';
	if ( ! isset( $football_factory_groups[ $football_factory_pos ] ) ) {
		$football_factory_groups[ $football_factory_pos ] = array();
	}
	$football_factory_groups[ $football_factory_pos ][] = $football_factory_player;
}

$football_factory_pos_labels = array(
	'GK' => $football_factory_label_gk,
	'DF' => $football_factory_label_def,
	'MF' => $football_factory_label_mid,
	'FW' => $football_factory_label_fwd,
);
?>
<section
	class="ff-squad" aria-label="
	<?php echo esc_attr( $football_factory_title ); ?>
	" data-tp="team/squad" data-demo="true"
>
	<h3 class="ff-section-title"><?php echo esc_html( $football_factory_title ); ?></h3>
	<?php if ( empty( $football_factory_players ) ) : ?>
		<p class="ff-squad__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<?php foreach ( $football_factory_groups as $football_factory_pos_key => $football_factory_pos_players ) : ?>
			<?php if ( ! empty( $football_factory_pos_players ) ) : ?>
			<div class="ff-squad__group" data-position="<?php echo esc_attr( $football_factory_pos_key ); ?>">
				<h4
					class="ff-squad__group-title"
				>
				<ul class="ff-squad__list">
					<?php foreach ( $football_factory_pos_players as $football_factory_player ) : ?>
						<?php
						if ( ! is_array( $football_factory_player ) ) {
							continue;
						}
						$football_factory_arg_card    = $football_factory_player;
						$football_factory_arg_variant = 'compact';
						?>
						<li class="ff-squad__player">
							<?php include __DIR__ . '/../player/card.php'; ?>
						</li>
					<?php endforeach; ?>
				</ul>
			<?php endif; ?>
		</div>
		<?php endforeach; ?>
	<?php endif; ?>
</section>

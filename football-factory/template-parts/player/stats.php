<?php
/**
 * Template Part: Player Stats (TP-032)
 *
 * Player season statistics table (apps, goals, assists, cards).
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $stats {
 *         @type int    $apps        Appearances.
 *         @type int    $starts      Starts.
 *         @type int    $goals       Goals.
 *         @type int    $assists     Assists.
 *         @type int    $yellows     Yellow cards.
 *         @type int    $reds        Red cards.
 *         @type string $minutes     Minutes played.
 *         @type float  $rating      Average rating.
 *         @type array  $per_season  Per-season breakdown.
 *     }
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_stats = isset( $args['stats'] ) && is_array( $args['stats'] ) ? $args['stats'] : array();
if (
	empty( $football_factory_stats )
	&& isset( $football_factory_arg_stats )
	&& is_array( $football_factory_arg_stats )
	) {
	$football_factory_stats = $football_factory_arg_stats;
}

$football_factory_apps       = isset( $football_factory_stats['apps'] ) ? (int) $football_factory_stats['apps'] : 0;
$football_factory_starts     = isset( $football_factory_stats['starts'] ) ? (int) $football_factory_stats['starts'] : 0;
$football_factory_goals      = isset( $football_factory_stats['goals'] ) ? (int) $football_factory_stats['goals'] : 0;
$football_factory_asts       = isset( $football_factory_stats['assists'] )
	? (int) $football_factory_stats['assists']
	: 0;
$football_factory_yellows    = isset( $football_factory_stats['yellows'] )
	? (int) $football_factory_stats['yellows']
	: 0;
$football_factory_reds       = isset( $football_factory_stats['reds'] ) ? (int) $football_factory_stats['reds'] : 0;
$football_factory_minutes    = isset( $football_factory_stats['minutes'] )
	? (string) $football_factory_stats['minutes']
	: '';
$football_factory_rating     = isset( $football_factory_stats['rating'] )
	? (float) $football_factory_stats['rating']
	: 0;
$football_factory_per_season =
	isset( $football_factory_stats['per_season'] )
	&& is_array( $football_factory_stats['per_season'] )
	? $football_factory_stats['per_season']
	: array();

$football_factory_label_title   = __( 'สถิติผู้เล่น', 'football-factory' );
$football_factory_label_empty   = __( 'ยังไม่มีสถิติ', 'football-factory' );
$football_factory_label_apps    = __( 'นัด', 'football-factory' );
$football_factory_label_starts  = __( 'ตัวจริง', 'football-factory' );
$football_factory_label_goals   = __( 'ประตู', 'football-factory' );
$football_factory_label_asts    = __( 'แอสซิสต์', 'football-factory' );
$football_factory_label_yellows = __( 'ใบเหลือง', 'football-factory' );
$football_factory_label_reds    = __( 'ใบแดง', 'football-factory' );
$football_factory_label_mins    = __( 'นาที', 'football-factory' );
$football_factory_label_rating  = __( 'คะแนนเฉลี่ย', 'football-factory' );
?>
<section
	class="ff-stats-grid ff-player-stats" aria-label="
	<?php echo esc_attr( $football_factory_label_title ); ?>
	" data-tp="player/stats" data-demo="true"
>
	<h3 class="ff-section-title"><?php echo esc_html( $football_factory_label_title ); ?></h3>
	<?php
	if (
			0 === $football_factory_apps
			&& 0 === $football_factory_goals
			&& empty( $football_factory_per_season )
		) :
		?>
		<p class="ff-stats-grid__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<dl class="ff-stats-grid__summary">
			<?php if ( $football_factory_apps > 0 ) : ?>
				<div class="ff-stat">
					<dt><?php echo esc_html( $football_factory_label_apps ); ?></dt>
					<dd><strong><?php echo (int) $football_factory_apps; ?></strong></dd>
				</div>
			<?php endif; ?>
			<?php if ( $football_factory_starts > 0 ) : ?>
				<div class="ff-stat">
					<dt><?php echo esc_html( $football_factory_label_starts ); ?></dt>
					<dd><strong><?php echo (int) $football_factory_starts; ?></strong></dd>
				</div>
			<?php endif; ?>
			<?php if ( $football_factory_goals > 0 ) : ?>
				<div class="ff-stat">
					<dt><?php echo esc_html( $football_factory_label_goals ); ?></dt>
					<dd><strong><?php echo (int) $football_factory_goals; ?></strong></dd>
				</div>
			<?php endif; ?>
			<?php if ( $football_factory_asts > 0 ) : ?>
				<div class="ff-stat">
					<dt><?php echo esc_html( $football_factory_label_asts ); ?></dt>
					<dd><strong><?php echo (int) $football_factory_asts; ?></strong></dd>
				</div>
			<?php endif; ?>
			<?php if ( $football_factory_yellows > 0 ) : ?>
				<div class="ff-stat">
					<dt><?php echo esc_html( $football_factory_label_yellows ); ?></dt>
					<dd><strong><?php echo (int) $football_factory_yellows; ?></strong></dd>
				</div>
			<?php endif; ?>
			<?php if ( $football_factory_reds > 0 ) : ?>
				<div class="ff-stat">
					<dt><?php echo esc_html( $football_factory_label_reds ); ?></dt>
					<dd><strong><?php echo (int) $football_factory_reds; ?></strong></dd>
				</div>
			<?php endif; ?>
			<?php if ( '' !== $football_factory_minutes ) : ?>
				<div class="ff-stat">
					<dt><?php echo esc_html( $football_factory_label_mins ); ?></dt>
					<dd><strong><?php echo esc_html( $football_factory_minutes ); ?></strong></dd>
				</div>
			<?php endif; ?>
			<?php if ( $football_factory_rating > 0 ) : ?>
				<div class="ff-stat">
					<dt><?php echo esc_html( $football_factory_label_rating ); ?></dt>
					<dd
					>
				</div>
			<?php endif; ?>
		</dl>
		<?php if ( ! empty( $football_factory_per_season ) ) : ?>
			<table class="ff-standings__table ff-player-stats__table" style="min-width:520px">
				<thead>
					<tr>
						<th scope="col"><?php esc_html_e( 'ฤดูกาล', 'football-factory' ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_label_apps ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_label_goals ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_label_asts ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_label_yellows ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_label_reds ); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php foreach ( $football_factory_per_season as $football_factory_season ) : ?>
						<?php
						if ( ! is_array( $football_factory_season ) ) {
							continue;
						}
						$football_factory_season_name = isset( $football_factory_season['season'] )
							? (string) $football_factory_season['season']
							: '';
						?>
						<tr>
							<th scope="row"><?php echo esc_html( $football_factory_season_name ); ?></th>
							<td><?php echo (int) ( $football_factory_season['apps'] ?? 0 ); ?></td>
							<td><?php echo (int) ( $football_factory_season['goals'] ?? 0 ); ?></td>
							<td><?php echo (int) ( $football_factory_season['assists'] ?? 0 ); ?></td>
							<td><?php echo (int) ( $football_factory_season['yellows'] ?? 0 ); ?></td>
							<td><?php echo (int) ( $football_factory_season['reds'] ?? 0 ); ?></td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>
		<?php endif; ?>
	<?php endif; ?>
</section>

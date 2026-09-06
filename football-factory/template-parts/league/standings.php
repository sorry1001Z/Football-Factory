<?php
/**
 * Template Part: Standings (TP-022)
 *
 * League table with rank, team, played, won, drawn, lost, GF, GA, GD, points.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $rows Array of StandingsRowViewModel {
 *         Each: { rank, team, team_code, played, won, drawn, lost, gf, ga, gd, points, zone?, form? }
 *     }
 *     @type string $title Section title.
 *     @type string $url   "View full" link URL.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_rows  = isset( $args['rows'] ) && is_array( $args['rows'] ) ? $args['rows'] : array();
$football_factory_title = isset( $args['title'] ) ? (string) $args['title'] : __( 'ตารางคะแนน', 'football-factory' );
$football_factory_url   = isset( $args['url'] ) ? (string) $args['url'] : '';

$football_factory_label_empty = __( 'ยังไม่มีข้อมูลตารางคะแนน', 'football-factory' );

$football_factory_head = array(
	'rank'   => '#',
	'team'   => __( 'ทีม', 'football-factory' ),
	'played' => __( 'แข่ง', 'football-factory' ),
	'won'    => __( 'ชนะ', 'football-factory' ),
	'drawn'  => __( 'เสมอ', 'football-factory' ),
	'lost'   => __( 'แพ้', 'football-factory' ),
	'gf'     => __( 'ได้', 'football-factory' ),
	'ga'     => __( 'เสีย', 'football-factory' ),
	'gd'     => 'GD',
	'points' => __( 'แต้ม', 'football-factory' ),
	'form'   => __( 'ฟอร์ม', 'football-factory' ),
);
?>
<section
	class="ff-standings" aria-label="
	<?php echo esc_attr( $football_factory_title ); ?>
	" data-tp="league/standings" data-demo="true"
>
	<div class="ff-section-head">
		<h2 class="ff-section-title"><?php echo esc_html( $football_factory_title ); ?></h2>
		<?php if ( '' !== $football_factory_url ) : ?>
			<a
				class="ff-section-link" href="
				<?php echo esc_url( $football_factory_url ); ?>
				"
			>
		<?php endif; ?>
	</div>
	<?php if ( empty( $football_factory_rows ) ) : ?>
		<p class="ff-standings__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<div class="ff-standings__table-wrap" style="overflow-x:auto">
			<table class="ff-standings__table" style="min-width:600px">
				<thead>
					<tr>
						<th scope="col"><?php echo esc_html( $football_factory_head['rank'] ); ?></th>
						<th
							scope="col" class="ff-standings__team-col"
						>
						<th scope="col"><?php echo esc_html( $football_factory_head['played'] ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_head['won'] ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_head['drawn'] ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_head['lost'] ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_head['gf'] ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_head['ga'] ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_head['gd'] ); ?></th>
						<th
							scope="col"
						>
						<th
							scope="col" class="ff-standings__form-col"
						>
					</tr>
				</thead>
				<tbody>
					<?php foreach ( $football_factory_rows as $football_factory_row ) : ?>
						<?php
						if ( ! is_array( $football_factory_row ) ) {
							continue;
						}
						$football_factory_row_rank   = isset( $football_factory_row['rank'] )
							? (int) $football_factory_row['rank']
							: 0;
						$football_factory_row_team   = isset( $football_factory_row['team'] )
							? (string) $football_factory_row['team']
							: '';
						$football_factory_row_code   = isset( $football_factory_row['team_code'] )
							? (string) $football_factory_row['team_code']
							: '';
						$football_factory_row_played = isset( $football_factory_row['played'] )
							? (int) $football_factory_row['played']
							: 0;
						$football_factory_row_won    = isset( $football_factory_row['won'] )
							? (int) $football_factory_row['won']
							: 0;
						$football_factory_row_drawn  = isset( $football_factory_row['drawn'] )
							? (int) $football_factory_row['drawn']
							: 0;
						$football_factory_row_lost   = isset( $football_factory_row['lost'] )
							? (int) $football_factory_row['lost']
							: 0;
						$football_factory_row_gf     = isset( $football_factory_row['gf'] )
							? (int) $football_factory_row['gf']
							: 0;
						$football_factory_row_ga     = isset( $football_factory_row['ga'] )
							? (int) $football_factory_row['ga']
							: 0;
						$football_factory_row_gd     = isset( $football_factory_row['gd'] )
							? (int) $football_factory_row['gd']
							: ( $football_factory_row_gf - $football_factory_row_ga );
						$football_factory_row_pts    = isset( $football_factory_row['points'] )
							? (int) $football_factory_row['points']
							: 0;
						$football_factory_row_zone   = isset( $football_factory_row['zone'] )
							? (string) $football_factory_row['zone']
							: '';
						$football_factory_row_form   =
							isset( $football_factory_row['form'] )
							&& is_array( $football_factory_row['form'] )
							? $football_factory_row['form']
							: array();
						$football_factory_row_url    = isset( $football_factory_row['url'] )
							? (string) $football_factory_row['url']
							: '';
						if ( '' === $football_factory_row_team ) {
							continue;
						}
						$football_factory_zone_class = '' !== $football_factory_row_zone
							? ' is-' . sanitize_html_class( $football_factory_row_zone )
							: '';
						?>
						<tr
							class="ff-standings__row
							<?php echo esc_attr( $football_factory_zone_class ); ?>
							" data-rank="
							<?php echo (int) $football_factory_row_rank; ?>
							" data-team="
							<?php echo esc_attr( $football_factory_row_code ); ?>
							"
						>
							<th scope="row"><?php echo (int) $football_factory_row_rank; ?></th>
							<td class="ff-standings__team-col">
								<a
								>
									<?php if ( '' !== $football_factory_row_code ) : ?>
										<span
											class="ff-standings__crest" data-crest="
											<?php echo esc_attr( $football_factory_row_code ); ?>
											" data-size="18" aria-hidden="true"
										>
									<?php endif; ?>
									<span
										class="ff-standings__team-name"
									>
								</a>
							</td>
							<td><?php echo (int) $football_factory_row_played; ?></td>
							<td><?php echo (int) $football_factory_row_won; ?></td>
							<td><?php echo (int) $football_factory_row_drawn; ?></td>
							<td><?php echo (int) $football_factory_row_lost; ?></td>
							<td><?php echo (int) $football_factory_row_gf; ?></td>
							<td><?php echo (int) $football_factory_row_ga; ?></td>
							<td
							>
							<td><strong><?php echo (int) $football_factory_row_pts; ?></strong></td>
							<td class="ff-standings__form-col">
								<?php if ( ! empty( $football_factory_row_form ) ) : ?>
									<?php
									$football_factory_arg_form = $football_factory_row_form;
									$football_factory_arg_size = 'sm';
									include __DIR__ . '/../match/form.php';
									?>
								<?php endif; ?>
							</td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>
		</div>
	<?php endif; ?>
</section>

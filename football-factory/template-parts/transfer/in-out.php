<?php
/**
 * Template Part: Transfer In/Out (TP-036)
 *
 * In/Out totals per club, rendered as a table.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $rows Array of ClubTransferTotalsViewModel {
 *         Each: { club, club_code, in_count, out_count, net_spend, palette? }
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

$football_factory_rows  = isset( $args['rows'] ) && is_array( $args['rows'] ) ? $args['rows'] : array();
$football_factory_title = isset( $args['title'] )
	? (string) $args['title']
	: __( 'ซื้อ-ขาย เข้า-ออก', 'football-factory' );

$football_factory_label_empty = __( 'ยังไม่มีข้อมูลการซื้อขาย', 'football-factory' );
$football_factory_label_club  = __( 'สโมสร', 'football-factory' );
$football_factory_label_in    = __( 'เข้า', 'football-factory' );
$football_factory_label_out   = __( 'ออก', 'football-factory' );
$football_factory_label_net   = __( 'สุทธิ', 'football-factory' );
?>
<section
	class="ff-standings ff-transfer-in-out" aria-label="
	<?php echo esc_attr( $football_factory_title ); ?>
	" data-tp="transfer/in-out" data-demo="true"
>
	<h3 class="ff-section-title"><?php echo esc_html( $football_factory_title ); ?></h3>
	<?php if ( empty( $football_factory_rows ) ) : ?>
		<p class="ff-standings__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<div style="overflow-x:auto">
			<table class="ff-standings__table" style="min-width:480px">
				<thead>
					<tr>
						<th scope="col">#</th>
						<th scope="col"><?php echo esc_html( $football_factory_label_club ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_label_in ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_label_out ); ?></th>
						<th scope="col"><?php echo esc_html( $football_factory_label_net ); ?></th>
					</tr>
				</thead>
				<tbody>
					<?php
					$football_factory_i = 0;
					foreach ( $football_factory_rows as $football_factory_row ) :
						if ( ! is_array( $football_factory_row ) ) {
							continue;
						}
						++$football_factory_i;
						$football_factory_row_club = isset( $football_factory_row['club'] )
							? (string) $football_factory_row['club']
							: '';
						$football_factory_row_code = isset( $football_factory_row['club_code'] )
							? (string) $football_factory_row['club_code']
							: '';
						$football_factory_row_in   = isset( $football_factory_row['in_count'] )
							? (int) $football_factory_row['in_count']
							: 0;
						$football_factory_row_out  = isset( $football_factory_row['out_count'] )
							? (int) $football_factory_row['out_count']
							: 0;
						$football_factory_row_net  = isset( $football_factory_row['net_spend'] )
							? (string) $football_factory_row['net_spend']
							: '';
						$football_factory_row_url  = isset( $football_factory_row['url'] )
							? (string) $football_factory_row['url']
							: '';
						?>
						<tr>
							<th scope="row"><?php echo (int) $football_factory_i; ?></th>
							<td>
								<a
								>
									<?php if ( '' !== $football_factory_row_code ) : ?>
										<span
											class="ff-standings__crest" data-crest="
											<?php echo esc_attr( $football_factory_row_code ); ?>
											" data-size="18" aria-hidden="true"
										>
									<?php endif; ?>
									<span><?php echo esc_html( $football_factory_row_club ); ?></span>
								</a>
							</td>
							<td><?php echo (int) $football_factory_row_in; ?></td>
							<td><?php echo (int) $football_factory_row_out; ?></td>
							<td><strong><?php echo esc_html( $football_factory_row_net ); ?></strong></td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>
		</div>
	<?php endif; ?>
</section>

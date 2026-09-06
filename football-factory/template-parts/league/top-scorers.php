<?php
/**
 * Template Part: Top Scorers (TP-023)
 *
 * Top scorers list with player names, teams, and goal counts.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $scorers Array of ScorerViewModel {
 *         Each: { rank, name, name_th?, team, team_code, goals, assists?, apps? }
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

$football_factory_scorers = isset( $args['scorers'] ) && is_array( $args['scorers'] ) ? $args['scorers'] : array();
$football_factory_title   = isset( $args['title'] ) ? (string) $args['title'] : __( 'ดาวซัลโว', 'football-factory' );

$football_factory_label_empty = __( 'ยังไม่มีข้อมูล', 'football-factory' );
$football_factory_label_rank  = __( 'อันดับ', 'football-factory' );
$football_factory_label_goals = __( 'ประตู', 'football-factory' );
$football_factory_label_apps  = __( 'นัด', 'football-factory' );
$football_factory_label_asts  = __( 'แอสซิสต์', 'football-factory' );
?>
<section
	class="ff-top-scorers" aria-label="
	<?php echo esc_attr( $football_factory_title ); ?>
	" data-tp="league/top-scorers" data-demo="true"
>
	<h3 class="ff-section-title"><?php echo esc_html( $football_factory_title ); ?></h3>
	<?php if ( empty( $football_factory_scorers ) ) : ?>
		<p class="ff-top-scorers__empty"><?php echo esc_html( $football_factory_label_empty ); ?></p>
	<?php else : ?>
		<ol class="ff-top-scorers__list">
			<?php foreach ( $football_factory_scorers as $football_factory_scorer ) : ?>
				<?php
				if ( ! is_array( $football_factory_scorer ) ) {
					continue;
				}
				$football_factory_scorer_rank   = isset( $football_factory_scorer['rank'] )
					? (int) $football_factory_scorer['rank']
					: 0;
				$football_factory_scorer_name   = isset( $football_factory_scorer['name'] )
					? (string) $football_factory_scorer['name']
					: '';
				$football_factory_scorer_name_t = isset( $football_factory_scorer['name_th'] )
					? (string) $football_factory_scorer['name_th']
					: '';
				$football_factory_scorer_team   = isset( $football_factory_scorer['team'] )
					? (string) $football_factory_scorer['team']
					: '';
				$football_factory_scorer_code   = isset( $football_factory_scorer['team_code'] )
					? (string) $football_factory_scorer['team_code']
					: '';
				$football_factory_scorer_goals  = isset( $football_factory_scorer['goals'] )
					? (int) $football_factory_scorer['goals']
					: 0;
				$football_factory_scorer_asts   = isset( $football_factory_scorer['assists'] )
					? (int) $football_factory_scorer['assists']
					: 0;
				$football_factory_scorer_apps   = isset( $football_factory_scorer['apps'] )
					? (int) $football_factory_scorer['apps']
					: 0;
				if ( '' === $football_factory_scorer_name && '' === $football_factory_scorer_name_t ) {
					continue;
				}
				?>
				<li class="ff-stat ff-top-scorers__item">
					<span
						class="ff-stat__rank" aria-label="
						<?php echo esc_attr( $football_factory_label_rank ); ?>
						"
					>
					<div class="ff-stat__main">
						<span
							class="ff-stat__value"
						>
						<span class="ff-stat__label">
							<?php if ( '' !== $football_factory_scorer_code ) : ?>
								<span
									class="ff-standings__crest" data-crest="
									<?php echo esc_attr( $football_factory_scorer_code ); ?>
									" data-size="14" aria-hidden="true"
								>
							<?php endif; ?>
							<?php echo esc_html( $football_factory_scorer_team ); ?>
						</span>
					</div>
					<div class="ff-stat__numbers">
						<?php if ( $football_factory_scorer_goals > 0 ) : ?>
							<span
								class="ff-stat__goals" aria-label="
								<?php echo esc_attr( $football_factory_label_goals ); ?>
								"
							>
						<?php endif; ?>
						<?php if ( $football_factory_scorer_asts > 0 ) : ?>
							<span
								class="ff-stat__ast" aria-label="
								<?php echo esc_attr( $football_factory_label_asts ); ?>
								"
							>
						<?php endif; ?>
						<?php if ( $football_factory_scorer_apps > 0 ) : ?>
							<span
								class="ff-stat__apps" aria-label="
								<?php echo esc_attr( $football_factory_label_apps ); ?>
								"
							>
						<?php endif; ?>
					</div>
				</li>
			<?php endforeach; ?>
		</ol>
	<?php endif; ?>
</section>

<?php
/**
 * The footer for our theme — production implementation.
 *
 * Phase 6C production footer:
 *   - Mega-section grid (brand, categories, leagues, about, language)
 *   - Social placeholders (Facebook, Twitter, Instagram, YouTube)
 *   - Legal area (privacy, terms, cookies, accessibility statement)
 *   - Back-to-top architecture (data-ff-back-to-top)
 *   - Copyright with year and site name (auto-localized)
 *   - Footer widget areas (the 4-column grid slots each accept
 *     a registered widget area; in Phase 6C the widget areas
 *     themselves are reserved for Phase 6D)
 *   - Language placeholder
 *   - Accessibility links
 *
 * The footer is design-locked to the approved Enterprise Frontend
 * v1.0 visual baseline.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );
?>
	</main><!-- #main -->

	<?php
	/**
	 * Back-to-top floating button.
	 *
	 * Hidden by default via CSS (`.ff-back-to-top { display: none }`).
	 * Revealed by the JS runtime when the user scrolls past
	 * `data-ff-back-to-top-show-at` (default: 600px). The button
	 * scrolls smoothly back to the top, respecting
	 * `prefers-reduced-motion`.
	 */
	?>
	<button
		class="ff-back-to-top"
		type="button"
		data-ff-back-to-top
		data-ff-back-to-top-show-at="600"
		aria-label="<?php esc_attr_e( 'Back to top', 'football-factory' ); ?>"
	>
		<svg width="20" height="20" aria-hidden="true" focusable="false"><use href="#i-arrow-up"/></svg>
	</button>

	<footer id="colophon" class="ff-footer" role="contentinfo">

		<?php
		/**
		 * Footer widget area strip.
		 *
		 * Renders the registered `footer-1`, `footer-2`, `footer-3`,
		 * `footer-4` widget areas in a 4-column grid. Each is
		 * optional; if a widget area is empty, its column is
		 * hidden via CSS (`.ff-footer__col:empty { display: none }`).
		 */
		$football_factory_footer_widgets = array( 'footer-1', 'footer-2', 'footer-3', 'footer-4' );
		$football_factory_has_widgets    = false;
		foreach ( $football_factory_footer_widgets as $football_factory_widget_id ) {
			if ( is_active_sidebar( $football_factory_widget_id ) ) {
				$football_factory_has_widgets = true;
				break;
			}
		}
		if ( $football_factory_has_widgets ) :
			?>
			<div class="ff-footer__widgets" aria-label="<?php esc_attr_e( 'Footer widgets', 'football-factory' ); ?>">
				<div class="ff-container">
					<div class="ff-footer__widgets-grid">
						<?php foreach ( $football_factory_footer_widgets as $football_factory_widget_id ) : ?>
							<div class="ff-footer__col">
								<?php dynamic_sidebar( $football_factory_widget_id ); ?>
							</div>
						<?php endforeach; ?>
					</div>
				</div>
			</div>
		<?php endif; ?>

		<?php
		/**
		 * Mega-section grid (5 columns: brand, categories, leagues,
		 * about, language). Each column is a list of links rendered
		 * from the corresponding menu location. If no menu is
		 * assigned, a curated fallback list is rendered so the
		 * footer is never empty.
		 */
		$football_factory_brand_name_footer = (string) get_bloginfo( 'name' );
		$football_factory_brand_tagline     = (string) get_bloginfo( 'description', 'display' );
		?>
		<div class="ff-container">
			<div class="ff-footer__grid">

				<?php
				/**
				 * Column 1 — Brand.
				 * Logo + tagline + social placeholders.
				 */
				$football_factory_footer_home_label = __( 'Home', 'football-factory' );
				$football_factory_footer_brand_aria = sprintf(
					'%s — %s',
					$football_factory_brand_name_footer,
					$football_factory_footer_home_label
				);
				$football_factory_social_fb         = __( 'Facebook', 'football-factory' );
				$football_factory_social_tw         = __( 'Twitter', 'football-factory' );
				$football_factory_social_ig         = __( 'Instagram', 'football-factory' );
				$football_factory_social_yt         = __( 'YouTube', 'football-factory' );
				$football_factory_social_lbl        = __( 'Social media', 'football-factory' );
				?>
				<div class="ff-footer__brand-col">
					<a
						class="ff-logo ff-logo--invert"
						href="<?php echo esc_url( home_url( '/' ) ); ?>"
						rel="home"
						aria-label="<?php echo esc_attr( $football_factory_footer_brand_aria ); ?>"
					>
						<span class="ff-logo__mark" aria-hidden="true">F</span>
						<span class="ff-logo__text">
							<strong><?php echo esc_html( $football_factory_brand_name_footer ); ?></strong>
							<?php if ( '' !== $football_factory_brand_tagline ) : ?>
								<small><?php echo esc_html( $football_factory_brand_tagline ); ?></small>
							<?php endif; ?>
						</span>
					</a>
					<?php
					/**
					 * Tagline paragraph. The brief explicitly says
					 * "no business data" so the tagline is the
					 * site tagline from `get_bloginfo()` — which
					 * is whatever the user entered in
					 * Settings → General.
					 */
					?>
					<?php if ( '' !== $football_factory_brand_tagline ) : ?>
						<p class="ff-footer__tagline">
							<?php echo esc_html( $football_factory_brand_tagline ); ?>
						</p>
					<?php endif; ?>

					<div
						class="ff-footer__socials"
						role="list"
						aria-label="<?php echo esc_attr( $football_factory_social_lbl ); ?>"
					>
						<?php
						$football_factory_socials = array(
							0 => array(
								'label' => $football_factory_social_fb,
								'icon'  => 'i-fb',
							),
							1 => array(
								'label' => $football_factory_social_tw,
								'icon'  => 'i-twitter',
							),
							2 => array(
								'label' => $football_factory_social_ig,
								'icon'  => 'i-ig',
							),
							3 => array(
								'label' => $football_factory_social_yt,
								'icon'  => 'i-yt',
							),
						);
						foreach ( $football_factory_socials as $football_factory_social ) {
							$football_factory_social_label = $football_factory_social['label'];
							$football_factory_social_icon  = $football_factory_social['icon'];
							?>
							<a
								class="ff-footer__social"
								role="listitem"
								href="#"
								data-ff-tap-stop
								aria-label="<?php echo esc_attr( $football_factory_social_label ); ?>"
							>
								<svg width="16" height="16" aria-hidden="true" focusable="false">
									<use href="#<?php echo esc_attr( $football_factory_social_icon ); ?>"/>
								</svg>
							</a>
							<?php
						}
						?>
					</div>
				</div>

				<?php
				/**
				 * Column 2 — Categories.
				 * Renders the `footer` menu location, or a curated
				 * fallback list of category-style links.
				 */
				?>
				<div class="ff-footer__col">
					<h2 class="ff-footer__heading"><?php esc_html_e( 'Categories', 'football-factory' ); ?></h2>
					<?php
					if ( has_nav_menu( 'footer' ) ) {
						wp_nav_menu(
							array(
								'theme_location' => 'footer',
								'container'      => false,
								'menu_class'     => 'ff-footer__list',
								'depth'          => 1,
								'fallback_cb'    => false,
							)
						);
					} else {
						$football_factory_footer_categories = array(
							__( 'All news', 'football-factory' ),
							__( 'Live scores', 'football-factory' ),
							__( 'Match previews', 'football-factory' ),
							__( 'Match reports', 'football-factory' ),
							__( 'Transfers', 'football-factory' ),
						);
						?>
						<ul class="ff-footer__list" role="list">
							<?php foreach ( $football_factory_footer_categories as $football_factory_footer_item ) : ?>
								<?php
								printf(
									'<li><a href="#" data-ff-tap-stop>%s</a></li>',
									esc_html( $football_factory_footer_item )
								);
								?>
							<?php endforeach; ?>
						</ul>
						<?php
					}
					?>
				</div>

				<?php
				/**
				 * Column 3 — Leagues.
				 * Static curated list of the 5 major leagues.
				 * This is the only "content" surface in the footer
				 * and it is intentionally non-dynamic (Phase 6C
				 * is about the shell, not the data layer).
				 */
				?>
				<div class="ff-footer__col">
					<h2 class="ff-footer__heading"><?php esc_html_e( 'Leagues', 'football-factory' ); ?></h2>
					<ul class="ff-footer__list" role="list">
						<?php
						$football_factory_footer_leagues = array(
							__( 'Premier League', 'football-factory' ),
							__( 'La Liga', 'football-factory' ),
							__( 'Serie A', 'football-factory' ),
							__( 'Bundesliga', 'football-factory' ),
							__( 'Ligue 1', 'football-factory' ),
						);
						foreach ( $football_factory_footer_leagues as $football_factory_league_item ) {
							printf(
								'<li><a href="#" data-ff-tap-stop>%s</a></li>',
								esc_html( $football_factory_league_item )
							);
						}
						?>
					</ul>
				</div>

				<?php
				/**
				 * Column 4 — About.
				 * Standard organization links. Each is a placeholder
				 * (`#`) with `data-ff-tap-stop` so future phases can
				 * hook the click to a toast or route to a real page.
				 */
				?>
				<div class="ff-footer__col">
					<h2 class="ff-footer__heading"><?php esc_html_e( 'About', 'football-factory' ); ?></h2>
					<ul class="ff-footer__list" role="list">
						<?php
						$football_factory_footer_about = array(
							__( 'About us', 'football-factory' ),
							__( 'Contact', 'football-factory' ),
							__( 'Privacy policy', 'football-factory' ),
							__( 'Terms of use', 'football-factory' ),
							__( 'FAQ', 'football-factory' ),
						);
						foreach ( $football_factory_footer_about as $football_factory_about_item ) {
							printf(
								'<li><a href="#" data-ff-tap-stop>%s</a></li>',
								esc_html( $football_factory_about_item )
							);
						}
						?>
					</ul>
				</div>

				<?php
				/**
				 * Column 5 — Language & accessibility.
				 * The language switcher is a placeholder; the
				 * accessibility statement link is real (WordPress
				 * doesn't generate one automatically, so this is a
				 * page that the site owner should create in a later
				 * phase; in Phase 6C the link points to #).
				 */
				?>
				<div class="ff-footer__col">
					<h2 class="ff-footer__heading"><?php esc_html_e( 'Language', 'football-factory' ); ?></h2>
					<?php
					$football_factory_footer_langs = array(
						array(
							'label'   => __( 'ภาษาไทย (Thai)', 'football-factory' ),
							'current' => true,
						),
						array(
							'label'   => __( 'English', 'football-factory' ),
							'current' => false,
						),
					);
					?>
					<ul class="ff-footer__list" role="list">
						<?php foreach ( $football_factory_footer_langs as $football_factory_lang_item ) : ?>
							<?php
							$football_factory_lang_label   = $football_factory_lang_item['label'];
							$football_factory_lang_current = $football_factory_lang_item['current'] ? 'true' : 'false';
							?>
							<li>
								<a
									href="#"
									data-ff-tap-stop
									aria-current="<?php echo esc_attr( $football_factory_lang_current ); ?>"
									<?php echo 'true' === $football_factory_lang_current ? 'class="is-current"' : ''; ?>
								>
									<?php echo esc_html( $football_factory_lang_label ); ?>
								</a>
							</li>
						<?php endforeach; ?>
					</ul>

					<h2 class="ff-footer__heading"><?php esc_html_e( 'Accessibility', 'football-factory' ); ?></h2>
					<?php
					$football_factory_skip_target = (string) apply_filters(
						'football_factory_skip_link_target',
						'main-content'
					);
					$football_factory_a11y_label  = __( 'Accessibility statement', 'football-factory' );
					$football_factory_skip_label  = __( 'Skip to content', 'football-factory' );
					?>
					<ul class="ff-footer__list" role="list">
						<?php
						printf(
							'<li><a href="#" data-ff-tap-stop>%s</a></li>',
							esc_html( $football_factory_a11y_label )
						);
						printf(
							'<li><a href="#%s">%s</a></li>',
							esc_attr( $football_factory_skip_target ),
							esc_html( $football_factory_skip_label )
						);
						?>
					</ul>
				</div>
			</div>

			<?php
			/**
			 * Bottom bar — copyright + legal.
			 *
			 * The copyright is auto-localized via `wp_date()` so the
			 * year updates itself every January 1. The site name
			 * is whatever the user configured in Settings → General.
			 *
			 * "Built with care" line is a static placeholder; the
			 * brief explicitly says "no business data" so this
			 * line is not personalized or data-driven.
			 */
			$football_factory_current_year_footer = (string) wp_date( 'Y' );
			$football_factory_site_name_footer    = (string) get_bloginfo( 'name' );
			$football_factory_footer_copyright    = sprintf(
				/* translators: 1: current year, 2: site name. */
				__( '© %1$s %2$s. All rights reserved.', 'football-factory' ),
				$football_factory_current_year_footer,
				$football_factory_site_name_footer
			);
			?>
			<div class="ff-footer__bottom">
				<span class="ff-footer__copy"><?php echo esc_html( $football_factory_footer_copyright ); ?></span>
				<?php $football_factory_built_text = __( 'Built with care for football fans.', 'football-factory' ); ?>
				<span class="ff-footer__built"><?php echo esc_html( $football_factory_built_text ); ?></span>
			</div>
		</div>
	</footer>
</div><!-- #page -->

<?php
/**
 * Mobile bottom navigation.
 *
 * Visible only at viewports < 1024px via CSS. Renders 5 items
 * (Home, Matches, News, Transfers, Menu) drawn from the
 * `bottom-mobile` menu location, with a curated fallback.
 *
 * The "Menu" item opens the same drawer as the top-bar trigger.
 */
?>
<nav class="ff-bottom-nav" aria-label="<?php esc_attr_e( 'Mobile bottom navigation', 'football-factory' ); ?>">
	<?php
	if ( has_nav_menu( 'bottom-mobile' ) ) {
		wp_nav_menu(
			array(
				'theme_location' => 'bottom-mobile',
				'container'      => false,
				'menu_class'     => 'ff-bottom-nav__list',
				'depth'          => 1,
				'fallback_cb'    => false,
				'link_class'     => 'ff-bottom-nav__item',
			)
		);
	} else {
		?>
		<ul class="ff-bottom-nav__list" role="list">
			<li>
				<a class="ff-bottom-nav__item" href="<?php echo esc_url( home_url( '/' ) ); ?>" data-nav>
					<svg width="22" height="22" aria-hidden="true" focusable="false"><use href="#i-home"/></svg>
					<span><?php esc_html_e( 'Home', 'football-factory' ); ?></span>
				</a>
			</li>
			<li>
				<a class="ff-bottom-nav__item" href="#" data-ff-tap-stop>
					<svg width="22" height="22" aria-hidden="true" focusable="false"><use href="#i-pitch"/></svg>
					<span><?php esc_html_e( 'Matches', 'football-factory' ); ?></span>
				</a>
			</li>
			<li>
				<a class="ff-bottom-nav__item" href="#" data-ff-tap-stop>
					<svg width="22" height="22" aria-hidden="true" focusable="false"><use href="#i-news"/></svg>
					<span><?php esc_html_e( 'News', 'football-factory' ); ?></span>
				</a>
			</li>
			<li>
				<a class="ff-bottom-nav__item" href="#" data-ff-tap-stop>
					<svg width="22" height="22" aria-hidden="true" focusable="false"><use href="#i-shuffle"/></svg>
					<span><?php esc_html_e( 'Transfers', 'football-factory' ); ?></span>
				</a>
			</li>
			<li>
				<button
					class="ff-bottom-nav__item ff-bottom-nav__menu"
					type="button"
					data-ff-drawer-open
					aria-controls="ff-drawer"
					aria-label="<?php esc_attr_e( 'Open menu', 'football-factory' ); ?>"
				>
					<svg width="22" height="22" aria-hidden="true" focusable="false"><use href="#i-grid"/></svg>
					<span><?php esc_html_e( 'Menu', 'football-factory' ); ?></span>
				</button>
			</li>
		</ul>
		<?php
	}
	?>
</nav>

<?php wp_footer(); ?>
</body>
</html>

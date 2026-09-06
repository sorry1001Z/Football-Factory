<?php
/**
 * The header for our theme — production implementation.
 *
 * Phase 6C production header:
 *   - Top utility bar (language, theme toggle, search trigger, login)
 *   - Primary header (logo, primary nav, drawer trigger, action cluster)
 *   - Mobile drawer (dialog, focus trap, escape, reduced motion)
 *   - Skip links (multi-target)
 *   - Sticky behavior architecture (data-ff-sticky)
 *   - ARIA landmarks (banner / navigation)
 *   - Current-page highlighting (data-ff-current="true" on the matching link)
 *   - No football data, no API, no dynamic content beyond standard WordPress menus.
 *
 * The header is design-locked to the approved Enterprise Frontend v1.0
 * visual baseline (see /workspace/football-factory-enterprise-frontend-v1.0).
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

// Resolve the main landmark id used by the skip link. Filterable for template alignment.
$football_factory_skip_target = (string) apply_filters( 'football_factory_skip_link_target', 'main-content' );

// Theme name (used in branding). Falls back to site title.
$football_factory_brand_name    = (string) get_bloginfo( 'name' );
$football_factory_brand_tagline = (string) get_bloginfo( 'description', 'display' );

// Current URL (used to mark the active nav item).
$football_factory_current_url = (string) home_url( add_query_arg( null, null ) );
$football_factory_home_url    = (string) home_url( '/' );

// Body class hook for bottom-nav layout.
add_filter(
	'body_class',
	static function ( array $classes ): array {
		$classes[] = 'ff-has-bottom-nav';
		return $classes;
	}
);
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<meta name="theme-color" content="#0B5D34">
	<link rel="profile" href="https://gmpg.org/xfn/11">
	<?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<?php
/**
 * Inline pre-paint theme bootstrap. Applies the user's stored theme
 * preference (light/dark/system) BEFORE the first paint to avoid the
 * "flash of wrong theme". This is a tiny critical CSS payload and
 * is the only inline CSS we ship.
 */
?>
<script>
(function(){
	try {
		var key = 'ff-theme';
		var stored = localStorage.getItem(key);
		var theme = (stored === 'light' || stored === 'dark') ? stored
			: (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
		document.documentElement.setAttribute('data-theme', theme);
	} catch (e) { /* localStorage unavailable; default to light */ }
})();
</script>

<?php
/**
 * Skip link group.
 *
 * - Primary skip-to-content.
 * - Secondary skip-to-navigation (added in Phase 6C).
 * Each is filterable for template-specific overrides.
 */
?>
<a class="ff-skip" href="#<?php echo esc_attr( $football_factory_skip_target ); ?>">
	<?php esc_html_e( 'Skip to content', 'football-factory' ); ?>
</a>
<a class="ff-skip ff-skip--secondary" href="#site-navigation">
	<?php esc_html_e( 'Skip to navigation', 'football-factory' ); ?>
</a>

<?php
/**
 * Inline SVG icon sprite.
 * Inserted invisibly at the top of <body> so <use href="#i-...">
 * references resolve without an extra HTTP request.
 *
 * The sprite file is shipped as a static asset at
 * assets/icons/sprite.svg (see inc/class-assets.php for enqueueing).
 * The output here is a fallback: if the sprite script (theme.js) has
 * not yet hydrated, this inline <svg> keeps the icons visible.
 */
?>
<div id="ff-icons" aria-hidden="true" hidden>
	<?php
	$football_factory_sprite_path = FOOTBALL_FACTORY_ASSETS_DIR . 'icons/sprite.svg';
	if ( is_readable( $football_factory_sprite_path ) ) {
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- SVG sprite is local and trusted.
		echo file_get_contents( $football_factory_sprite_path );
	}
	?>
</div>

<div id="page" class="ff-site">

	<?php
	/**
	 * Top utility bar.
	 *
	 * Renders the language switcher placeholder, the date strip,
	 * and the right-aligned auth/help cluster. Hidden on small
	 * screens via the CSS layer (`.ff-topbar { display: none }`
	 * at viewports < 768px). The CSS handles this; we always
	 * render the markup.
	 */
	?>
	<div class="ff-topbar" role="region" aria-label="<?php esc_attr_e( 'Utility bar', 'football-factory' ); ?>">
		<div class="ff-container">
			<div class="ff-topbar__inner">
				<div class="ff-topbar__left">
					<span class="ff-topbar__date" aria-hidden="true">
						<?php echo esc_html( wp_date( 'l, F j, Y' ) ); ?>
					</span>
					<a class="ff-topbar__link" href="#" data-ff-tap-stop>
						<?php esc_html_e( 'ภาษาไทย', 'football-factory' ); ?>
					</a>
					<a class="ff-topbar__link" href="#" data-ff-tap-stop>
						<?php esc_html_e( 'EN', 'football-factory' ); ?>
					</a>
				</div>
				<div class="ff-topbar__right">
					<a class="ff-topbar__link" href="#" data-ff-tap-stop>
						<?php esc_html_e( 'ศูนย์ช่วยเหลือ', 'football-factory' ); ?>
					</a>
					<a class="ff-topbar__link" href="#" data-ff-tap-stop>
						<?php esc_html_e( 'ติดต่อเรา', 'football-factory' ); ?>
					</a>
				</div>
			</div>
		</div>
	</div>

	<?php
	/**
	 * Primary header.
	 *
	 * Sticky architecture: a `data-ff-sticky` attribute on the
	 * `<header>` is the hook for the future JS that toggles
	 * `is-stuck` after the user scrolls past the topbar. The
	 * current Phase 6C ships the data hook and the CSS scaffold
	 * for the sticky state; the runtime JS attaches in a
	 * later sub-phase.
	 */
	?>
	<header id="masthead" class="ff-header" role="banner" data-ff-sticky>
		<div class="ff-container">
			<div class="ff-header__inner">

				<?php
				/**
				 * Mobile drawer trigger.
				 *
				 * Visible only below the desktop breakpoint via CSS.
				 * `data-ff-drawer-open` is the JS hook used by
				 * assets/js/components/drawer.js (or a vanilla
				 * equivalent shipped in theme.js).
				 */
				?>
				<button
					class="ff-menu-toggle"
					type="button"
					data-ff-drawer-open
					aria-controls="ff-drawer"
					aria-expanded="false"
					aria-label="<?php esc_attr_e( 'Open menu', 'football-factory' ); ?>"
				>
					<svg width="24" height="24" aria-hidden="true" focusable="false"><use href="#i-menu"/></svg>
				</button>

				<?php
				/**
				 * Brand / logo.
				 *
				 * Two rendering paths:
				 *   1. has_custom_logo() — WordPress Custom Logo.
				 *   2. fallback — inline SVG mark + site title.
				 *
				 * In both cases the link is the home URL and the
				 * aria-label is the site name.
				 */
				$football_factory_home_label_home = __( 'Home', 'football-factory' );
				$football_factory_home_aria_label = sprintf(
					'%s — %s',
					$football_factory_brand_name,
					$football_factory_home_label_home
				);
				?>
				<a
					class="ff-logo"
					href="<?php echo esc_url( $football_factory_home_url ); ?>"
					rel="home"
					aria-label="<?php echo esc_attr( $football_factory_home_aria_label ); ?>"
				>
					<?php if ( has_custom_logo() ) : ?>
						<?php the_custom_logo(); ?>
					<?php else : ?>
						<span class="ff-logo__mark" aria-hidden="true">F</span>
						<span class="ff-logo__text">
							<strong><?php echo esc_html( $football_factory_brand_name ); ?></strong>
							<?php if ( '' !== $football_factory_brand_tagline ) : ?>
								<small><?php echo esc_html( $football_factory_brand_tagline ); ?></small>
							<?php endif; ?>
						</span>
					<?php endif; ?>
				</a>

				<?php
				/**
				 * Primary desktop navigation.
				 *
				 * The Theme's `primary` menu location is rendered
				 * with depth=2. If no menu is assigned, a minimal
				 * fallback list is rendered so the shell always
				 * has a navigable element.
				 *
				 * Current-page highlighting is implemented by the
				 * walker assigned in inc/class-navigation.php: each
				 * <a> gets a `data-ff-current="true"` attribute
				 * when its href matches the current URL.
				 */
				?>
				<nav
					id="site-navigation"
					class="ff-nav"
					role="navigation"
					data-ff-nav
					aria-label="<?php esc_attr_e( 'Primary', 'football-factory' ); ?>"
				>
					<?php
					if ( has_nav_menu( 'primary' ) ) {
						wp_nav_menu(
							array(
								'theme_location' => 'primary',
								'container'      => false,
								'menu_class'     => 'ff-nav__list',
								'depth'          => 2,
								'fallback_cb'    => false,
								'walker'         => new FootballFactory\Theme\Primary_Walker_Nav_Menu(),
							)
						);
					} else {
						?>
						<ul class="ff-nav__list" role="list">
							<li class="ff-nav__item">
								<a
									class="ff-nav__link"
									href="<?php echo esc_url( $football_factory_home_url ); ?>"
									data-nav
								>
									<?php esc_html_e( 'Home', 'football-factory' ); ?>
								</a>
							</li>
						</ul>
						<?php
					}
					?>
				</nav>

				<?php
				/**
				 * Header action cluster.
				 *
				 * Includes:
				 *   - Search trigger (data-ff-search-open)
				 *   - Theme toggle (data-ff-theme-toggle)
				 *   - Notifications placeholder (link to be enabled
				 *     once Phase 6D adds a notifications module)
				 *   - Sign-in CTA (link to wp-login.php on logout,
				 *     or to the account endpoint on auth)
				 *
				 * Each button is a real <button> with type="button"
				 * and an aria-label. SVGs are from the sprite.
				 */
				?>
				<div
					class="ff-header__actions"
					role="group"
					aria-label="<?php esc_attr_e( 'Header actions', 'football-factory' ); ?>"
				>
					<button
						class="ff-icon-btn"
						type="button"
						data-ff-search-open
						aria-label="<?php esc_attr_e( 'Search', 'football-factory' ); ?>"
					>
						<svg width="20" height="20" aria-hidden="true" focusable="false"><use href="#i-search"/></svg>
					</button>
					<button
						class="ff-icon-btn"
						type="button"
						data-ff-theme-toggle
						aria-pressed="false"
						aria-label="<?php esc_attr_e( 'Toggle dark mode', 'football-factory' ); ?>"
					>
						<span data-ff-theme-icon="light">
							<svg width="20" height="20" aria-hidden="true" focusable="false"><use href="#i-moon"/></svg>
						</span>
						<span data-ff-theme-icon="dark" style="display:none">
							<svg width="20" height="20" aria-hidden="true" focusable="false"><use href="#i-sun"/></svg>
						</span>
					</button>
					<button
						class="ff-icon-btn"
						type="button"
						data-ff-tap-stop
						aria-label="<?php esc_attr_e( 'Notifications', 'football-factory' ); ?>"
					>
						<svg width="20" height="20" aria-hidden="true" focusable="false"><use href="#i-bell"/></svg>
					</button>
					<?php
					$football_factory_signin_url = (string) wp_login_url( $football_factory_current_url );
					?>
					<a
						class="ff-btn ff-btn--primary ff-header__signin"
						href="<?php echo esc_url( $football_factory_signin_url ); ?>"
					>
						<?php esc_html_e( 'Sign in', 'football-factory' ); ?>
					</a>
				</div>
			</div>
		</div>
	</header>

	<?php
	/**
	 * Mobile drawer.
	 *
	 * Renders a dialog with the same `primary` menu and
	 * additional utility links. `aria-modal="true"`, focus
	 * is trapped while open, and the close button restores
	 * focus to the trigger. Escape closes the drawer.
	 *
	 * The JS hook is `data-ff-drawer` (the panel) and
	 * `data-ff-drawer-close` (any element that should close
	 * the drawer — backdrop, close button, or a nav link).
	 */
	?>
	<div
		class="ff-drawer"
		id="ff-drawer"
		role="dialog"
		aria-modal="true"
		aria-labelledby="ff-drawer-title"
		aria-hidden="true"
		data-ff-drawer
	>
		<div class="ff-drawer__backdrop" data-ff-drawer-close></div>
		<div class="ff-drawer__panel">
			<div class="ff-drawer__head">
				<a
					class="ff-logo"
					href="<?php echo esc_url( $football_factory_home_url ); ?>"
					rel="home"
					data-ff-drawer-close
				>
					<span class="ff-logo__mark" aria-hidden="true">F</span>
					<span class="ff-logo__text">
						<strong><?php echo esc_html( $football_factory_brand_name ); ?></strong>
					</span>
				</a>
				<h2 id="ff-drawer-title" class="ff-sr">
					<?php esc_html_e( 'Site navigation', 'football-factory' ); ?>
				</h2>
				<button
					class="ff-icon-btn"
					type="button"
					data-ff-drawer-close
					aria-label="<?php esc_attr_e( 'Close menu', 'football-factory' ); ?>"
				>
					<svg width="22" height="22" aria-hidden="true" focusable="false"><use href="#i-close"/></svg>
				</button>
			</div>
			<nav
				class="ff-drawer__nav"
				aria-label="<?php esc_attr_e( 'Mobile', 'football-factory' ); ?>"
			>
				<?php
				if ( has_nav_menu( 'mobile' ) ) {
					wp_nav_menu(
						array(
							'theme_location' => 'mobile',
							'container'      => false,
							'menu_class'     => 'ff-drawer__list',
							'depth'          => 2,
							'fallback_cb'    => false,
							'link_class'     => 'ff-drawer__link',
						)
					);
				} else {
					?>
					<ul class="ff-drawer__list" role="list">
						<li class="ff-drawer__item">
							<a
								class="ff-drawer__link"
								href="<?php echo esc_url( $football_factory_home_url ); ?>"
								data-nav
								data-ff-drawer-close
							>
								<?php esc_html_e( 'Home', 'football-factory' ); ?>
							</a>
						</li>
					</ul>
					<?php
				}
				?>
			</nav>
		</div>
	</div>

	<?php
	/**
	 * Search overlay.
	 *
	 * Hidden by default; opened by the search trigger. The
	 * overlay contains a form posting to the home URL with
	 * the `s` parameter (standard WordPress search).
	 */
	?>
	<div
		class="ff-search-overlay"
		id="ff-search-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="ff-search-title"
		aria-hidden="true"
		data-ff-search
	>
		<div class="ff-search-overlay__backdrop" data-ff-search-close></div>
		<div class="ff-search-overlay__panel">
			<h2 id="ff-search-title" class="ff-sr"><?php esc_html_e( 'Search', 'football-factory' ); ?></h2>
			<div class="ff-search-overlay__form">
				<?php
				// Render the search form via the standard filterable helper.
				// The form's role="search" is now in searchform.php.
				$football_factory_search_form_args = array(
					'echo'       => true,
					'aria_label' => __( 'Search', 'football-factory' ),
				);
				get_search_form( $football_factory_search_form_args );
				?>
				<button
					class="ff-icon-btn ff-search-overlay__close"
					type="button"
					data-ff-search-close
					aria-label="<?php esc_attr_e( 'Close search', 'football-factory' ); ?>"
				>
					<svg width="22" height="22" aria-hidden="true" focusable="false"><use href="#i-close"/></svg>
				</button>
			</div>
		</div>
	</div>

	<main id="<?php echo esc_attr( $football_factory_skip_target ); ?>" class="ff-main" role="main" tabindex="-1">

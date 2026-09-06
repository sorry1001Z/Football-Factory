<?php
/**
 * Template Part: Site Header (TP-001)
 *
 * Persistent site header with brand, primary navigation, theme toggle,
 * and notifications. The full visual equivalent of the rc2.1 header
 * block, server-rendered for progressive enhancement.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $brand Brand view-model.
 *     @type array<string, mixed> $nav   Primary navigation items.
 *     @type string               $theme Active theme state.
 *     @type array<string, mixed> $user  User/auth view-model.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_label_0 = __( 'บัญชี', 'football-factory' );
$football_factory_label_1 = __( 'เข้าสู่ระบบ', 'football-factory' );

$football_factory_brand = isset( $args['brand'] ) && is_array( $args['brand'] ) ? $args['brand'] : array();
$football_factory_nav   = isset( $args['nav'] ) && is_array( $args['nav'] ) ? $args['nav'] : array();
$football_factory_theme = isset( $args['theme'] ) ? (string) $args['theme'] : 'light';
$football_factory_user  = isset( $args['user'] ) && is_array( $args['user'] ) ? $args['user'] : array();

$football_factory_brand_name    = isset( $football_factory_brand['name'] )
	? (string) $football_factory_brand['name']
	: 'Football Factory';
$football_factory_brand_name_th = isset( $football_factory_brand['nameTh'] )
	? (string) $football_factory_brand['nameTh']
	: 'ฟุตบอล แฟคทอรี่';
$football_factory_brand_tagline = isset( $football_factory_brand['tagline'] )
	? (string) $football_factory_brand['tagline']
	: 'All about football';
$football_factory_is_logged_in  = isset( $football_factory_user['logged_in'] )
	? (bool) $football_factory_user['logged_in']
	: false;
$football_factory_lbl_0         = __( 'เปิดเมนู', 'football-factory' );
$football_factory_lbl_1         = __( 'เมนูหลัก', 'football-factory' );
$football_factory_lbl_2         = __( 'สลับธีม', 'football-factory' );
$football_factory_lbl_3         = __( 'การแจ้งเตือน', 'football-factory' );
?>
<header
	class="ff-header" role="banner" data-tp="header/site-header" data-theme="
	<?php echo esc_attr( $football_factory_theme ); ?>
	" data-demo="true"
>
	<div class="ff-container">
		<div class="ff-header__top">
			<button
				type="button" class="ff-menu-toggle" data-drawer-open aria-label="
				<?php echo esc_attr( $football_factory_lbl_0 ); ?>
				"
			>
				<svg width="24" height="24" aria-hidden="true"><use href="#i-menu"/></svg>
			</button>
			<a
				class="ff-logo" href="
				<?php echo esc_url( home_url( '/' ) ); ?>
				" aria-label="
				<?php echo esc_attr( $football_factory_brand_name . ' — ' . __( 'หน้าแรก', 'football-factory' ) ); ?>
				"
			>
				<span class="ff-logo__mark" aria-hidden="true">F</span>
				<span class="ff-logo__text">
					<strong>FOOTBALL<br/>FACTORY</strong>
					<small><?php echo esc_html( $football_factory_brand_tagline ); ?></small>
				</span>
			</a>
			<nav class="ff-nav" aria-label="<?php echo esc_attr( $football_factory_lbl_1 ); ?>">
				<?php foreach ( $football_factory_nav as $football_factory_item ) : ?>
					<?php
					if ( ! is_array( $football_factory_item ) ) {
						continue;
					}
					$football_factory_label  = isset( $football_factory_item['label'] )
						? (string) $football_factory_item['label']
						: '';
					$football_factory_url    = isset( $football_factory_item['url'] )
						? (string) $football_factory_item['url']
						: '#';
					$football_factory_active = isset( $football_factory_item['current'] )
						? (bool) $football_factory_item['current']
						: false;
					if ( '' === $football_factory_label ) {
						continue;
					}
					?>
					<a
						class="ff-nav__link<?php echo $football_factory_active ? ' is-active' : ''; ?>" href="
						<?php echo esc_url( $football_factory_url ); ?>
						" data-nav <?php echo $football_factory_active ? 'aria-current="page"' : ''; ?>
					>
						<?php echo esc_html( $football_factory_label ); ?>
					</a>
				<?php endforeach; ?>
			</nav>
			<div class="ff-header__actions">
				<button
					type="button" class="ff-icon-btn" data-theme-toggle aria-label="
					<?php echo esc_attr( $football_factory_lbl_2 ); ?>
					"
				>
					<span data-theme-icon="dark" style="display:none" aria-hidden="true">
						<svg width="20" height="20"><use href="#i-sun"/></svg>
					</span>
					<span data-theme-icon="light" aria-hidden="true">
						<svg width="20" height="20"><use href="#i-moon"/></svg>
					</span>
				</button>
				<button
					type="button" class="ff-icon-btn" aria-label="
					<?php echo esc_attr( $football_factory_lbl_3 ); ?>
					" style="position:relative"
				>
					<svg width="20" height="20" aria-hidden="true"><use href="#i-bell"/></svg>
					<span
						style="
							position:absolute;top:8px;
							right:8px;width:8px;height:8px;
							border-radius:50%;
							background:var(--ff-live-red)
						"
						aria-hidden="true"></span>
				</button>
				<?php if ( $football_factory_is_logged_in ) : ?>
					<a class="ff-btn ff-btn--ghost" href="<?php echo esc_url( home_url( '/account/' ) ); ?>">
						<?php echo esc_html( $football_factory_label_0 ); ?>
					</a>
				<?php else : ?>
					<a class="ff-btn ff-btn--primary" href="<?php echo esc_url( wp_login_url() ); ?>">
						<?php echo esc_html( $football_factory_label_1 ); ?>
					</a>
				<?php endif; ?>
			</div>
		</div>
	</div>
</header>

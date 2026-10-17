<?php
/** Shared accessible header. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?><!doctype html>
<html <?php language_attributes(); ?>>
<head><meta charset="<?php bloginfo( 'charset' ); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><?php wp_head(); ?></head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="skip-link screen-reader-text" href="#main-content"><?php esc_html_e( 'ข้ามไปยังเนื้อหา', 'ff90-independent' ); ?></a>
<div class="utility"><div class="container utility-inner"><span><?php echo esc_html( wp_date( 'D j M Y' ) ); ?> <span class="utility-divider">/</span> <?php esc_html_e( 'ทุกมุมของเกมฟุตบอล', 'ff90-independent' ); ?></span><button class="mode-toggle" type="button" aria-pressed="false" hidden><?php esc_html_e( 'โหมดมืด', 'ff90-independent' ); ?></button></div></div>
<header class="site-header"><div class="container masthead"><div class="identity">
<?php if ( has_custom_logo() ) { the_custom_logo(); } else { ?><a class="brand" href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>">FF<span>90</span><span class="brand-dot">.</span></a><?php } ?>
<p class="tagline"><?php echo esc_html( get_bloginfo( 'description' ) ); ?></p></div><div class="header-note"><span>FOOTBALL. STORIES. PERSPECTIVE.</span><strong><?php esc_html_e( 'อ่านเกมให้ขาด ทุกเรื่องฟุตบอล', 'ff90-independent' ); ?></strong></div></div>
<div class="nav-shell"><div class="container nav-inner"><button class="menu-toggle" type="button" aria-controls="primary-menu" aria-expanded="false" hidden><?php esc_html_e( 'เมนู', 'ff90-independent' ); ?> <span aria-hidden="true">☰</span></button>
<nav id="primary-menu" class="primary-nav" aria-label="<?php esc_attr_e( 'เมนูหลัก', 'ff90-independent' ); ?>"><?php wp_nav_menu( array( 'theme_location' => 'primary', 'container' => false, 'depth' => 2, 'fallback_cb' => 'ff90_fallback_menu' ) ); ?></nav><div class="header-search"><?php get_search_form(); ?></div></div></div>
</header>
<?php get_template_part( 'template-parts/breaking' ); ?>

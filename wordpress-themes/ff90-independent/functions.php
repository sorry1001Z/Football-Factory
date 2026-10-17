<?php
/** FF90 presentation bootstrap. @package ff90-independent */
if ( ! defined( 'ABSPATH' ) ) { exit; }
require get_template_directory() . '/inc/presentation.php';
add_action( 'after_setup_theme', function () {
    load_theme_textdomain( 'ff90-independent', get_template_directory() . '/languages' );
    add_theme_support( 'title-tag' );
    add_theme_support( 'automatic-feed-links' );
    add_theme_support( 'post-thumbnails' );
    add_theme_support( 'responsive-embeds' );
    add_theme_support( 'align-wide' );
    add_theme_support( 'wp-block-styles' );
    add_theme_support( 'custom-logo', array( 'height' => 80, 'width' => 240, 'flex-height' => true, 'flex-width' => true ) );
    add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ) );
    add_editor_style( 'assets/css/editor.css' );
    register_nav_menus( array( 'primary' => __( 'Primary navigation', 'ff90-independent' ), 'footer' => __( 'Footer navigation', 'ff90-independent' ) ) );
    $GLOBALS['content_width'] = 840;
} );
add_action( 'wp_enqueue_scripts', function () {
    $version = wp_get_theme()->get( 'Version' );
    wp_enqueue_style( 'ff90-independent', get_stylesheet_uri(), array(), $version );
    wp_enqueue_script( 'ff90-independent', get_template_directory_uri() . '/assets/js/theme.js', array(), $version, true );
    if ( is_singular() && comments_open() && get_option( 'thread_comments' ) ) { wp_enqueue_script( 'comment-reply' ); }
} );
add_action( 'widgets_init', function () {
    foreach ( array( 'sidebar' => __( 'News sidebar', 'ff90-independent' ), 'advertisement' => __( 'Advertisement', 'ff90-independent' ), 'footer' => __( 'Footer widgets', 'ff90-independent' ) ) as $id => $label ) {
        register_sidebar( array( 'name' => $label, 'id' => 'ff90-' . $id, 'before_widget' => '<section id="%1$s" class="widget %2$s">', 'after_widget' => '</section>', 'before_title' => '<h2 class="section-title">', 'after_title' => '</h2>' ) );
    }
} );
add_action( 'customize_register', function ( $customizer ) {
    $customizer->add_section( 'ff90_homepage', array( 'title' => __( 'FF90 Homepage Layout', 'ff90-independent' ), 'priority' => 30 ) );
    $customizer->add_setting( 'ff90_home_layout', array( 'default' => 'colormag-01', 'type' => 'theme_mod', 'capability' => 'edit_theme_options', 'sanitize_callback' => 'ff90_sanitize_layout', 'transport' => 'refresh' ) );
    $customizer->add_control( 'ff90_home_layout', array( 'section' => 'ff90_homepage', 'label' => __( 'Homepage layout', 'ff90-independent' ), 'type' => 'select', 'choices' => array( 'main-v2' => __( 'Layout A — Main V2', 'ff90-independent' ), 'colormag-01' => __( 'Layout B — ColorMag 01', 'ff90-independent' ) ) ) );
} );

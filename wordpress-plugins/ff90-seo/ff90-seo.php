<?php
/**
 * Plugin Name: FF90 Modular SEO
 * Description: Local SEO analysis, editor tools and optional standalone metadata. No external analysis service required.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * License: GPL-3.0-or-later
 * Text Domain: ff90-seo
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/includes/Policy.php';
require_once __DIR__ . '/includes/DomainAdapter.php';
require_once __DIR__ . '/includes/wordpress.php';

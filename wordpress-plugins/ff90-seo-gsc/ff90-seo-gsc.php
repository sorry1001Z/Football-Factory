<?php
/**
 * Plugin Name: FF90 SEO Search Console Connector
 * Description: Optional read-only Google Search Console OAuth connector. No mock metrics or automatic indexing submission.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Requires Plugins: ff90-seo
 * License: GPL-3.0-or-later
 * Text Domain: ff90-seo-gsc
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/includes/connector.php';
require_once __DIR__ . '/includes/admin.php';

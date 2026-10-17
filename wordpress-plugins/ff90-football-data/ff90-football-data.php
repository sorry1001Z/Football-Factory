<?php
/**
 * Plugin Name: FF90 Football Data Engine
 * Description: Source-labelled football-data.org adapter with private credentials, bounded quota, cache and explicit stale/error states.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * License: GPL-3.0-or-later
 * Text Domain: ff90-football-data
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/includes/engine.php';
register_activation_hook( __FILE__, 'ff90_football_install' );

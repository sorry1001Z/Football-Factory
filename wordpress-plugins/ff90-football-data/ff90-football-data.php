<?php
/**
 * Plugin Name: FF90 Football Data Engine
 * Description: Football-data.org and API-Football adapters with private credentials, shared cache, bounded quota and explicit stale/error states.
 * Version: 0.2.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * License: GPL-3.0-or-later
 * Text Domain: ff90-football-data
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/includes/engine.php';
require_once __DIR__ . '/includes/api-football.php';
register_activation_hook( __FILE__, 'ff90_football_install' );
register_deactivation_hook( __FILE__, function () { wp_clear_scheduled_hook( 'ff90_af_refresh' ); } );

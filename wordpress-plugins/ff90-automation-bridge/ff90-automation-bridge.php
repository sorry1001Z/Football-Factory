<?php
/**
 * Plugin Name: FF90 Automation Inbox and Recovery
 * Description: Authenticated idempotent job inbox, bounded worker leases/retries and review handoff. Never publishes content.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * License: GPL-3.0-or-later
 * Text Domain: ff90-automation-bridge
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/includes/jobs.php';
register_activation_hook( __FILE__, 'ff90_automation_install' );
register_deactivation_hook( __FILE__, function () { wp_clear_scheduled_hook( 'ff90_automation_tick' ); } );

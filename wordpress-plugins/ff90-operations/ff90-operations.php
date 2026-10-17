<?php
/**
 * Plugin Name: FF90 Operations and Content Export
 * Description: Private module health and checksummed native WXR content exports outside the webroot. Not a full server backup/restore system.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * License: GPL-3.0-or-later
 * Text Domain: ff90-operations
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/includes/operations.php';

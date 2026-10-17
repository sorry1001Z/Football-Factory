<?php
/**
 * Plugin Name: FF90 Security Baseline
 * Description: Local login throttling, security headers and a private redacted audit log. Independent of theme or industry.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * License: GPL-3.0-or-later
 * Text Domain: ff90-security
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/includes/security.php';
register_activation_hook( __FILE__, 'ff90_security_install' );

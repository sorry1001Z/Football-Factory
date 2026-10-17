<?php
/**
 * Plugin Name: FF90 Image Rights and Repetition Registry
 * Description: Human-declared image rights, local SHA-256 duplicate tracking and bounded anti-repetition reservations.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * License: GPL-3.0-or-later
 * Text Domain: ff90-image-registry
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/includes/images.php';
register_activation_hook( __FILE__, 'ff90_image_install' );

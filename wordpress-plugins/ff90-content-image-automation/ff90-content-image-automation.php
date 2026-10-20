<?php
/**
 * Plugin Name: FF90 Content & Image Automation
 * Description: Fail-closed FF90 editorial control plane, read-only status and always-blocked preflight; no publishing or draft creation.
 * Version: 0.3.1
 * Requires at least: 6.5
 * Requires PHP: 8.0
 * License: GPL-2.0-or-later
 * Text Domain: ff90-content-image-automation
 */
declare(strict_types=1);
if (!defined('ABSPATH')) { exit; }
require_once __DIR__.'/includes/class-ff90-automation.php';
add_action('plugins_loaded', ['FF90_Automation','boot']);
register_activation_hook(__FILE__, ['FF90_Automation','activate']);

<?php
/**
 * Template Part: Team Form (TP-029)
 *
 * Team's last-5 form. Wraps the match/form part with a team label.
 *
 * @var array<string, mixed> $args {
 *     @type array<string, mixed> $form  Array of W/D/L letters.
 *     @type string               $label Team label.
 * }
 *
 * DEMO DATA — view-model values are demo fixtures from the
 * Core Plugin contract. Replace with real values at render time.
 *
 * @package Football_Factory
 */

declare( strict_types = 1 );

$football_factory_form  = isset( $args['form'] ) && is_array( $args['form'] ) ? $args['form'] : array();
$football_factory_label = isset( $args['label'] ) ? (string) $args['label'] : '';

$football_factory_arg_form  = $football_factory_form;
$football_factory_arg_label = $football_factory_label;
$football_factory_arg_size  = '';
require __DIR__ . '/../match/form.php';

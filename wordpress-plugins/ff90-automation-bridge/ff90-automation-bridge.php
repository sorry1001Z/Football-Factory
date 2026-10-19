<?php
/**
 * Plugin Name: FF90 Automation Bridge
 * Description: Source-backed draft-only REST bridge for FF90 n8n content and image pipeline.
 * Version: 0.1.0
 * Requires PHP: 8.0
 * Text Domain: ff90-automation-bridge
 */
defined('ABSPATH') || exit;

add_action('rest_api_init', static function () {
    register_rest_route('ff90/v1', '/drafts', [
        'methods' => 'POST',
        'callback' => 'ff90_bridge_create_draft',
        'permission_callback' => static function () {
            return current_user_can('edit_posts');
        },
    ]);
});

function ff90_bridge_error(string $code, string $message, int $status): WP_Error {
    return new WP_Error($code, $message, ['status' => $status]);
}

function ff90_bridge_create_draft(WP_REST_Request $request) {
    // Fail closed: installation alone never allows drafting.
    if (!defined('FF90_BRIDGE_ENABLED') || FF90_BRIDGE_ENABLED !== true) {
        return ff90_bridge_error('ff90_disabled', 'FF90 bridge disabled by operator.', 503);
    }
    $data = $request->get_json_params();
    if (!is_array($data)) {
        return ff90_bridge_error('ff90_bad_json', 'JSON object required.', 400);
    }
    $source_id = isset($data['source_id']) && is_string($data['source_id']) ? trim($data['source_id']) : '';
    $title = isset($data['title']) && is_string($data['title']) ? sanitize_text_field($data['title']) : '';
    $content = isset($data['content_html']) && is_string($data['content_html']) ? wp_kses_post($data['content_html']) : '';
    $source_url = isset($data['source_url']) && is_string($data['source_url']) ? esc_url_raw($data['source_url']) : '';
    $source_title = isset($data['source_title']) && is_string($data['source_title']) ? sanitize_text_field($data['source_title']) : '';
    // Reuse FF90-05 review schema QA states; never substitute new QC logic.
    // qa_wp_draft, desktop and mobile are post-draft checks and must be evaluated
    // by FF90-05 before a human can approve publication.
    $qa = isset($data['qa']) && is_array($data['qa']) ? $data['qa'] : [];
    $preflight = ['qa_article', 'qa_fact', 'qa_seo'];
    foreach ($preflight as $name) {
        if (($qa[$name] ?? '') !== 'PASS') {
            return ff90_bridge_error('ff90_quality_hold', $name . ' must PASS under existing FF90 QC.', 422);
        }
    }
    if (($qa['qa_cover'] ?? '') !== 'PASS' && ($qa['qa_cover'] ?? '') !== 'HOLD') {
        return ff90_bridge_error('ff90_cover_hold', 'Cover QC must be PASS or explicitly HOLD.', 422);
    }
    if (($qa['qa_image_rights'] ?? '') !== 'PASS' && ($qa['qa_image_rights'] ?? '') !== 'HOLD') {
        return ff90_bridge_error('ff90_rights_hold', 'Image rights QC must be PASS or explicitly HOLD.', 422);
    }
    if (($qa['qa_cover'] ?? '') === 'HOLD' || ($qa['qa_image_rights'] ?? '') === 'HOLD') {
        if (!empty($data['media_id'])) {
            return ff90_bridge_error('ff90_cover_not_cleared', 'Held image cannot be attached.', 422);
        }
    }
    $verified = ($data['facts_verified'] ?? false) === true;
    $rights = ($data['rights_confirmed'] ?? false) === true;
    $asset_type = $data['asset_type'] ?? 'none';
    if (!is_string($asset_type) || !in_array($asset_type, ['none', 'licensed_photo', 'original_graphic'], true)) {
        return ff90_bridge_error('ff90_invalid_asset_type', 'Invalid asset type.', 422);
    }
    if (!preg_match('/^[A-Za-z0-9._:-]{8,128}$/D', $source_id) || $title === '' || $content === '' || $source_title === '' || !$verified) {
        return ff90_bridge_error('ff90_incomplete', 'Verified source, stable ID and article content required.', 422);
    }
    if (!wp_http_validate_url($source_url) || !in_array(wp_parse_url($source_url, PHP_URL_SCHEME), ['http','https'], true)) {
        return ff90_bridge_error('ff90_source_url', 'Valid public source URL required.', 422);
    }
    $license = isset($data['image_license']) && is_string($data['image_license']) ? sanitize_text_field($data['image_license']) : '';
    $image_source = isset($data['image_source_url']) && is_string($data['image_source_url']) ? esc_url_raw($data['image_source_url']) : '';
    $image_author = isset($data['image_author']) && is_string($data['image_author']) ? sanitize_text_field($data['image_author']) : '';
    $media_id = isset($data['media_id']) ? absint($data['media_id']) : 0;
    if ($asset_type !== 'none' && (($qa['qa_cover'] ?? '') !== 'PASS' || ($qa['qa_image_rights'] ?? '') !== 'PASS')) {
        return ff90_bridge_error('ff90_asset_qa', 'Image attach requires FF90 cover and rights PASS.', 422);
    }
    if ($asset_type !== 'none' && (!$rights || !$license || !$image_author || !wp_http_validate_url($image_source))) {
        return ff90_bridge_error('ff90_rights', 'Image provenance and confirmed rights required.', 422);
    }
    if ($media_id && ($asset_type === 'none' || !wp_attachment_is_image($media_id) || !current_user_can('edit_post', $media_id))) {
        return ff90_bridge_error('ff90_media', 'Media must be an authorized existing image attachment with verified rights.', 422);
    }
    // Stable key for retries; source_id is unique within this bridge's namespace.
    $key = hash('sha256', $source_id);
    $lock = 'ff90_bridge_lock_' . $key;
    if (!add_option($lock, time(), '', false)) {
        return ff90_bridge_error('ff90_duplicate_or_busy', 'Source is already processing or previously submitted. Reconcile before retry.', 409);
    }
    $post_id = 0;
    try {
        $matches = get_posts([
            'post_type' => 'post', 'post_status' => ['draft', 'pending', 'publish', 'future', 'private', 'trash'],
            'meta_key' => '_ff90_bridge_key', 'meta_value' => $key,
            'numberposts' => 1, 'fields' => 'ids', 'suppress_filters' => false,
        ]);
        if ($matches) {
            return new WP_REST_Response(['status' => 'exists', 'post_id' => (int)$matches[0]], 200);
        }
        $post_id = wp_insert_post([
            'post_type' => 'post', 'post_status' => 'draft',
            'post_title' => $title, 'post_content' => $content,
            'meta_input' => [
                '_ff90_bridge_key' => $key,
                '_ff90_source_id' => $source_id,
                '_ff90_source_url' => $source_url,
                '_ff90_source_title' => $source_title,
                '_ff90_facts_verified' => '1',
                '_ff90_rights_confirmed' => $rights ? '1' : '0',
                '_ff90_image_license' => $license,
                '_ff90_image_source' => $image_source,
                '_ff90_image_author' => $image_author,
                '_ff90_asset_type' => $asset_type,
                '_ff90_qa_article' => 'PASS',
                '_ff90_qa_fact' => 'PASS',
                '_ff90_qa_seo' => 'PASS',
                '_ff90_qa_cover' => sanitize_key((string)$qa['qa_cover']),
                '_ff90_qa_image_rights' => sanitize_key((string)$qa['qa_image_rights']),
            ],
        ], true);
        if (is_wp_error($post_id)) {
            return $post_id;
        }
        if ($media_id) {
            set_post_thumbnail($post_id, $media_id);
        }
        return new WP_REST_Response(['status' => 'draft', 'post_id' => (int)$post_id], 201);
    } finally {
        // Retain lock after successful insertion to reject concurrent duplicates.
        // On failures without a post, clear lock so an operator may retry.
        if (!$post_id || is_wp_error($post_id)) {
            delete_option($lock);
        }
    }
}

<?php
/**
 * Plugin Name: FF90 SEO Intelligence Inbox
 * Description: Private SEO editorial proposals from FF90 engine; never publishes articles.
 * Version: 0.1.0
 * Requires PHP: 8.0
 */
defined('ABSPATH') || exit;
add_action('init', function () {
    register_post_type('ff_seo_proposal', [
        'labels' => ['name'=>'SEO Proposals','singular_name'=>'SEO Proposal'],
        'public'=>false, 'show_ui'=>true, 'show_in_menu'=>true,
        'capability_type'=>'post', 'map_meta_cap'=>true,
        'supports'=>['title','editor','custom-fields'],
        'menu_icon'=>'dashicons-chart-line',
    ]);
});
add_action('rest_api_init', function () {
    register_rest_route('ff90-seo/v1', '/proposals', [
        'methods'=>'POST',
        'callback'=>'ff90_seo_accept',
        'permission_callback'=>function () {
            return defined('FF90_SEO_INBOX_ENABLED') && FF90_SEO_INBOX_ENABLED === true
                && current_user_can('edit_others_posts');
        },
    ]);
});
function ff90_seo_accept(WP_REST_Request $request) {
    $payload = $request->get_json_params();
    if (!is_array($payload) || ($payload['schema_version'] ?? '') !== 'ff90.seo_intelligence.v1'
        || ($payload['site'] ?? '') !== 'sc-domain:ff90.online'
        || ($payload['production_writes'] ?? null) !== false
        || ($payload['approval_required'] ?? null) !== true
        || !isset($payload['recommendations']) || !is_array($payload['recommendations'])
        || count($payload['recommendations']) > 500) {
        return new WP_Error('ff90_bad_payload','Invalid SEO proposal report',['status'=>400]);
    }
    if (strlen(wp_json_encode($payload)) > 1024*1024) {
        return new WP_Error('ff90_too_large','Payload too large',['status'=>413]);
    }
    $created=0; $updated=0; $skipped=0;
    foreach ($payload['recommendations'] as $rec) {
        if (!is_array($rec)) { $skipped++; continue; }
        $keyword = sanitize_text_field((string)($rec['keyword'] ?? ''));
        $action = (string)($rec['recommendation'] ?? '');
        if (!$keyword || strlen($keyword)>400 ||
            !in_array($action, ['research','propose_new_draft','optimize_existing_page','review_cannibalization'],true)) {
            $skipped++; continue;
        }
        // Deterministic identity. Existing proposal is updated rather than duplicated.
        $identity=hash('sha256',trim($keyword));
        $existing=get_posts(['post_type'=>'ff_seo_proposal','post_status'=>'any',
            'meta_key'=>'_ff90_seo_identity','meta_value'=>$identity,
            'numberposts'=>1,'fields'=>'ids']);
        $pages=array_values(array_filter(array_map('esc_url_raw',
            is_array($rec['existing_pages'] ?? null) ? $rec['existing_pages'] : [])));
        $summary=wp_json_encode([
            'keyword'=>$keyword, 'action'=>$action, 'score'=>isset($rec['score'])?floatval($rec['score']):null,
            'sources'=>array_values(array_intersect((array)($rec['sources'] ?? []),['gsc','trends_csv','ahrefs'])),
            'pages'=>$pages,'report_date'=>sanitize_text_field((string)($payload['generated_at'] ?? '')),
        ],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
        $post=['post_type'=>'ff_seo_proposal','post_status'=>'private',
            'post_title'=>wp_html_excerpt('[SEO] '.$keyword,200,''),
            'post_content'=>$summary];
        if ($existing) {
            $post['ID']=(int)$existing[0];
            $id=wp_update_post($post,true);
        } else {
            $id=wp_insert_post($post,true);
        }
        if (is_wp_error($id)) return $id;
        if ($existing) { $updated++; } else { $created++; }
        update_post_meta($id,'_ff90_seo_identity',$identity);
        update_post_meta($id,'_ff90_seo_action',$action);
        update_post_meta($id,'_ff90_seo_score',isset($rec['score'])?floatval($rec['score']):'');
        // No wp_insert_post('post') calls; editorial team must manually act.
    }
    return rest_ensure_response(['accepted'=>true,'created'=>$created,'updated'=>$updated,'skipped'=>$skipped,'publication'=>false]);
}

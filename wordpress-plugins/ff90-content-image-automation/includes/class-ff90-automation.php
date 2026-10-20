<?php
declare(strict_types=1);
if (!defined('ABSPATH')) { exit; }
final class FF90_Automation {
    private const OPT = 'ff90_automation_config';
    private const NAMESPACE = 'ff90-automation/v1';
    private const DEFAULTS = [
        'daily_target'=>40, 'language'=>'th_TH', 'timezone'=>'Asia/Bangkok',
        'ai_provider'=>'minimax', 'orchestrator'=>'hermes',
        'queue_enabled'=>false, 'auto_publish'=>false,
        'kill_switch'=>true, 'manual_review'=>true, 'publish_mode'=>'draft',
        'seo_profile'=>'ff90-existing', 'qc_profile'=>'ff90-existing',
        'hero_width'=>1200, 'hero_height'=>675,
        'card_width'=>640, 'card_height'=>360, 'card_preview_width'=>320,
        'card_fallback'=>'clean_master', 'banner_route_priority'=>'article_type',
        'editorial_profile'=>'FF90-Sports-Editorial-V2.5.2',
        'standard_min_chars'=>2500, 'standard_max_chars'=>3500,
        'hero_format_allowlist'=>['image/webp','image/png'],
        'image_classes'=>['general','breaking','transfer','preview','result','standings','stats','tactics','team','competition','infographic','youth','feature'],
    ];
    public static function activate(): void {
        if (get_option(self::OPT, false) === false) {
            add_option(self::OPT, self::DEFAULTS, '', false);
        }
    }
    public static function boot(): void {
        add_action('admin_menu', [__CLASS__,'menu']);
        add_action('rest_api_init', [__CLASS__,'routes']);
    }
    public static function configuration(): array {
        $stored = get_option(self::OPT, []);
        $stored = is_array($stored) ? $stored : [];
        // Non-negotiable controls. Never accept a stored value that changes these.
        return array_merge(self::DEFAULTS, array_intersect_key($stored, self::DEFAULTS), [
            'queue_enabled'=>false, 'auto_publish'=>false,
            'kill_switch'=>true, 'manual_review'=>true, 'publish_mode'=>'draft',
        ]);
    }
    public static function menu(): void {
        add_menu_page('FF90 Content & Image', 'FF90 Content & Image', 'manage_options',
            'ff90-content-image-automation', [__CLASS__, 'admin_page'], 'dashicons-shield', 56);
    }
    public static function admin_page(): void {
        if (!current_user_can('manage_options')) { wp_die(esc_html__('Not authorized','ff90-content-image-automation')); }
        $cfg = self::configuration();
        echo '<div class="wrap"><h1>FF90 Content &amp; Image Automation</h1>';
        echo '<p><strong>Safe mode:</strong> queue OFF; auto-publish OFF; kill switch ON; drafts require manual approval.</p>';
        echo '<table class="widefat striped"><tbody>';
        foreach ($cfg as $name=>$value) {
            $shown = is_bool($value) ? ($value?'ON':'OFF') : (is_array($value) ? implode(', ', $value) : (string)$value);
            echo '<tr><th scope="row">'.esc_html($name).'</th><td>'.esc_html($shown).'</td></tr>';
        }
        echo '</tbody></table><p>Content length, SEO numeric ranges, Card dimensions and QC thresholds must be imported from the authoritative FF90 rules contract before production operation.</p></div>';
    }
    public static function routes(): void {
        register_rest_route(self::NAMESPACE, '/status', [
            'methods'=>'GET','callback'=>[__CLASS__,'status'],
            'permission_callback'=>static fn()=>current_user_can('manage_options')
        ]);
        register_rest_route(self::NAMESPACE, '/preflight', [
            'methods'=>'POST', 'callback'=>[__CLASS__,'preflight'],
            'permission_callback'=>static fn()=>current_user_can('edit_posts'),
        ]);
    }
    public static function status(): WP_REST_Response {
        return rest_ensure_response(['plugin'=>'ff90-content-image-automation', 'version'=>'0.3.1',
            'settings'=>self::configuration(), 'production_ready'=>false,
            'blockers'=>['special_article_profiles_unresolved','image_rights_integration_unverified',
                'publisher_not_enabled','database_migrations_not_verified']]);
    }
    public static function validate(array $candidate): array {
        $errors=[];
        foreach (['headline','body','source_url','source_published_at','image_source_url',
            'image_rights_evidence','image_subject_verified','image_dimensions_verified'] as $field) {
            if (!array_key_exists($field,$candidate) || $candidate[$field] === null || $candidate[$field] === '' || $candidate[$field] === false) {
                $errors[]='missing_or_invalid_'.$field;
            }
        }
        foreach (['image_subject_verified','image_dimensions_verified'] as $field) {
            if (($candidate[$field] ?? null) !== true) { $errors[]='independent_confirmation_required_'.$field; }
        }
        if (!is_string($candidate['article_type'] ?? null) || trim($candidate['article_type'])==='') { $errors[]='article_type_required'; }
        foreach (['source_url','image_source_url'] as $key) {
            if (!empty($candidate[$key]) &&
                (!is_string($candidate[$key]) || !filter_var($candidate[$key], FILTER_VALIDATE_URL)
                 || parse_url($candidate[$key], PHP_URL_SCHEME) !== 'https')) {
                $errors[]='invalid_https_'.$key;
            }
        }
        if (isset($candidate['image_dimensions']) && is_array($candidate['image_dimensions'])) {
            if (($candidate['image_dimensions']['width']??0)!==1200 || ($candidate['image_dimensions']['height']??0)!==675) {
                $errors[]='hero_dimensions_not_1200x675';
            }
        } else { $errors[]='missing_hero_dimensions'; }
        // Preserve approved image format and all thirteen theme categories.
        $formats = self::DEFAULTS['hero_format_allowlist'];
        if (!in_array($candidate['image_mime'] ?? null, $formats, true)) {
            $errors[]='hero_mime_not_approved';
        }
        if (!in_array($candidate['image_class'] ?? null, self::DEFAULTS['image_classes'], true)) {
            $errors[]='unknown_image_class';
        }
        // A submitted attestation is not a replacement for independent rights checks.
        if (($candidate['image_placeholder'] ?? null) !== false) {
            $errors[]='placeholder_must_be_explicitly_false';
        }
        if (empty($candidate['image_creator']) || !is_string($candidate['image_creator'])) {
            $errors[]='image_creator_missing';
        }
        if (empty($candidate['image_license_type']) || !is_string($candidate['image_license_type'])) {
            $errors[]='image_license_type_missing';
        }
        if (empty($candidate['image_license_url']) || !is_string($candidate['image_license_url'])
            || !filter_var($candidate['image_license_url'], FILTER_VALIDATE_URL)
            || parse_url($candidate['image_license_url'], PHP_URL_SCHEME) !== 'https') {
            $errors[]='image_license_url_invalid';
        }
        if (!is_string($candidate['source_published_at'] ?? null)
            || strtotime($candidate['source_published_at']) === false) {
            $errors[]='source_published_at_invalid';
        }
        if (!is_string($candidate['headline'] ?? null) || trim(wp_strip_all_tags($candidate['headline'])) === '') {
            $errors[]='headline_invalid';
        }
        if (!is_string($candidate['body'] ?? null) || trim(wp_strip_all_tags($candidate['body'])) === '') {
            $errors[]='body_invalid';
        }
        if (($candidate['article_type'] ?? null) === 'standard') {
            $plain = html_entity_decode(wp_strip_all_tags((string)($candidate['body'] ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $plain = preg_replace('/\s+/u', '', $plain) ?? $plain;
            $count = function_exists('mb_strlen') ? mb_strlen($plain, 'UTF-8') : (preg_match_all('/./us', $plain) ?: 0);
            if ($count < 2500 || $count > 3500) { $errors[]='standard_length_outside_2500_3500'; }
        }
        if (!empty($candidate['article_type']) && !in_array($candidate['article_type'], [
            'standard','breaking','player_news','team_news','match_report','transfer_news','rumor','analysis',
            'knowledge','fixture_roundup','national_team_news','competition_news','european_news'], true)) {
            $errors[]='unsupported_article_type';
        }
        if (($candidate['requested_status']??'draft')!=='draft') { $errors[]='non_draft_forbidden'; }
        if (!isset($candidate['editorial_profile_version']) || !is_string($candidate['editorial_profile_version']) || $candidate['editorial_profile_version']==='') {
            $errors[]='missing_editorial_profile_version';
        }
        if (!isset($candidate['idempotency_key']) || !is_string($candidate['idempotency_key']) || strlen($candidate['idempotency_key'])<16) {
            $errors[]='missing_idempotency_key';
        }
        return array_values(array_unique($errors));
    }
    /** Banner routing is article-type-first. Unknown types must not default to Matchday. */
    public static function banner_template(string $article_type, string $category=''): string {
        $routes = [
            'fixture_roundup'=>'MATCH SCHEDULE', 'match_report'=>'INSIDE MATCHDAY',
            'transfer_news'=>'TRANSFER NEWS', 'rumor'=>'TRANSFER NEWS',
            'knowledge'=>'FOOTBALL INSIGHT', 'analysis'=>'FF90 ANALYSIS',
            'player_news'=>'FF90 NEWS', 'breaking'=>'FF90 NEWS',
            'team_news'=>'LEAGUE NEWS', 'standard'=>'FF90 NEWS',
        ];
        if (isset($routes[$article_type])) { return $routes[$article_type]; }
        $fallbacks = ['cups'=>'CUP REPORT','national-teams'=>'INTERNATIONAL',
            'european-football'=>'EUROPEAN FOOTBALL'];
        return $fallbacks[$category] ?? 'FF90 NEWS';
    }

    /**
     * Card selection from an externally independently reviewed readability result.
     * Unknown, incomplete and unreadable results always use the clean original.
     * NEVER strip text from a rendered/flattened banner: select the preserved clean master.
     */
    public static function card_decision(array $asset): array {
        $checks = $asset['readability'] ?? [];
        $passed = is_array($checks)
            && ($checks['width_640_pass'] ?? null) === true
            && ($checks['width_320_pass'] ?? null) === true
            && ($checks['headline_fully_readable'] ?? null) === true
            && ($checks['category_fully_readable'] ?? null) === true
            && ($checks['safe_area_pass'] ?? null) === true
            && ($checks['reviewed'] ?? null) === true;
        $clean = $asset['clean_master_asset_id'] ?? null;
        $decorated = $asset['decorated_hero_asset_id'] ?? null;
        $rights = ($asset['rights_qc'] ?? null) === 'PASS';
        $visual = ($asset['visual_qc'] ?? null) === 'PASS';
        if (!$rights || !$visual || !is_string($clean) || trim($clean)==='') {
            return ['status'=>'HOLD','variant'=>null,'asset_id'=>null,
                'reason'=>'rights_visual_or_clean_master_missing'];
        }
        if ($passed && is_string($decorated) && trim($decorated)!=='') {
            return ['status'=>'PASS','variant'=>'decorated','asset_id'=>$decorated,
                'reason'=>'readable_at_640_and_320'];
        }
        return ['status'=>'PASS','variant'=>'clean','asset_id'=>$clean,
            'reason'=>'unreadable_or_unverified_text_clean_fallback'];
    }

    /** Shared hero source; the card is a derivative, never a separate invented photograph. */
    public static function image_contract(array $asset): array {
        $errors=[];
        if (($asset['hero_width'] ?? null)!==1200 || ($asset['hero_height'] ?? null)!==675) {
            $errors[]='hero_must_be_1200x675';
        }
        if (($asset['card_width'] ?? null)!==640 || ($asset['card_height'] ?? null)!==360) {
            $errors[]='card_must_be_640x360';
        }
        if (($asset['card_derivative_of_hero'] ?? null)!==true) {
            $errors[]='card_must_derive_from_same_hero';
        }
        if (($asset['license_allows_derivatives'] ?? null)!==true) {
            $errors[]='derivative_rights_not_verified';
        }
        if (!is_string($asset['clean_master_asset_id'] ?? null) || trim($asset['clean_master_asset_id'])==='') {
            $errors[]='clean_master_required';
        }
        return $errors;
    }

    public static function preflight(WP_REST_Request $request): WP_REST_Response {
        $payload=$request->get_json_params();
        $payload=is_array($payload)?$payload:[];
        $errors=self::validate($payload);
        // Rules and provider checks are deliberately not implemented here: preflight must fail closed.
        $errors[]='editorial_rules_contract_unverified';
        $errors[]='external_fact_and_license_checks_not_integrated';
        return new WP_REST_Response(['ready'=>false,'errors'=>array_values(array_unique($errors)),
            'draft_created'=>false,'queue_enabled'=>false,'auto_publish'=>false], 422);
    }
}

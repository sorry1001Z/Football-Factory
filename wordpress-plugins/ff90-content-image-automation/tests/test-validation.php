<?php
// Run: php tests/test-validation.php
// Tests pure validation without booting WordPress.
define('ABSPATH', __DIR__);
function wp_strip_all_tags($text){return strip_tags($text);}
require dirname(__DIR__).'/includes/class-ff90-automation.php';
$sample = [
 'headline'=>'Test headline', 'body'=>'Test article', 'source_url'=>'https://example.org/source',
 'source_published_at'=>'2026-10-20T08:00:00+07:00',
 'image_source_url'=>'https://example.org/image.png',
 'image_rights_evidence'=>'CC or explicit written permission proof',
 'image_subject_verified'=>true,'image_dimensions_verified'=>true,
 'image_dimensions'=>['width'=>1200,'height'=>675], 'requested_status'=>'draft',
 'image_mime'=>'image/webp', 'image_class'=>'general', 'image_placeholder'=>false,
 'image_creator'=>'Photographer', 'image_license_type'=>'written_permission',
 'image_license_url'=>'https://example.org/license', 'article_type'=>'breaking', 'editorial_profile_version'=>'V2.5.2', 'idempotency_key'=>'test-1234567890123456',
];
function check(bool $condition,string $msg):void { if (!$condition) { fwrite(STDERR,"FAIL: $msg\n");exit(1);}echo "PASS: $msg\n"; }
check(FF90_Automation::validate($sample)===[], 'valid preflight shape');
$wrong=$sample;$wrong['requested_status']='publish';
check(in_array('non_draft_forbidden',FF90_Automation::validate($wrong),true),'publish blocked');
$wrong=$sample;$wrong['image_rights_evidence']='';
check(in_array('missing_or_invalid_image_rights_evidence',FF90_Automation::validate($wrong),true),'missing rights blocked');
$wrong=$sample;$wrong['image_dimensions']['width']=1024;
check(in_array('hero_dimensions_not_1200x675',FF90_Automation::validate($wrong),true),'wrong hero dimensions blocked');
$wrong=$sample;$wrong['source_url']='http://example.org/source';
check(in_array('invalid_https_source_url',FF90_Automation::validate($wrong),true),'non-https blocked');

$wrong=$sample;$wrong['image_placeholder']=true;
check(in_array('placeholder_must_be_explicitly_false',FF90_Automation::validate($wrong),true),'placeholder blocked');
$wrong=$sample;$wrong['image_class']='unapproved';
check(in_array('unknown_image_class',FF90_Automation::validate($wrong),true),'unknown image category blocked');
$wrong=$sample;$wrong['image_mime']='image/jpeg';
check(in_array('hero_mime_not_approved',FF90_Automation::validate($wrong),true),'unapproved featured MIME blocked');
$wrong=$sample;unset($wrong['image_license_url']);
check(in_array('image_license_url_invalid',FF90_Automation::validate($wrong),true),'missing license URL blocked');

check(FF90_Automation::banner_template('match_report')==='INSIDE MATCHDAY','matchday routing');
check(FF90_Automation::banner_template('transfer_news')==='TRANSFER NEWS','transfer routing');
check(FF90_Automation::banner_template('fixture_roundup')==='MATCH SCHEDULE','fixture routing');
$asset=['rights_qc'=>'PASS','visual_qc'=>'PASS','clean_master_asset_id'=>'clean-01','decorated_hero_asset_id'=>'banner-01'];
$decision=FF90_Automation::card_decision($asset);
check($decision['variant']==='clean','missing readability evidence falls back clean');
$asset['readability']=['width_640_pass'=>true,'width_320_pass'=>true,'headline_fully_readable'=>true,
 'category_fully_readable'=>true,'safe_area_pass'=>true,'reviewed'=>true];
check(FF90_Automation::card_decision($asset)['variant']==='decorated','full readability evidence allows banner');
$asset['readability']['width_320_pass']=false;
check(FF90_Automation::card_decision($asset)['variant']==='clean','320px failure selects clean');
$asset['rights_qc']='PENDING';
check(FF90_Automation::card_decision($asset)['status']==='HOLD','rights pending blocks all variants');
check(FF90_Automation::image_contract(['hero_width'=>1200,'hero_height'=>675,'card_width'=>640,
 'card_height'=>360,'card_derivative_of_hero'=>true,'license_allows_derivatives'=>true,
 'clean_master_asset_id'=>'clean-01'])===[],'shared Hero-to-Card contract');
$wrong=$sample;$wrong['article_type']='standard';
check(in_array('standard_length_outside_2500_3500',FF90_Automation::validate($wrong),true),'short STANDARD blocked');

check(in_array('clean_master_required',FF90_Automation::image_contract(['hero_width'=>1200,'hero_height'=>675,'card_width'=>640,'card_height'=>360,'card_derivative_of_hero'=>true,'license_allows_derivatives'=>true]),true),'missing clean master blocks contract');
$wrong=$sample;$wrong['image_subject_verified']='false';
check(in_array('independent_confirmation_required_image_subject_verified',FF90_Automation::validate($wrong),true),'truthy string cannot attest image subject');
$wrong=$sample;$wrong['image_dimensions_verified']=1;
check(in_array('independent_confirmation_required_image_dimensions_verified',FF90_Automation::validate($wrong),true),'integer cannot attest dimensions');
$wrong=$sample;unset($wrong['article_type']);
check(in_array('article_type_required',FF90_Automation::validate($wrong),true),'missing type cannot bypass profile selection');

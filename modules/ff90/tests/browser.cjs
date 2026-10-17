/* Local-only real WordPress UI integration. Football HTTP is explicitly mocked. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const{chromium}=require('/workspace/ff90-tools/browser/node_modules/playwright-core');const Axe=require('/workspace/ff90-tools/browser/node_modules/@axe-core/playwright').default;
const wp=(...a)=>execFileSync('/workspace/ff90-tools/bin/wp',a,{encoding:'utf8'}).trim();
if(!['true','1'].includes(wp('config','get','FF90_QA_SANDBOX')))throw Error('Disposable sandbox marker required');
if(wp('eval',"echo ff90_football_token()?'configured':'empty';")!=='empty')throw Error('Refusing to override real football credentials');
const base=wp('option','get','home');if(new URL(base).hostname!=='127.0.0.1')throw Error('Local loopback required');
const out=path.join(__dirname,'../docs/qa');fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
const check=(v,m)=>{if(!v)throw Error(m)},results=[];async function test(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS',name);}
(async()=>{
 const options=JSON.parse(wp('eval',`echo wp_json_encode(array('editorial'=>get_option('ff90_editorial_options',array()),'football'=>get_option('ff90_football_options',array()),'template'=>get_stylesheet()));`));
 let author,story,pageId,image;const helper='/workspace/ff90-tools/wordpress/wp-content/mu-plugins/ff90-modules-qa-provider.php';
 if(fs.existsSync(helper))throw Error('Existing QA helper must not be overwritten');
 const oldQuota=wp('eval',`global $wpdb;echo wp_json_encode($wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}ff90_football_quota WHERE provider='football-data.org' AND quota_day=%s",gmdate('Y-m-d')),ARRAY_A));`);
 const cache=JSON.parse(wp('eval',`$r=array();foreach(array('matches','standings')as $k){$key=ff90_football_cache_key($k,'PL',wp_date('Y-m-d'));$r[$key]=get_transient($key);$r[$key.'_last']=get_transient($key.'_last');}echo wp_json_encode($r);`));
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const c=await b.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await c.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 try{
  wp('option','update','ff90_editorial_options','{"enforce":false,"paused":false}','--format=json');
  author=Number(wp('eval',`echo wp_insert_user(array('user_login'=>'qa-browser-'.wp_generate_uuid4(),'user_pass'=>wp_generate_password(32),'role'=>'author','user_email'=>'qa-'.wp_generate_uuid4().'@example.invalid'));`));check(author>0,'Author fixture failed');
  story=Number(wp('post','create','--post_type=post','--post_status=draft','--post_author='+author,'--post_title=SYNTHETIC module review QA','--post_content=<p>Local QA article, not verified football news.</p>','--porcelain'));
  const password=fs.readFileSync('/workspace/ff90-tools/install-private.log','utf8').match(/Admin password: (.+)/)[1].trim();
  await p.goto(base+'/wp-login.php',{waitUntil:'domcontentloaded'});await p.locator('#user_login').fill('ff90qa');await p.locator('#user_pass').fill(password);await Promise.all([p.waitForURL('**/wp-admin/**'),p.locator('#wp-submit').click()]);
  await test('Security headers present on actual frontend response',async()=>{
   const r=await c.request.get(base+'/');check(r.headers()['x-content-type-options']==='nosniff','nosniff missing');check(r.headers()['referrer-policy']==='strict-origin-when-cross-origin','Referrer policy missing');check(r.headers()['x-frame-options']==='SAMEORIGIN','Frame header missing');
  });
  await test('Gutenberg source declarations save through native REST metadata',async()=>{
   await p.goto(base+'/wp-admin/post.php?post='+story+'&action=edit',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.wp&&wp.data.select('core/editor')?.getCurrentPostId()>0);
   await p.evaluate(()=>{wp.data.dispatch('core/preferences').set('core','welcomeGuide',false);var d=wp.data.dispatch('core/edit-post');if(d&&d.openGeneralSidebar)d.openGeneralSidebar('edit-post/document');});
   const dialog=p.getByRole('dialog');if(await dialog.count()){const close=dialog.getByRole('button',{name:/close|ปิด/i});if(await close.count())await close.first().click();}
   const button=p.getByRole('button',{name:'Content QA',exact:true});await button.waitFor();if(await button.getAttribute('aria-expanded')!=='true')await button.click();
   await p.getByLabel('Source URLs (one per line)',{exact:true}).fill('https://example.org/synthetic-source-a\nhttps://example.org/synthetic-source-b');
   await p.evaluate(async()=>{await wp.data.dispatch('core/editor').savePost();});
   check(JSON.parse(wp('post','meta','get',String(story),'_ff90_qa_sources','--format=json')).length===2,'Native sources not stored');await p.screenshot({path:path.join(out,'screenshots/qa-editor.png'),fullPage:true});
  });
  await test('Editorial settings opt into approval enforcement through native Settings API',async()=>{
   await p.goto(base+'/wp-admin/options-general.php?page=ff90-editorial',{waitUntil:'domcontentloaded'});await p.getByLabel('Enforce approval on ordinary publishing and scheduling',{exact:true}).check();await Promise.all([p.waitForURL('**settings-updated=true'),p.locator('#submit').click()]);check(JSON.parse(wp('option','get','ff90_editorial_options','--format=json')).enforce,'Enforcement not saved');
  });
  await test('Human QA form rejects missing nonce before attestation',async()=>{
   const r=await c.request.post(base+'/wp-admin/admin.php?action=ff90_qa_review&post='+story,{form:{facts:'1',rights:'1',fingerprint:wp('eval',`echo ff90_qa_fingerprint(${story});`)}});check(r.status()===403,'Missing QA nonce accepted');
  });
  await test('Independent saved-version fact and rights review uses real admin form',async()=>{
   await p.goto(base+'/wp-admin/admin.php?action=ff90_qa_review&post='+story,{waitUntil:'domcontentloaded'});await p.getByLabel('ฉันตรวจข้อเท็จจริงกับแหล่งอ้างอิงแล้ว',{exact:true}).check();await p.getByLabel('ฉันตรวจสิทธิ์ภาพแล้ว',{exact:true}).check();await p.getByLabel('Review note',{exact:true}).fill('Synthetic local UI verification only');await Promise.all([p.waitForURL(u=>u.pathname.endsWith('/wp-admin/post.php')),p.getByRole('button',{name:'Record human verification',exact:true}).click()]);check(wp('eval',`echo ff90_qa_report(${story})['human_review_current']?'yes':'no';`)==='yes','Human record absent');
  });
  await test('Editorial approval form then native REST publishes only reviewed version',async()=>{
   await p.goto(base+'/wp-admin/admin.php?action=ff90_editorial_review&post='+story,{waitUntil:'domcontentloaded'});await p.getByLabel('Review note',{exact:true}).fill('Approve synthetic fixture');await Promise.all([p.waitForURL(u=>u.pathname.endsWith('/wp-admin/post.php')),p.getByRole('button',{name:'Approve saved version',exact:true}).click()]);await p.waitForFunction(()=>window.wp&&wp.apiFetch);
   const response=await p.evaluate(async(id)=>{try{return await wp.apiFetch({path:'/wp/v2/posts/'+id,method:'POST',data:{status:'publish'}});}catch(e){return {error:e.message};}},story);check(response.status==='publish','Reviewed native publish failed: '+JSON.stringify(response));
   const changed=await p.evaluate(async(id)=>{try{await wp.apiFetch({path:'/wp/v2/posts/'+id,method:'POST',data:{title:'Unreviewed live mutation'}});return 'unexpected';}catch(e){return e.code;}},story);check(changed==='ff90_review_required','Unreviewed REST mutation allowed');
  });
  // Only now install a temporary local provider double; no real API key or provider traffic.
  fs.mkdirSync(path.dirname(helper),{recursive:true});fs.writeFileSync(helper,`<?php
if(!defined('FF90_QA_SANDBOX')||!FF90_QA_SANDBOX)return;
define('FF90_FOOTBALL_DATA_TOKEN','synthetic-browser-fixture-not-real');
add_filter('pre_http_request',function($pre,$args,$url){if(strpos($url,'https://api.football-data.org/')!==0)return $pre;
$when=(new DateTimeImmutable(wp_date('Y-m-d').' 12:00:00',wp_timezone()))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\\TH:i:s\\Z');
$raw=strpos($url,'/standings')!==false?array('standings'=>array(array('type'=>'TOTAL','stage'=>'SYNTHETIC_QA','table'=>array(array('team'=>array('name'=>'ทีมสมมติสำหรับทดสอบหน้าจอเท่านั้นไม่ใช่ข้อมูลการแข่งขันจริง'),'position'=>1,'playedGames'=>2,'won'=>1,'draw'=>1,'lost'=>0,'goalsFor'=>3,'goalsAgainst'=>1,'goalDifference'=>2,'points'=>4))))):array('matches'=>array(array('id'=>909999,'utcDate'=>$when,'status'=>'FINISHED','homeTeam'=>array('name'=>'Synthetic Home QA'),'awayTeam'=>array('name'=>'Synthetic Away QA'),'score'=>array('fullTime'=>array('home'=>0,'away'=>0)))));
return array('headers'=>array(),'body'=>wp_json_encode($raw),'response'=>array('code'=>200,'message'=>'SYNTHETIC HTTP QA'),'cookies'=>array());},10,3);
`);
  wp('option','update','ff90_football_options','{"enabled":true,"competition":"PL"}','--format=json');for(const key of Object.keys(cache))wp('eval','delete_transient('+JSON.stringify(key)+');');
  image=Number(wp('media','import','/workspace/ff90-tools/fixtures/qa-sale-banner.png','--title=Original synthetic module QA banner','--porcelain'));
  pageId=Number(wp('post','create','--post_type=page','--post_status=publish','--post_title=SYNTHETIC MODULE QA — football HTTP is mocked','--post_content=<p>Test fixtures, not real football data.</p>','--porcelain'));
  wp('post','meta','update',String(pageId),'_thumbnail_id',String(image));wp('post','update',String(pageId),'--post_content=<p>SYNTHETIC QA — test doubles, not real football data.</p>[ff90_featured_banner post_id="'+pageId+'" kind="preview"][ff90_fixtures competition="PL"][ff90_results competition="PL"][ff90_standings competition="PL"]');
  const url=wp('eval',`echo get_permalink(${pageId});`);await c.clearCookies();
  for(const width of [360,390,768,1024,1440])await test('Independent renderer and football widgets '+width+'px + axe',async()=>{
   await p.setViewportSize({width,height:1000});const r=await p.goto(url,{waitUntil:'domcontentloaded'});check(r.status()===200,'Fixture page failed');await p.locator('.ff90-featured-banner img').evaluate(i=>{i.loading='eager';});await p.waitForFunction(()=>[...document.querySelectorAll('.ff90-featured-banner img')].every(i=>i.complete&&i.naturalWidth>0));
   check(await p.locator('.ff90-football-data table').count()===1,'Standings table missing');check((await p.locator('.ff90-football-data').first().innerText()).includes('0 : 0'),'Real fixture zero score was omitted');
   const visual=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,images:[...document.querySelectorAll('.ff90-featured-banner img')].map(i=>{const s=getComputedStyle(i),r=i.getBoundingClientRect();return {fit:s.objectFit,width:r.width-parseFloat(s.borderLeftWidth)-parseFloat(s.borderRightWidth)-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),height:r.height-parseFloat(s.borderTopWidth)-parseFloat(s.borderBottomWidth)-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom),natural:i.naturalWidth/i.naturalHeight};})}));
   check(!visual.overflow,'Document overflow');check(visual.images.every(i=>i.fit==='contain'&&Math.abs(i.height-i.width/i.natural)<=1),'Banner crop/ratio mismatch');
   const axe=await new Axe({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();check(!axe.violations.length,'Axe: '+axe.violations.map(v=>v.id).join(','));if([390,1440].includes(width))await p.screenshot({path:path.join(out,'screenshots/modules-'+width+'.png'),fullPage:true});
  });
  await test('Same modules render with unrelated Twenty Twenty-Five theme',async()=>{
   wp('theme','activate','twentytwentyfive');await p.setViewportSize({width:390,height:1000});await p.goto(url,{waitUntil:'domcontentloaded'});check(await p.locator('.ff90-football-data table').count()===1&&await p.locator('.ff90-featured-banner img').count()===1,'Theme dependency detected');check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Unrelated-theme overflow');wp('theme','activate',options.template);
  });
  check(!errors.length,'Browser exceptions: '+errors.join(';'));results.push({name:'No browser exceptions',status:'PASS'});fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({runtime:'Local WordPress 6.9, PHP 8.4, SQLite, Chromium; football HTTP is DOUBLED',results},null,2));
 }catch(e){await p.screenshot({path:path.join(out,'screenshots/failure.png'),fullPage:true});console.error('Browser diagnostics',JSON.stringify({errors}));throw e;}finally{
  if(fs.existsSync(helper))fs.unlinkSync(helper);wp('option','update','ff90_editorial_options','{"enforce":false,"paused":false}','--format=json');wp('option','update','ff90_football_options',JSON.stringify(options.football),'--format=json');
  if(pageId)wp('post','delete',String(pageId),'--force');if(story)wp('post','delete',String(story),'--force');if(image)wp('post','delete',String(image),'--force');if(author)wp('user','delete',String(author),'--yes');
  for(const [key,value] of Object.entries(cache)){if(value===false)wp('eval','delete_transient('+JSON.stringify(key)+');');else wp('transient','set',key,JSON.stringify(value),'86400','--format=json');}
  wp('eval',`global $wpdb;$wpdb->delete($wpdb->prefix.'ff90_football_quota',array('provider'=>'football-data.org','quota_day'=>gmdate('Y-m-d')));$old=json_decode('${oldQuota}',true);if($old)$wpdb->insert($wpdb->prefix.'ff90_football_quota',$old);`);
  wp('option','update','ff90_editorial_options',JSON.stringify(options.editorial),'--format=json');if(wp('option','get','stylesheet')!==options.template)wp('theme','activate',options.template);await b.close();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});

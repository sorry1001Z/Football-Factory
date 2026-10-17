const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const{chromium}=require('/workspace/ff90-tools/browser/node_modules/playwright-core');
const wp=(...a)=>execFileSync('/workspace/ff90-tools/bin/wp',a,{encoding:'utf8'}).trim();
if(!['true','1'].includes(wp('config','get','FF90_QA_SANDBOX')))throw Error('Disposable sandbox required');
const base=wp('option','get','home');if(new URL(base).hostname!=='127.0.0.1')throw Error('Loopback sandbox only');
const out=path.join(__dirname,'../docs/qa');fs.mkdirSync(out,{recursive:true});
const check=(v,m)=>{if(!v)throw Error(m)},results=[];
async function test(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS',name)}
(async()=>{
 const settings=wp('option','get','ff90_seo_settings','--format=json');let id;
 const classicHelper='/workspace/ff90-tools/wordpress/wp-content/mu-plugins/ff90-seo-qa-classic.php';
 if(fs.existsSync(classicHelper))throw Error('Existing QA helper must not be overwritten');
 fs.mkdirSync(path.dirname(classicHelper),{recursive:true});
 fs.writeFileSync(classicHelper,"<?php if (defined('FF90_QA_SANDBOX') && FF90_QA_SANDBOX && isset($_GET['ff90_qa_classic'])) { add_filter('use_block_editor_for_post', '__return_false'); }");
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const c=await b.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage();
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await c.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 try{
  wp('option','update','ff90_seo_settings','{"owner":"advisory","gate":false,"title_h1":true}','--format=json');
  id=Number(wp('post','create','--post_type=post','--post_status=draft','--post_title=QA SEO plugin editor test','--post_content=<p>Local synthetic editor content</p>','--porcelain'));
  const password=fs.readFileSync('/workspace/ff90-tools/install-private.log','utf8').match(/Admin password: (.+)/)[1].trim();
  await p.goto(base+'/wp-login.php');await p.locator('#user_login').fill('ff90qa');await p.locator('#user_pass').fill(password);await Promise.all([p.waitForURL('**/wp-admin/**'),p.locator('#wp-submit').click()]);
  await test('Gutenberg sidebar analyzes unsaved content through authenticated WordPress REST',async()=>{
   await p.goto(base+'/wp-admin/post.php?post='+id+'&action=edit',{waitUntil:'domcontentloaded',timeout:45000});
   await p.waitForFunction(()=>window.wp&&wp.data.select('core/editor')?.getCurrentPostId()>0);

   await p.evaluate(()=>wp.data.dispatch('core/preferences').set('core','welcomeGuide',false));
   const dialog=p.getByRole('dialog');if(await dialog.count()){const close=dialog.getByRole('button',{name:/close|ปิด/i});if(await close.count())await close.first().click();}
   await p.evaluate(()=>{var d=wp.data.dispatch('core/edit-post');if(d&&d.openGeneralSidebar)d.openGeneralSidebar('edit-post/document');});
   const toggle=p.getByRole('button',{name:'FF90 SEO',exact:true});await toggle.waitFor({state:'visible'});if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
   await p.getByText('Score:',{exact:false}).waitFor();
   await p.evaluate(()=>wp.data.dispatch('core/editor').editPost({content:'<h1>Unsaved extra heading</h1><p>ภาษาไทย</p>'}));
   await p.getByText('Blocking: H1_COUNT',{exact:true}).waitFor();
   await p.getByLabel('Meta description',{exact:true}).fill('Description edited in real Gutenberg sidebar');
   await p.getByLabel('Canonical override (optional)',{exact:true}).fill('https://untrusted.example/article');
   await p.getByText(/Blocking: INVALID_CANONICAL, H1_COUNT/).waitFor();
   await p.getByLabel('Canonical override (optional)',{exact:true}).fill('');
   await p.evaluate(()=>wp.data.dispatch('core/editor').editPost({content:'<p>Saved contract body</p>'}));
   await p.evaluate(async()=>{await wp.data.dispatch('core/editor').savePost();});
   check(JSON.parse(wp('post','meta','get',String(id),'_ff90_seo','--format=json')).description==='Description edited in real Gutenberg sidebar','Native meta save failed');
   await p.screenshot({path:path.join(out,'gutenberg-seo.png'),fullPage:true});
  });
  await test('Standalone coordinates Core schema, canonical and description without duplication',async()=>{
   wp('option','update','ff90_seo_settings','{"owner":"standalone","gate":false,"title_h1":true}','--format=json');wp('post','update',String(id),'--post_status=publish');
   const url=wp('eval',`echo get_permalink(${id});`);await p.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   check(await p.locator('link[rel=canonical]').count()===1,'Canonical duplicate');check(await p.locator('meta[name=description]').count()===1,'Description duplicate');
   const nodes=await p.locator('script[type="application/ld+json"]').allTextContents();check(nodes.length===1&&JSON.parse(nodes[0])['@type']==='NewsArticle','Core schema not coordinated');
   check(await p.locator('meta[name=description]').getAttribute('content')==='Description edited in real Gutenberg sidebar','Saved description not rendered');
  });
  await test('News sitemap, robots discovery and native sitemap return real HTTP XML',async()=>{
   for(const route of ['/ff90-news-sitemap.xml','/wp-sitemap.xml']){const r=await c.request.get(base+route);check(r.status()===200,route+' HTTP '+r.status());check((await r.text()).includes('<?xml'),route+' not XML');}
   const xml=await(await c.request.get(base+'/ff90-news-sitemap.xml')).text();check(xml.includes('<news:news>')&&xml.includes(wp('eval',`echo get_permalink(${id});`)),'Recent article missing');
   const robots=await(await c.request.get(base+'/robots.txt')).text();check(robots.includes('/ff90-news-sitemap.xml'),'News sitemap not discoverable');
   check((await c.request.get(base+'/ff90-news-sitemap-9999.xml')).status()===404,'Out-of-range sitemap not 404');
  });
  await test('Settings page saves advisory mode through native nonce-protected Settings API',async()=>{
   await p.goto(base+'/wp-admin/options-general.php?page=ff90-seo',{waitUntil:'domcontentloaded',timeout:45000});
   await p.getByLabel('Metadata owner',{exact:false}).selectOption('advisory');await Promise.all([p.waitForURL('**settings-updated=true'),p.locator('#submit').click()]);
   check(JSON.parse(wp('option','get','ff90_seo_settings','--format=json')).owner==='advisory','Settings not saved');await p.screenshot({path:path.join(out,'seo-settings.png'),fullPage:true});
   check((await c.request.get(base+'/ff90-news-sitemap.xml')).status()===404,'Advisory emitted second news sitemap');
  });
  await test('Classic Editor nonce-protected meta box saves metadata through native post form',async()=>{
   wp('post','update',String(id),'--post_status=draft');
   await p.goto(base+'/wp-admin/post.php?post='+id+'&action=edit&ff90_qa_classic=1',{waitUntil:'domcontentloaded'});
   await p.locator('[name="ff90_seo[description]"]').fill('Classic editor native nonce-protected metadata');
   await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),p.locator('#save-post').click()]);
   check(JSON.parse(wp('post','meta','get',String(id),'_ff90_seo','--format=json')).description==='Classic editor native nonce-protected metadata','Classic meta not saved');
  });
  check(!errors.length,'Browser exceptions: '+errors.join('; '));results.push({name:'No browser exceptions',status:'PASS'});
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({environment:'WordPress 6.9 / PHP 8.4 / SQLite / Chromium; loopback only',results},null,2));
 }catch(e){await p.screenshot({path:path.join(out,'failure.png'),fullPage:true});console.error('UI diagnostics',JSON.stringify({errors,buttons:await p.getByRole('button').allTextContents()}));throw e;}finally{
  wp('option','update','ff90_seo_settings',settings,'--format=json');if(id)wp('post','delete',String(id),'--force');fs.unlinkSync(classicHelper);await b.close();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});

/* Real local WordPress integration tests: no production, fake audience or live ads. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const modules=process.env.FF90_QA_NODE_MODULES||'/workspace/ff90-tools/browser/node_modules';
const{chromium}=require(path.join(modules,'playwright-core'));const Axe=require(path.join(modules,'@axe-core/playwright')).default;
const wp=(...a)=>execFileSync(process.env.FF90_QA_WP||'/workspace/ff90-tools/bin/wp',a,{encoding:'utf8'}).trim();
if(!['1','true'].includes(wp('config','get','FF90_QA_SANDBOX')))throw Error('QA sandbox required');
const base=wp('option','get','home');if(new URL(base).hostname!=='127.0.0.1')throw Error('Local only');
const out=path.join(__dirname,'../docs/qa'),check=(ok,msg)=>{if(!ok)throw Error(msg)};
const results=[];async function test(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS',name)}
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const c=await b.newContext(),p=await c.newPage();
 const ua='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
 const reader=await b.newContext({userAgent:ua}),other=await b.newContext({userAgent:ua}),dnt=await b.newContext({userAgent:ua,extraHTTPHeaders:{DNT:'1'}}),bot=await b.newContext({userAgent:'Googlebot'});
 const slug='ff90-qa-badge-'+Date.now();let post,attachment;const before=wp('eval',"echo wp_json_encode(array('image'=>get_theme_mod('ff90_sale_inline-1_image',0),'url'=>get_theme_mod('ff90_sale_inline-1_url',''),'visible'=>get_theme_mod('ff90_show_sale_slots',true)));"),saved=JSON.parse(before);
 try{
  post=Number(wp('eval',`$cat=get_category_by_slug('preview');echo wp_insert_post(array('post_type'=>'post','post_status'=>'publish','post_name'=>'${slug}','post_title'=>'QA — ทดสอบป้ายข่าวและสถิติ ไม่ใช่ยอดผู้ชมจริง','post_content'=>'<p>ข้อมูลทดสอบใน sandbox เท่านั้น</p>','post_category'=>array($cat->term_id)));`));check(post>0,'Fixture creation failed');
  const total=()=>Number(wp('eval',`global $wpdb;echo (int)$wpdb->get_var("SELECT COALESCE(SUM(views),0) FROM {$wpdb->prefix}ff90_views_daily WHERE post_id=${post}");`));
  await test('NEW works with zero audience and no invented HOT/BEST',async()=>{
   await p.goto(base+'/'+slug+'/',{waitUntil:'networkidle'});check(await p.locator('article .badge-new').count()===1,'Fresh NEW missing');check(await p.locator('article .badge-hot,article .badge-best').count()===0,'Popularity fabricated');check(total()===0,'Headless QA request counted as audience');
  });
  await test('Real request counted once; same browser refresh deduplicated',async()=>{
   check((await reader.request.get(base+'/'+slug+'/')).status()===200,'Reader request failed');check(total()===1,'First request not counted');await reader.request.get(base+'/'+slug+'/');check(total()===1,'Refresh inflated views');const cookies=await reader.cookies();const cookie=cookies.find(x=>x.name==='ff90_reader');check(cookie&&cookie.httpOnly&&cookie.sameSite==='Lax','Tracking cookie missing safe flags');
  });
  await test('Second reader counted; DNT/bot/HEAD excluded',async()=>{
   await other.request.get(base+'/'+slug+'/');check(total()===2,'Second browser not counted');await dnt.request.get(base+'/'+slug+'/');await bot.request.get(base+'/'+slug+'/');await reader.request.head(base+'/'+slug+'/');check(total()===2,'DNT, bot or HEAD counted');
  });
  await test('HOT/BEST follow recorded events; category menu ribbon uses same source',async()=>{
   await p.goto(base+'/'+slug+'/',{waitUntil:'networkidle'});check(await p.locator('article .badge-hot').count()===1,'HOT missing');check(await p.locator('article .badge-best').count()===1,'BEST missing');await p.goto(base+'/',{waitUntil:'networkidle'});check(await p.locator('#primary-menu .badge-hot').count()>0,'Menu popularity ribbon missing');
  });
  await test('Contact email, distinct contact menu, social icons without fake links',async()=>{
   await p.goto(base+'/contact/',{waitUntil:'networkidle'});check(await p.locator('main a[href="mailto:rom2001th@gmail.com"]').count()===1,'Contact email missing');check(await p.locator('#primary-menu a').filter({hasText:'ติดต่อเรา'}).count()===1,'Contact menu missing/duplicated');check(await p.locator('.utility .ff90-social-placeholder').count()===3,'Expected three social placeholders');check(await p.locator('.ff90-social-links a').count()===0,'Invented social link');check(await p.locator('#primary-menu > ul > li > a').evaluateAll(a=>a.every(x=>x.querySelector('svg')?.getAttribute('aria-hidden')==='true')),'Menu icons not decorative accessible SVG');
  });
  for(const layout of ['main-v2','colormag-01'])for(const width of [360,390,768,1024,1440])await test(`${layout} ${width}px ads + icons + badges`,async()=>{
   wp('theme','mod','set','ff90_home_layout',layout);await p.setViewportSize({width,height:1000});await p.goto(base+'/',{waitUntil:'networkidle'});
   check(await p.locator('[data-ad-slot]').count()===3,'Expected exactly three sale slots');
   check(await p.locator('[data-ad-slot="header"]').count()===1,'Header sale slot missing');
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
   if(width>1024){const x=await p.locator('.masthead .identity').boundingBox(),y=await p.locator('.masthead-sale').boundingBox();check(y.x>=x.x+x.width,'Header sale banner overlaps logo');}
   const axe=await new Axe({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();check(axe.violations.length===0,JSON.stringify(axe.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)}))));
   if(layout==='colormag-01'&&[390,1440].includes(width))await p.screenshot({path:path.join(out,'screenshots',`editorial-features-${width}.png`),fullPage:true});
  });
  await test('Native media picker and Publish configure sale banner without code',async()=>{
   attachment=Number(wp('media','import','/workspace/ff90-tools/fixtures/qa-sale-banner.png','--title=FF90 synthetic QA advertisement','--alt=Synthetic QA advertisement','--porcelain'));
   const password=fs.readFileSync('/workspace/ff90-tools/install-private.log','utf8').match(/Admin password: (.+)/)?.[1]?.trim();check(password,'Sandbox password unavailable');
   await p.goto(base+'/wp-login.php',{waitUntil:'networkidle'});await p.locator('#user_login').fill('ff90qa');await p.locator('#user_pass').fill(password);await Promise.all([p.waitForURL('**/wp-admin/**'),p.locator('#wp-submit').click()]);
   await p.goto(base+'/wp-admin/customize.php',{waitUntil:'networkidle'});await p.locator('#accordion-section-ff90_banner_sale .accordion-section-title').click();
   check(await p.locator('#sub-accordion-section-ff90_banner_sale .customize-control-media').count()===3,'Expected three media controls');
   await p.locator('#customize-control-ff90_sale_inline-1_image .upload-button').click();
   const library=p.locator('.media-modal #menu-item-browse');if(await library.isVisible())await library.click();
   const item=p.locator(`.media-modal .attachment[data-id="${attachment}"]`);await item.waitFor();await item.click();await p.locator('.media-modal .media-button-select').click();
   await p.locator('#customize-control-ff90_sale_inline-1_url input').fill('https://example.org/?ff90-qa=advertisement');await p.locator('#customize-control-ff90_sale_inline-1_url input').press('Tab');
   const response=p.waitForResponse(r=>r.url().includes('admin-ajax.php')&&(r.request().postData()||'').includes('action=customize_save'));await p.locator('#save').click();check((await (await response).json()).success===true,'Customizer save failed');
   check(Number(wp('eval',"echo get_theme_mod('ff90_sale_inline-1_image');"))===attachment,'Media ID not saved');
   await p.screenshot({path:path.join(out,'screenshots','banner-sale-admin.png'),fullPage:true});
   await p.goto(base+'/',{waitUntil:'networkidle'});const ad=p.locator('[data-ad-slot="inline-1"]');check(await ad.locator('img.sale-creative').count()===1,'Configured creative missing');check((await ad.locator('a').getAttribute('rel')).includes('sponsored'),'Ad link not marked sponsored');await ad.locator('img').evaluate(i=>i.loading='eager');await p.waitForFunction(()=>{const i=document.querySelector('[data-ad-slot="inline-1"] img');return i&&i.complete&&i.naturalWidth>0;});const size=await ad.locator('img').evaluate(i=>({w:i.naturalWidth,h:i.naturalHeight,fit:getComputedStyle(i).objectFit,ratio:i.getBoundingClientRect().width/i.getBoundingClientRect().height}));check(size.w>0&&size.h>0&&Math.abs(size.ratio-970/120)<.05&&size.fit==='contain','Ad image distorted/cropped '+JSON.stringify(size));
  });
  await test('Statistics module deactivation keeps theme and time-based NEW working',async()=>{
   try{wp('plugin','deactivate','ff90-news-insights');await p.goto(base+'/'+slug+'/',{waitUntil:'networkidle'});check(await p.locator('article .badge-new').count()===1,'NEW fallback broken');check(await p.locator('article .badge-hot,article .badge-best').count()===0,'Popularity shown without source');}finally{wp('plugin','activate','ff90-news-insights');}check(total()===2,'Reactivation lost recorded totals');
  });
 }finally{
  wp('theme','mod','set','ff90_sale_inline-1_image',String(saved.image));wp('theme','mod','set','ff90_sale_inline-1_url',String(saved.url));wp('theme','mod','set','ff90_show_sale_slots',saved.visible?'1':'0');wp('theme','mod','set','ff90_home_layout','colormag-01');
  if(post){wp('eval',`global $wpdb;$wpdb->delete($wpdb->prefix.'ff90_views_daily',array('post_id'=>${post}));wp_delete_post(${post},true);`);}if(attachment)wp('post','delete',String(attachment),'--force');
  fs.writeFileSync(path.join(out,'editorial-results.json'),JSON.stringify({scope:'Disposable local WordPress; synthetic QA story and test request events, not audience claims',results},null,2));await b.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});

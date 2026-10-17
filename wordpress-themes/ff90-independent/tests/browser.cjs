/* Real WordPress/Chromium QA. Run only against the explicitly marked local sandbox. */
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const modules = process.env.FF90_QA_NODE_MODULES || '/workspace/ff90-tools/browser/node_modules';
const {chromium} = require(path.join(modules, 'playwright-core'));
const AxeBuilder = require(path.join(modules, '@axe-core/playwright')).default;
const wpBinary = process.env.FF90_QA_WP || '/workspace/ff90-tools/bin/wp';
const wp = (...args) => execFileSync(wpBinary, args, {encoding:'utf8'}).trim();
if (!['true','1'].includes(wp('config','get','FF90_QA_SANDBOX'))) throw Error('Sandbox marker required');
const base = wp('option','get','home');
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw Error('Local sandbox only');
const output = path.join(__dirname, '../docs/qa');
fs.mkdirSync(path.join(output,'screenshots'),{recursive:true});
const results = [];
const failures = [];
const check = (condition, message) => { if (!condition) throw Error(message); };
async function test(name, fn) { try { const detail = await fn(); results.push({name,status:'PASS',detail}); console.log('PASS',name); } catch(e) { results.push({name,status:'FAIL',detail:e.message}); failures.push(name); console.error('FAIL',name,e.message); } }
async function screenshot(page, name) { await page.screenshot({path:path.join(output,'screenshots',name+'.png'),fullPage:true,animations:'disabled'}); }
async function documentChecks(page) {
  await page.locator('.card-image img').evaluateAll(imgs=>{for(const i of imgs)i.loading='eager';});
  await page.waitForFunction(()=>[...document.querySelectorAll('.card-image img')].every(i=>i.complete&&i.naturalWidth>0));
  const info = await page.evaluate(() => ({
    width:innerWidth, scroll:document.documentElement.scrollWidth,
    h1:document.querySelectorAll('main h1').length,
    text:document.querySelector('main')?.innerText,
    images:[...document.querySelectorAll('.card-image img')].map(i=>({complete:i.complete,width:i.naturalWidth,fit:getComputedStyle(i).objectFit})),
    schemaKeys:[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>{
      const d=JSON.parse(s.textContent);return (d['@graph']||[d]).filter(x=>x['@type']).map(x=>x['@id']||`${x['@type']}|${x.url||x.name||''}`);
    }),
    canonicals:document.querySelectorAll('link[rel="canonical"]').length,
    schema:document.querySelectorAll('script[type="application/ld+json"]').length
  }));
  check(info.scroll <= info.width, `Overflow: ${info.scroll} > ${info.width}`);
  check(info.h1 === 1, `Expected one main h1, got ${info.h1}`);
  check(!info.text.includes('FF90_NEVER_SHOW_DRAFT'), 'Draft content leaked');
  check(info.images.every(i=>i.complete && i.width>0 && i.fit==='contain'),'Banner image incomplete/cropped');
  check(info.canonicals <= 1,'Duplicate canonical');
  check(new Set(info.schemaKeys).size===info.schemaKeys.length,'Duplicate JSON-LD entity');
  return info;
}
(async()=>{
  const browser = await chromium.launch({executablePath:process.env.FF90_QA_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context = await browser.newContext({viewport:{width:1440,height:1000},locale:'th-TH',reducedMotion:'reduce'});
  await context.route('**/*', route=> ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  const page = await context.newPage();
  const errors=[];page.on('pageerror', e=>errors.push(e.message));
  try {
    for (const layout of ['main-v2','colormag-01']) {
      wp('theme','mod','set','ff90_home_layout',layout);
      for (const width of [360,390,768,1024,1440]) {
        await test(`${layout} ${width}px responsive + axe`,async()=>{
          await page.setViewportSize({width,height:1000});
          const r=await page.goto(base+'/',{waitUntil:'networkidle'});
          check(r.status()===200,'Homepage HTTP '+r.status());
          check(await page.locator('main.layout-'+layout).count()===1,'Wrong homepage layout');
          await page.locator('.card-image img').evaluateAll(imgs=>{ for(const i of imgs) i.loading='eager'; });
          await page.waitForFunction(()=>[...document.querySelectorAll('.card-image img')].every(i=>i.complete&&i.naturalWidth>0));
          const info=await documentChecks(page);
          if(width<=1024) {
            const toggle=page.locator('.menu-toggle');
            check(await toggle.isVisible(),'Mobile menu button hidden');
            await toggle.click();check(await toggle.getAttribute('aria-expanded')==='true','Menu not expanded');
            check(await page.locator('#primary-menu').isVisible(),'Menu invisible');
            await page.keyboard.press('Escape');check(await toggle.getAttribute('aria-expanded')==='false','Escape did not close menu');
            check(await toggle.evaluate(e=>document.activeElement===e),'Escape did not restore focus');
          }
          const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
          await screenshot(page,layout+'-'+width);
          check(axe.violations.length===0,JSON.stringify(axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))));
          return {width,images:info.images.length,axeViolations:axe.violations.length};
        });
      }
    }
    for (const width of [390,1440]) {
      await test(`dark mode ${width}px axe + persistence`,async()=>{
        await page.setViewportSize({width,height:1000});await page.goto(base+'/',{waitUntil:'networkidle'});
        await page.locator('.mode-toggle').click();
        check(await page.locator('html').getAttribute('data-color-mode')==='dark','Dark not active');
        await page.reload({waitUntil:'networkidle'});
        check(await page.locator('.mode-toggle').getAttribute('aria-pressed')==='true','Dark preference lost');
        const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
        await screenshot(page,'dark-'+width);check(axe.violations.length===0,JSON.stringify(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
        await page.locator('.mode-toggle').click();
      });
    }
    for (const width of [390,1440]) for (const [name,url,status] of [
      ['article','/ff90-qa-general/',200],['category','/category/general/',200],['search','/?s=FF90',200],['search-empty','/?s=NO_MATCH_ff90_551',200],['not-found','/no-such-ff90-article/',404],['author','/?author=1',200]
    ]) await test(`${name} ${width}px`,async()=>{
      await page.setViewportSize({width,height:1000});const r=await page.goto(base+url,{waitUntil:'networkidle'});check(r.status()===status,'Unexpected HTTP '+r.status());
      const info=await documentChecks(page);const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      await screenshot(page,`${name}-${width}`);check(axe.violations.length===0,JSON.stringify(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
      if(name==='article')check(info.canonicals===1,'Native article canonical missing');return {http:r.status(),axeViolations:axe.violations.length};
    });
    await test('13 banner classes and full image frames',async()=>{
      for(const kind of 'general breaking transfer preview result standings stats tactics team competition infographic youth feature'.split(' ')) {
        await page.goto(`${base}/ff90-qa-${kind}/`,{waitUntil:'networkidle'});
        check(await page.locator(`article.banner-${kind}`).count()===1,'Missing '+kind+' class');
        const image=page.locator('.article-featured img');
        const info=await image.evaluate(i=>({w:i.naturalWidth,h:i.naturalHeight,r:i.getBoundingClientRect().width/i.getBoundingClientRect().height}));
        check(info.w===1280&&info.h===720&&Math.abs(info.r-16/9)<0.01,kind+' image distorted');
      }
    });
    await test('Core plugin off / on fallback regression',async()=>{
      try {
        wp('plugin','deactivate','football-factory-core');
        for(const layout of ['main-v2','colormag-01']){
          wp('theme','mod','set','ff90_home_layout',layout);const r=await page.goto(base+'/',{waitUntil:'networkidle'});check(r.status()===200,'Core-off fatal');
          check((await page.locator('.fixture-content').innerText()).includes('ยังไม่มีข้อมูล'),'No honest football fallback');await documentChecks(page);
        }
      } finally {wp('plugin','activate','football-factory-core');}
      check((await page.goto(base+'/',{waitUntil:'networkidle'})).status()===200,'Core reactivation failure');
    });
    await test('Optional renderer / SEO / analytics hook probe (TEST DOUBLE)',async()=>{
      try {
        wp('plugin','activate','ff90-qa-probe');
        await page.goto(base+'/?ff90_date=2026-10-18',{waitUntil:'networkidle'});
        check(await page.locator('#ff90-qa-fixtures').getAttribute('data-date')==='2026-10-18','Fixture date contract mismatch');
        check(await page.locator('#ff90-qa-results').count()===1,'Results hook missing');
        check(await page.locator('#ff90-qa-standings').count()===1,'Standings hook missing');
        check(await page.locator('#ff90-qa-schema').count()===1,'SEO hook double missing');
        check(await page.evaluate(()=>window.ff90QaAnalyticsLoaded===true),'Analytics footer hook missing');
        await page.goto(base+'/ff90-qa-general/',{waitUntil:'networkidle'});
        check(await page.locator('link[rel=canonical]').count()===1,'Canonical collision with double');
      } finally { wp('plugin','deactivate','ff90-qa-probe'); }
      await page.goto(base+'/',{waitUntil:'networkidle'});
      check(await page.locator('#ff90-qa-fixtures').count()===0,'Probe retained after deactivation');
    });
    await test('Date navigation ISO / invalid / injection',async()=>{
      await page.goto(base+'/?ff90_date=2026-10-18',{waitUntil:'networkidle'});
      check(await page.locator('.fixture-content time').getAttribute('datetime')==='2026-10-18','Date not selected');
      check((await page.locator('.fixture-nav a').first().getAttribute('href')).includes('2026-10-17'),'Previous day incorrect');
      check((await page.locator('.fixture-nav a').last().getAttribute('href')).includes('2026-10-19'),'Next day incorrect');
      await page.goto(base+'/?ff90_date='+encodeURIComponent('<script>window.__FF90_XSS=true</script>'),{waitUntil:'networkidle'});
      check(!(await page.evaluate(()=>window.__FF90_XSS)),'XSS executed');await documentChecks(page);
    });
    await test('Customizer UI layout switch and persistence',async()=>{
      const log=fs.readFileSync('/workspace/ff90-tools/install-private.log','utf8');
      const password=log.match(/Admin password: (.+)/)?.[1]?.trim();check(password,'Private sandbox credential unavailable');
      await page.goto(base+'/wp-login.php',{waitUntil:'networkidle'});await page.locator('#user_login').fill('ff90qa');await page.locator('#user_pass').fill(password);
      await Promise.all([page.waitForURL('**/wp-admin/**'),page.locator('#wp-submit').click()]);
      await page.goto(base+'/wp-admin/customize.php',{waitUntil:'networkidle'});
      await page.locator('#accordion-section-ff90_homepage .accordion-section-title').click();
      const select=page.locator('#customize-control-ff90_home_layout select');await select.waitFor();
      for(const layout of ['main-v2','colormag-01']){
        await select.selectOption(layout);
        const savedResponse=page.waitForResponse(r=>r.url().includes('admin-ajax.php')&&(r.request().postData()||'').includes('action=customize_save'));
        await page.locator('#save').click();
        const saveResult=await (await savedResponse).json();
        check(saveResult.success===true,'Customizer rejected save');
        await page.waitForFunction(()=>document.querySelector('#save')?.disabled,{timeout:20000});
        check(wp('eval', "echo get_theme_mod('ff90_home_layout');")===layout,'Customizer save failed '+layout);
      }
      await screenshot(page,'customizer-layout-switcher');
    });
    await test('Customizer rejects missing nonce',async()=>{
      const initial=wp('eval',"echo get_theme_mod('ff90_home_layout');");
      const r=await page.request.post(base+'/wp-admin/admin-ajax.php',{form:{action:'customize_save',wp_customize:'on',theme:'ff90-independent',customized:'{"ff90_home_layout":"main-v2"}'}});
      const body=await r.text();check(r.status()>=400||!body.includes('"success":true'),'Missing nonce accepted');
      check(wp('eval',"echo get_theme_mod('ff90_home_layout');")===initial,'Unauthorized setting write');
    });
    await test('No-JavaScript navigation fallback',async()=>{
      const c=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
      try {const p=await c.newPage();await p.goto(base+'/');check(await p.locator('#primary-menu').isVisible(),'No-JS nav inaccessible');check(await p.locator('#primary-menu a').first().isVisible(),'No-JS links hidden');}finally{await c.close();}
    });
    await test('No browser runtime exceptions',async()=>check(errors.length===0,JSON.stringify(errors)));
  } finally {
    wp('theme','mod','set','ff90_home_layout','colormag-01');
    fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({environment:{themeVersion:wp('eval',"echo wp_get_theme()->get('Version');"),wordpress:wp('core','version'),php:'8.4.24',database:'SQLite (local only)',browser:'system Chromium',fixture:'Synthetic QA content; not live football news'},results,failed:failures},null,2));
    await browser.close();
  }
  if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

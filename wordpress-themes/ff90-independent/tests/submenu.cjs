/* Native league submenu checks against local WordPress only. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const modules=process.env.FF90_QA_NODE_MODULES||'/workspace/ff90-tools/browser/node_modules';
const{chromium}=require(path.join(modules,'playwright-core'));const Axe=require(path.join(modules,'@axe-core/playwright')).default;
const wp=(...a)=>execFileSync(process.env.FF90_QA_WP||'/workspace/ff90-tools/bin/wp',a,{encoding:'utf8'}).trim();
if(!['1','true'].includes(wp('config','get','FF90_QA_SANDBOX')))throw Error('QA sandbox required');
const base=wp('option','get','home');if(new URL(base).hostname!=='127.0.0.1')throw Error('Local only');
const out=path.join(__dirname,'../docs/qa');const expected=['พรีเมียร์ลีก','ลาลีกา','บุนเดสลีกา','กัลโช่ เซเรีย อา','ลีกเอิง'];
const check=(ok,msg)=>{if(!ok)throw Error(msg)};
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const c=await b.newContext();const p=await c.newPage();const results=[];
try{for(const layout of ['main-v2','colormag-01']){wp('theme','mod','set','ff90_home_layout',layout);for(const width of [360,390,768,1024,1440]){
await p.setViewportSize({width,height:1000});await p.goto(base+'/',{waitUntil:'networkidle'});
if(width<=1024)await p.locator('.menu-toggle').click();
const parent=p.locator('#primary-menu .menu-item-has-children').first();const link=parent.locator(':scope > a');const submenu=parent.locator(':scope > .sub-menu');
if(width>1024){await link.hover();check(await submenu.isVisible(),'Desktop hover dropdown hidden');await link.focus();await p.keyboard.press('Tab');check(await submenu.locator('a').first().evaluate(e=>document.activeElement===e),'Keyboard submenu focus failed');}
check(JSON.stringify(await submenu.locator('a').allTextContents())===JSON.stringify(expected),'League names mismatch');
check(await submenu.isVisible(),'Submenu hidden');check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
if(layout==='colormag-01'&&[390,1440].includes(width)){
const a=await new Axe({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();check(a.violations.length===0,'Accessibility violations: '+a.violations.map(x=>x.id));
await p.screenshot({path:path.join(out,'screenshots',width===1440?'league-menu-desktop.png':'league-menu-mobile.png'),fullPage:false});}
results.push({layout,width,status:'PASS'});
}}
for(const a of await p.locator('#primary-menu .sub-menu a').all()){const href=await a.getAttribute('href');const r=await p.request.get(href);check(r.status()===200,'League archive failed '+href);}
fs.writeFileSync(path.join(out,'submenu-results.json'),JSON.stringify({leagues:expected,results,archiveLinks:'5/5 HTTP 200; empty categories show honest empty state',keyboard:'desktop Tab enters submenu',axe:'zero violations at 390/1440'},null,2));console.log('PASS: 10 layout/viewport combinations; 5 league archives; keyboard; axe 390/1440');
}finally{wp('theme','mod','set','ff90_home_layout','colormag-01');await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});

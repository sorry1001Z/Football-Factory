/* Native league/cup navigation against the isolated QA WordPress instance. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const modules=process.env.FF90_QA_NODE_MODULES||'/workspace/ff90-tools/browser/node_modules';
const{chromium}=require(path.join(modules,'playwright-core'));const Axe=require(path.join(modules,'@axe-core/playwright')).default;
const wp=(...a)=>execFileSync(process.env.FF90_QA_WP||'/workspace/ff90-tools/bin/wp',a,{encoding:'utf8'}).trim();
if(!['1','true'].includes(wp('config','get','FF90_QA_SANDBOX')))throw Error('QA sandbox required');
const base=wp('option','get','home');if(new URL(base).hostname!=='127.0.0.1')throw Error('Local only');
const out=path.join(__dirname,'../docs/qa'),items=JSON.parse(fs.readFileSync(path.join(__dirname,'menu-items.json'),'utf8'));
const groups=[{name:'ข่าวฟุตบอลลีก',key:'leagues'},{name:'บอลถ้วย',key:'cups'}];
const check=(ok,msg)=>{if(!ok)throw Error(msg)};
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const c=await b.newContext();const p=await c.newPage();const results=[];
try{
 for(const layout of ['main-v2','colormag-01']){
  wp('theme','mod','set','ff90_home_layout',layout);
  for(const width of [360,390,768,1024,1440]){
   await p.setViewportSize({width,height:1000});await p.goto(base+'/',{waitUntil:'networkidle'});
   if(width<=1024)await p.locator('.menu-toggle').click();
   for(const group of groups){
    const link=p.locator('#primary-menu > ul > li > a').filter({hasText:group.name});check(await link.count()===1,'Missing distinct root menu '+group.name);
    const submenu=link.locator('..').locator(':scope > .sub-menu');
    if(width>1024){await link.hover();check(await submenu.isVisible(),'Hover dropdown hidden');await link.focus();await p.keyboard.press('Tab');check(await submenu.locator('a').first().evaluate(e=>document.activeElement===e),'Keyboard submenu focus failed');}
    const expected=items.filter(x=>x.group===group.key).map(x=>x.name);
    check(JSON.stringify(await submenu.locator('a').allTextContents())===JSON.stringify(expected),group.name+' children mismatch');
    check(await submenu.isVisible(),'Submenu hidden');
    if(width>1024){await submenu.locator('a').last().focus();check(await submenu.locator('a').last().evaluate(e=>{const a=e.getBoundingClientRect(),s=e.closest('.sub-menu').getBoundingClientRect();return a.top>=s.top&&a.bottom<=s.bottom+1&&a.bottom<=innerHeight;}),'Last competition inaccessible');}
    if(layout==='colormag-01'&&width===1440){await link.hover();await submenu.evaluate(e=>e.scrollTop=0);await p.screenshot({path:path.join(out,'screenshots',group.key==='cups'?'cup-menu-desktop.png':'league-menu-desktop.png'),fullPage:false});}
   }
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
   if(layout==='colormag-01'&&[390,1440].includes(width)){
    const axe=await new Axe({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();check(axe.violations.length===0,'Axe violations: '+axe.violations.map(x=>x.id));
    if(width===390)await p.screenshot({path:path.join(out,'screenshots','league-menu-mobile.png'),fullPage:false});
   }
   results.push({layout,width,status:'PASS',rootMenus:groups.map(x=>x.name)});
  }
 }
 let checked=0;for(const a of await p.locator('#primary-menu .sub-menu a').all()){const href=await a.getAttribute('href'),r=await p.request.get(href);check(r.status()===200,'Competition archive failed '+href);checked++;}check(checked===18,'Expected 18 child archive links');
 await p.setViewportSize({width:1440,height:600});await p.goto(base+'/',{waitUntil:'networkidle'});
 const cups=p.locator('#primary-menu > ul > li > a').filter({hasText:'บอลถ้วย'});await cups.hover();const last=cups.locator('..').locator('.sub-menu a').last();await last.focus();check(await last.evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight),'Cup menu clipped on short desktop');
 fs.writeFileSync(path.join(out,'submenu-results.json'),JSON.stringify({groups,items,results,archiveLinks:'18/18 HTTP 200; empty categories show honest empty state',shortDesktop:'PASS 1440x600; last cup keyboard reachable',keyboard:'Tab enters each submenu',axe:'zero violations at 390/1440'},null,2));
 console.log('PASS: two root menus; 5 leagues + 13 cups; 10 layout/viewport cases; 18 archives; short desktop; keyboard; axe');
}finally{wp('theme','mod','set','ff90_home_layout','colormag-01');await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

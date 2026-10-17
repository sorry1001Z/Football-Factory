/* Local WordPress empty/news/image/security edge cases. Never use on production. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const modules=process.env.FF90_QA_NODE_MODULES||'/workspace/ff90-tools/browser/node_modules';
const{chromium}=require(path.join(modules,'playwright-core'));
const Axe=require(path.join(modules,'@axe-core/playwright')).default;
const wp=(...args)=>execFileSync(process.env.FF90_QA_WP||'/workspace/ff90-tools/bin/wp',args,{encoding:'utf8'}).trim();
if(!['true','1'].includes(wp('config','get','FF90_QA_SANDBOX')))throw Error('Sandbox required');
const base=wp('option','get','home');if(new URL(base).hostname!=='127.0.0.1')throw Error('Local sandbox required');
const out=path.join(__dirname,'../docs/qa');
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await context.newPage();
 const ids=wp('post','list','--post_type=post','--post_status=publish','--field=ID').split(/\s+/).filter(Boolean);
 let tempId;const results=[];
 try{
  try{
   wp('post','update',...ids,'--post_status=draft');
   for(const layout of ['main-v2','colormag-01']){
    wp('theme','mod','set','ff90_home_layout',layout);
    const r=await p.goto(base+'/',{waitUntil:'networkidle'});assert(r.status()===200,'Empty homepage failed');
    assert(await p.locator('.empty-state').count()===1,'Empty state missing');
    assert(await p.locator('.breaking-strip').count()===0,'Fake breaking news on empty site');
    assert(await p.locator('.news-card').count()===0,'Drafts visible');
    const axe=await new Axe({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert(axe.violations.length===0,'Empty state accessibility');
    await p.screenshot({path:path.join(out,'screenshots','empty-'+layout+'-390.png'),fullPage:true});
    results.push({name:layout+' empty homepage',status:'PASS'});
   }
  }finally{wp('post','update',...ids,'--post_status=publish');}
  tempId=wp('post','create','--post_type=post','--post_status=publish','--post_title=FF90 QA — article without featured media','--post_content=<p>Synthetic test only.</p>','--post_name=ff90-qa-no-image','--porcelain');
  await p.goto(base+'/',{waitUntil:'networkidle'});assert(await p.locator('.image-placeholder').count()>0,'No-image placeholder missing');
  await p.goto(base+'/ff90-qa-no-image/',{waitUntil:'networkidle'});assert(await p.locator('article h1').count()===1,'No-image article failed');
  assert(await p.locator('.article-featured').count()===0,'Fake image emitted');
  await p.screenshot({path:path.join(out,'screenshots','no-image-390.png'),fullPage:true});results.push({name:'Native article without featured media',status:'PASS'});
  await p.goto(base+'/?s='+encodeURIComponent('<script>window.__FF90_XSS=true</script>'),{waitUntil:'networkidle'});
  assert(!await p.evaluate(()=>window.__FF90_XSS),'Search XSS');results.push({name:'Search input script remains inert',status:'PASS'});
 }finally{
  if(tempId)wp('post','delete',tempId,'--force');
  wp('theme','mod','set','ff90_home_layout','colormag-01');
  fs.writeFileSync(path.join(out,'edge-results.json'),JSON.stringify({results},null,2));await b.close();
 }
 console.log(results);
})().catch(e=>{console.error(e);process.exitCode=1});

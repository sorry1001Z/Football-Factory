/* Real local WP SEO collision checks; actual SEO Growth V4 is not supplied. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const wp=(...a)=>execFileSync(process.env.FF90_QA_WP||'/workspace/ff90-tools/bin/wp',a,{encoding:'utf8'}).trim();
const{chromium}=require(path.join(process.env.FF90_QA_NODE_MODULES||'/workspace/ff90-tools/browser/node_modules','playwright-core'));
if(!['true','1'].includes(wp('config','get','FF90_QA_SANDBOX')))throw Error('Sandbox required');
const base=wp('option','get','home');if(new URL(base).hostname!=='127.0.0.1')throw Error('Local only');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const c=await b.newContext(),p=await c.newPage();const results=[];
 try{
  for(const layout of ['main-v2','colormag-01']){
   wp('theme','mod','set','ff90_home_layout',layout);
   for(const route of ['/','/ff90-qa-general/','/category/general/','/?s=FF90']){
    await p.goto(base+route,{waitUntil:'networkidle'});
    const r=await p.evaluate(()=>{
     const entities=[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>{const d=JSON.parse(s.textContent);return d['@graph']||[d]});
     return{title:document.querySelectorAll('head title').length,canonical:document.querySelectorAll('link[rel=canonical]').length,description:document.querySelectorAll('meta[name=description]').length,keys:entities.filter(e=>e['@type']).map(e=>e['@id']||`${e['@type']}|${e.url||e.name||''}`)};
    });
    if(r.title!==1||r.canonical>1||r.description>1||new Set(r.keys).size!==r.keys.length)throw Error('SEO collision '+layout+route);
    if(route==='/ff90-qa-general/'&&r.canonical!==1)throw Error('Article canonical missing');
    results.push({layout,route,status:'PASS',...r});
   }
  }
 }finally{wp('theme','mod','set','ff90_home_layout','colormag-01');await b.close();}
 fs.writeFileSync(path.join(__dirname,'../docs/qa/seo-results.json'),JSON.stringify({scope:'Native WordPress + existing FF90 Core only; SEO Growth V4 NOT_RUN',results},null,2));console.log(results.length+' SEO document checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});

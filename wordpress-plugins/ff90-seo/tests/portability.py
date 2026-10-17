#!/usr/bin/env python3
"""Real unrelated-theme check, local disposable WordPress only; restores theme/options."""
from pathlib import Path
import os,subprocess,json,urllib.request,re
wp=os.environ.get('FF90_QA_WP','/workspace/ff90-tools/bin/wp')
def call(*args):return subprocess.check_output([wp,*args],text=True).strip()
assert call('config','get','FF90_QA_SANDBOX') in ['true','1']
assert call('option','get','home').startswith('http://127.0.0.1:')
old=call('option','get','ff90_seo_settings','--format=json');theme=call('option','get','stylesheet')
try:
    call('option','update','ff90_seo_settings','{"owner":"standalone","gate":false,"title_h1":true}','--format=json')
    post=call('post','list','--post_type=post','--post_status=publish','--posts_per_page=1','--format=ids')
    url=call('eval',f'echo get_permalink({int(post)});')
    call('theme','activate','twentytwentyfive')
    html=urllib.request.urlopen(url,timeout=20).read().decode()
    assert len(re.findall(r'<link[^>]+rel=[\'\"]canonical',html))==1
    assert len(re.findall(r'<meta[^>]+name=[\'\"]description',html))==1
    nodes=re.findall(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',html,re.S)
    assert len(nodes)==1 and json.loads(nodes[0])['@type']=='NewsArticle'
    out=Path(__file__).resolve().parents[1]/'docs/qa/portability.json'
    out.write_text(json.dumps({'plugin_version':'0.2.0','status':'PASS','theme':'twentytwentyfive','checks':['one canonical','one description','one NewsArticle schema','Core schema coordinated'],'scope':'local sandbox'},indent=2)+'\n')
    print('PASS unrelated Twenty Twenty-Five theme metadata output')
finally:
    call('theme','activate',theme)
    call('option','update','ff90_seo_settings',old,'--format=json')

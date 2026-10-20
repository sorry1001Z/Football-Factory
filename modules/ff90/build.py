#!/usr/bin/env python3
"""Build independent WordPress module packages with allowlisted runtime directories only."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib,re,json
root=Path(__file__).resolve().parents[2]
result=[]
for slug in ['ff90-seo', 'ff90-seo-football', 'ff90-seo-gsc', 'ff90-security', 'ff90-content-qa', 'ff90-editorial-approval', 'ff90-football-data', 'ff90-football-widgets', 'ff90-image-registry', 'ff90-banner-renderer', 'ff90-automation-bridge', 'ff90-operations', 'ff90-content-image-automation']:
    plugin=root/'wordpress-plugins'/slug
    version=re.search(r'^ \* Version: ([\d.]+)$',(plugin/(slug+'.php')).read_text(),re.M).group(1)
    files=[plugin/(slug+'.php'),plugin/'readme.txt',plugin/'LICENSE']
    for directory,extension in [('includes','*.php'),('assets','*.js'),('data','*.json')]:
        files+=sorted((plugin/directory).glob(extension))
    archive=plugin/'dist'/f'{slug}-{version}.zip';archive.parent.mkdir(exist_ok=True)
    with ZipFile(archive,'w',ZIP_DEFLATED) as z:
        for f in files:
            info=ZipInfo(slug+'/'+f.relative_to(plugin).as_posix(),(2026,10,18,0,0,0));info.external_attr=0o100644<<16;info.compress_type=ZIP_DEFLATED
            z.writestr(info,f.read_bytes())
    with ZipFile(archive) as z:
        assert z.testzip() is None and len(z.namelist())==len(files)
        assert not any('/tests/' in name or '/docs/' in name for name in z.namelist())
    digest=hashlib.sha256(archive.read_bytes()).hexdigest();archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n')
    result.append({'plugin':slug,'version':version,'files':len(files),'sha256':digest})
    print(archive, digest)
(root/'modules/ff90/docs/qa').mkdir(parents=True,exist_ok=True)
(root/'modules/ff90/docs/qa/package-results.json').write_text(json.dumps(result,indent=2)+'\n')

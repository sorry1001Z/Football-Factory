#!/usr/bin/env python3
"""After build.py, collect the nine new plugin ZIPs and operator/QA docs."""
from pathlib import Path
from zipfile import ZipFile,ZipInfo,ZIP_DEFLATED
import hashlib,json
root=Path(__file__).resolve().parents[2]
manifest=json.loads((root/'modules/ff90/docs/qa/package-results.json').read_text())
plugins=[e for e in manifest if e['plugin'] not in ['ff90-seo','ff90-seo-football','ff90-seo-gsc']]
assert len(plugins)==9
out=root/'modules/ff90/dist';out.mkdir(exist_ok=True)
bundle=out/'ff90-modules-B-to-L-0.1.0.zip'
with ZipFile(bundle,'w',ZIP_DEFLATED) as z:
    for e in plugins:
        archive=root/'wordpress-plugins'/e['plugin']/'dist'/f"{e['plugin']}-{e['version']}.zip"
        data=archive.read_bytes();assert hashlib.sha256(data).hexdigest()==e['sha256']
        info=ZipInfo('plugins/'+archive.name,(2026,10,18,0,0,0));info.compress_type=ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,data)
    for name in ['INSTALL_TH.md','STATUS_TH.md','QA_REPORT.md','N8N_HANDOFF_TH.md']:
        info=ZipInfo(name,(2026,10,18,0,0,0));info.compress_type=ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,(root/'modules/ff90/docs'/name).read_bytes())
with ZipFile(bundle) as z:assert z.testzip() is None and len(z.namelist())==13
digest=hashlib.sha256(bundle.read_bytes()).hexdigest()
bundle.with_suffix('.zip.sha256').write_text(f'{digest}  {bundle.name}\n')
(root/'modules/ff90/docs/qa/bundle-results.json').write_text(json.dumps({'file':bundle.name,'bytes':bundle.stat().st_size,'sha256':digest,'plugin_zips':len(plugins),'note':'Extract bundle then install individual plugin ZIPs; not one uploadable plugin.'},indent=2)+'\n')
print(bundle,digest)

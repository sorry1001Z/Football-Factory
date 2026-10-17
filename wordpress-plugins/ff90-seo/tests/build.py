#!/usr/bin/env python3
"""Deterministic installable package, excluding test fixtures, screenshots and secrets."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
root = Path(__file__).resolve().parents[1]
files = [root / n for n in ['ff90-seo.php', 'readme.txt', 'LICENSE']]
files += sorted((root / 'includes').glob('*.php')) + sorted((root / 'assets').glob('*.js'))
out = root / 'dist' / 'ff90-seo-0.1.0.zip'
out.parent.mkdir(exist_ok=True)
with ZipFile(out, 'w', ZIP_DEFLATED) as z:
    for item in files:
        info = ZipInfo('ff90-seo/' + item.relative_to(root).as_posix(), (2026,10,17,0,0,0))
        info.external_attr = 0o100644 << 16
        info.compress_type = ZIP_DEFLATED
        z.writestr(info, item.read_bytes())
with ZipFile(out) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(files)
    assert all('tests/' not in n and 'docs/' not in n for n in z.namelist())
digest = hashlib.sha256(out.read_bytes()).hexdigest()
out.with_suffix('.zip.sha256').write_text(f'{digest}  {out.name}\n')
print(f'{out}: {len(files)} files; SHA256 {digest}')

#!/usr/bin/env python3
"""Build the companion statistics plugin separately from the presentation theme."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import re

root = Path(__file__).resolve().parents[3] / 'wordpress-plugins' / 'ff90-news-insights'
version = re.search(r'^ \* Version: ([\d.]+)$', (root / 'ff90-news-insights.php').read_text(), re.M).group(1)
out = root / 'dist'
out.mkdir(exist_ok=True)
archive = out / f'ff90-news-insights-{version}.zip'
with ZipFile(archive, 'w', ZIP_DEFLATED, compresslevel=9) as z:
    for name in ['ff90-news-insights.php', 'readme.txt', 'LICENSE']:
        info = ZipInfo('ff90-news-insights/' + name, (2026, 10, 17, 0, 0, 0))
        info.external_attr = 0o100644 << 16
        info.compress_type = ZIP_DEFLATED
        z.writestr(info, (root / name).read_bytes())
with ZipFile(archive) as z:
    assert z.testzip() is None and len(z.namelist()) == 3
    assert not any('/tests/' in name for name in z.namelist())
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n')
print(f'{archive}: SHA256 {digest}')

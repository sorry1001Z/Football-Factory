#!/usr/bin/env python3
"""Build a deterministic, self-contained installable theme ZIP (no QA fixture code)."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import re

root = Path(__file__).resolve().parents[1]
version = re.search(r'^Version: ([\d.]+)$', (root / 'style.css').read_text(), re.M).group(1)
out = root / 'dist'
out.mkdir(exist_ok=True)
archive = out / f'ff90-independent-{version}.zip'
allowed_root = {'.php', '.css'}
files = sorted(p for p in root.rglob('*') if p.is_file() and (
    (len(p.relative_to(root).parts) == 1 and (p.suffix in allowed_root or p.name in {'LICENSE', 'NOTICE', 'README.md', 'CHANGELOG.md', 'readme.txt', 'screenshot.png'}))
    or p.relative_to(root).parts[0] in {'assets', 'inc', 'template-parts', 'languages'}
))
assert (root / 'screenshot.png').exists(), 'Generate the actual WP preview screenshot first'
with ZipFile(archive, 'w', ZIP_DEFLATED, compresslevel=9) as z:
    for p in files:
        info = ZipInfo('ff90-independent/' + p.relative_to(root).as_posix(), (2026, 10, 17, 0, 0, 0))
        info.external_attr = 0o100644 << 16
        info.compress_type = ZIP_DEFLATED
        z.writestr(info, p.read_bytes())
with ZipFile(archive) as z:
    assert z.testzip() is None
    assert 'ff90-independent/style.css' in z.namelist()
    assert not any('/tests/' in n or '/docs/' in n or '/dist/' in n for n in z.namelist())
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(archive.with_suffix('.zip.sha256')).write_text(f'{digest}  {archive.name}\n')
print(f'{archive}: {len(files)} files; SHA256 {digest}')

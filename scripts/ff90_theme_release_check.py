#!/usr/bin/env python3
"""FF90 independent-theme source gate. This is NOT a live WordPress E2E test."""
import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

REQUIRED = (
    'style.css', 'functions.php', 'index.php', 'front-page.php',
    'header.php', 'footer.php', 'single.php', 'archive.php',
    'inc/customizer.php', 'template-parts/home-main-v2.php',
    'template-parts/home-colormag-01.php',
)

def check(theme: Path):
    out = {'theme': str(theme), 'checks': [], 'live_wordpress_e2e': 'NOT_RUN'}
    def record(name, ok, detail=''):
        out['checks'].append({'name': name, 'passed': bool(ok), 'detail': detail})
    record('theme_directory', theme.is_dir())
    if not theme.is_dir():
        return out
    for filename in REQUIRED:
        record('file:' + filename, (theme / filename).is_file())
    style = (theme / 'style.css').read_text(encoding='utf8') if (theme / 'style.css').is_file() else ''
    record('theme_header', bool(re.search(r'(?mi)^Theme Name:\s*FF90\b', style)))
    record('license_header', 'GPL' in style.upper())
    src = '\n'.join(p.read_text(encoding='utf8') for p in theme.rglob('*.php'))
    for token in ('ff90_home_layout', 'main-v2', 'colormag-01'):
        record('two_layout_switch:' + token, token in src)
    record('theme_has_images', any((theme / d).exists() for d in ('assets/images', 'images')))
    for php in sorted(theme.rglob('*.php')):
        if not shutil.which('php'):
            record('php_runtime', False, 'PHP CLI unavailable')
            break
        r = subprocess.run(['php', '-l', str(php)], text=True, capture_output=True)
        record('php_lint:' + str(php.relative_to(theme)), r.returncode == 0, (r.stderr or r.stdout).strip() if r.returncode else '')
    if (theme / 'theme.json').exists():
        try:
            d = json.loads((theme / 'theme.json').read_text(encoding='utf8'))
            record('theme_json', isinstance(d, dict) and 'version' in d)
        except Exception as e:
            record('theme_json', False, str(e))
    for js in sorted(theme.rglob('*.js')):
        if not shutil.which('node'):
            record('node_runtime', False, 'Node unavailable')
            break
        r = subprocess.run(['node', '--check', str(js)], text=True, capture_output=True)
        record('js_check:' + str(js.relative_to(theme)), r.returncode == 0, r.stderr.strip() if r.returncode else '')
    return out

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('theme', nargs='?', default='wordpress-themes/ff90-independent')
    parser.add_argument('--json-out')
    args = parser.parse_args()
    out = check(Path(args.theme))
    out['passed'] = sum(x['passed'] for x in out['checks'])
    out['failed'] = len(out['checks']) - out['passed']
    out['result'] = 'PASS' if out['failed'] == 0 else 'FAIL'
    payload = json.dumps(out, indent=2, ensure_ascii=False)
    if args.json_out:
        Path(args.json_out).write_text(payload + '\n', encoding='utf8')
    print(payload)
    return int(out['failed'] != 0)

if __name__ == '__main__':
    sys.exit(main())

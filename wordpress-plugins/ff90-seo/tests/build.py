#!/usr/bin/env python3
"""Compatibility entry point; the shared builder versions each independent plugin."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parents[3]/'modules/ff90/build.py'),run_name='__main__')

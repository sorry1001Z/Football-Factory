#!/usr/bin/env python3
"""Offline FF90 staging readiness gate. Never contacts servers or writes WP data."""
import argparse
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

REQUIRED = {
    "backup_restore": ("backup_sha256", "backup_timestamp", "restore_test_passed", "uploads_restore_verified", "database_restore_verified"),
    "connector": ("plugin_inventory_verified", "connector_healthy"),
    "service_user": ("service_user_verified", "deny_publish_verified", "secret_in_vault"),
    "qc": ("server_side_qc_verified", "image_rights_verified", "seo_single_writer_verified"),
    "hermes": ("minimax_article_package_verified",),
}

def validate(d):
    issues = []
    prod, stage = d.get("production_url"), d.get("staging_url")
    def valid_https(s):
        if not isinstance(s, str):
            return False
        p = urlparse(s)
        return p.scheme == "https" and bool(p.hostname) and not p.username and not p.password
    if not valid_https(prod):
        issues.append("production_url must be HTTPS URL")
    if not valid_https(stage):
        issues.append("staging_url must be HTTPS URL")
    if valid_https(prod) and valid_https(stage) and urlparse(prod).hostname == urlparse(stage).hostname:
        issues.append("staging and production must have different hostnames")
    for field in ("database_isolated", "uploads_isolated"):
        if d.get(field) is not True:
            issues.append(field + " not verified")
    if d.get("queue_enabled") is not False:
        issues.append("queue_enabled must be false")
    if d.get("auto_publish_disabled") is not True:
        issues.append("auto_publish_disabled must be true")
    if d.get("automation_draft_enabled") is not False:
        issues.append("automation_draft_enabled must be false")
    gates = {}
    for name, fields in REQUIRED.items():
        missing = []
        for field in fields:
            value = d.get(field)
            if field == "backup_sha256":
                import re
                acceptable = isinstance(value, str) and re.fullmatch(r"[0-9a-fA-F]{64}", value) is not None
            elif field == "backup_timestamp":
                acceptable = isinstance(value, str) and bool(value.strip())
            else:
                acceptable = value is True
            if not acceptable:
                missing.append(field)
        gates[name] = {"status": "BLOCKED" if missing else "EVIDENCE_DECLARED", "missing": missing}
    all_clear = not issues and all(not v["missing"] for v in gates.values())
    return {
        "status": "EVIDENCE_DECLARED_REVIEW_REQUIRED" if all_clear else "BLOCKED",
        "issues": issues,
        "gates": gates,
        "warning": "Declarations are not proof. Human review is mandatory. Never auto-unlock WordPress writes.",
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("evidence", type=Path)
    args = p.parse_args()
    try:
        d = json.loads(args.evidence.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        print(json.dumps({"status": "BLOCKED", "error": str(e)}))
        return 2
    if not isinstance(d, dict):
        print(json.dumps({"status": "BLOCKED", "error": "JSON object required"}))
        return 2
    result = validate(d)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "EVIDENCE_DECLARED_REVIEW_REQUIRED" else 1

if __name__ == "__main__":
    sys.exit(main())

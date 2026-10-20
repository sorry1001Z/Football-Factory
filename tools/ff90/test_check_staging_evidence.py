import unittest
from check_staging_evidence import validate, REQUIRED

class GatesTest(unittest.TestCase):
    def test_empty_blocked(self):
        self.assertEqual(validate({})["status"], "BLOCKED")

    def test_same_host_blocked(self):
        result = validate({
            "production_url":"https://wp.ff90.online",
            "staging_url":"https://wp.ff90.online",
            "queue_enabled":False,
            "auto_publish_disabled":True,
            "automation_draft_enabled":False
        })
        self.assertIn("staging and production must have different hostnames", result["issues"])

    def test_missing_restore_blocks(self):
        result = validate({
            "production_url":"https://wp.ff90.online",
            "staging_url":"https://staging.example.test",
            "queue_enabled":False,
            "auto_publish_disabled":True,
            "automation_draft_enabled":False,
            "database_isolated":True,
            "uploads_isolated":True
        })
        self.assertEqual(result["gates"]["backup_restore"]["status"], "BLOCKED")

    def test_queue_on_blocked(self):
        self.assertIn("queue_enabled must be false", validate({"queue_enabled":True})["issues"])

    def test_full_claims_not_automatic_approval(self):
        data = {
            "production_url":"https://wp.ff90.online",
            "staging_url":"https://staging.example.test",
            "database_isolated":True,
            "uploads_isolated":True,
            "queue_enabled":False,
            "auto_publish_disabled":True,
            "automation_draft_enabled":False
        }
        for fields in REQUIRED.values():
            for f in fields:
                data[f] = "a"*64 if f=="backup_sha256" else "2026-10-20T00:00:00Z" if f=="backup_timestamp" else True
        self.assertEqual(validate(data)["status"], "EVIDENCE_DECLARED_REVIEW_REQUIRED")

    def test_invalid_checksum_blocks(self):
        result = validate({"backup_sha256":"fake"})
        self.assertIn("backup_sha256", result["gates"]["backup_restore"]["missing"])

if __name__ == "__main__":
    unittest.main()

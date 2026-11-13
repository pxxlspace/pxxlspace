from pathlib import Path
import json
import unittest

from pxxl import PxxlAPIError, PxxlClient, create_project_zip, is_plan_gate_error


class PxxlClientTests(unittest.TestCase):
    def test_client_requires_api_key(self):
        with self.assertRaisesRegex(ValueError, "api_key is required"):
            PxxlClient(api_key="")

    def test_plan_gate_errors_expose_structured_fields(self):
        error = PxxlAPIError(403, "upgrade", b'{"code":"CRON_JOB_LIMIT_REACHED","limit":2,"used":2,"requiredPlan":"pro"}')
        self.assertTrue(is_plan_gate_error(error))
        self.assertEqual(error.code, "CRON_JOB_LIMIT_REACHED")
        self.assertEqual(error.current, 2)
        self.assertEqual(error.required_plan, "pro")

    def test_create_project_zip_skips_secrets(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "main.py").write_text("print('hello')\n")
            (tmp_path / ".env").write_text("SECRET=1\n")
            archive = create_project_zip(tmp_path)
            self.assertIn(b"main.py", archive)
            self.assertNotIn(b".env", archive)

    def test_complete_automation_routes(self):
        client = PxxlClient(api_key="pxxl_test", team_id="team_1")
        calls = []

        def fake_raw(method, path, *, body=None, content_type=None):
            calls.append((method, path, json.loads(body) if body else None))
            return b'{"success": true}'

        client._raw = fake_raw
        client.whoami()
        client.cdn_proxy_logs(projectId="proj_1")
        client.storage_analytics("bucket_1")
        client.project_logs("proj_1", live=True)
        client.database_metrics("db_1")
        client.reveal_database_credential("db_1", "password")
        client.list_team_databases("team_1")
        client.create_customer({"email": "ada@example.com"})
        client.purchase_domain({"customerId": "cus_1", "domains": ["example.com"]})
        client.get_payment_url("inv_1", "USD")
        client.request("POST", "/cli/cronjobs/validate-url", json_body={"url": "https://example.com/job"})

        self.assertEqual([call[1] for call in calls], [
            "/cli/whoami",
            "/cdn/proxy-logs?projectId=proj_1",
            "/storage/buckets/bucket_1/analytics?timeframe=30d",
            "/cli/projects/proj_1/live-logs",
            "/databases/db_1/metrics?teamId=team_1",
            "/databases/db_1/credentials/password?teamId=team_1",
            "/teams/team_1/databases",
            "/cli/contacts",
            "/cli/domainprovider/domain/register",
            "/cli/domainprovider/invoice/inv_1/payment-url?currency=USD&teamId=team_1",
            "/cli/cronjobs/validate-url",
        ])

    def test_request_rejects_absolute_urls(self):
        client = PxxlClient(api_key="pxxl_test")
        with self.assertRaisesRegex(ValueError, "must start with /"):
            client.request("GET", "https://example.com")


class PxxlResellerTests(unittest.TestCase):
    def test_reseller_routes(self):
        client = PxxlClient(api_key="pxxl_rsl_test")
        calls = []

        def fake_raw(method, path, *, body=None, content_type=None, extra_headers=None):
            calls.append((method, path, json.loads(body) if body else None, extra_headers))
            if "/availability" in path:
                return b'{"quote": {"chargeMinor": 412}}'
            return b'{"ok": true, "domain": {"domain": "a.cv"}}'

        client._raw = fake_raw
        self.assertEqual(client.reseller.quote("a.cv", 2)["chargeMinor"], 412)
        client.reseller.register("a.cv", customer={"reference": "c1"}, idempotency_key="k1")
        client.reseller.set_dns_record("a.cv", "A", "@", "1.2.3.4")
        client.reseller.set_nameservers("a.cv", ["ns1.x.com", "ns2.x.com"])
        self.assertEqual(calls[0][1], "/domain-reseller/availability?domain=a.cv&years=2")
        self.assertEqual(calls[1][:3], ("POST", "/domain-reseller/domains", {"domain": "a.cv", "customer": {"reference": "c1"}}))
        self.assertEqual(calls[1][3], {"Idempotency-Key": "k1"})
        self.assertEqual(calls[2][2], {"type": "A", "name": "@", "value": "1.2.3.4"})
        self.assertEqual(calls[3][1], "/domain-reseller/domains/a.cv/nameservers")

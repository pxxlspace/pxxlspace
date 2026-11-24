import base64
import io
import json
import os
import unittest
from unittest import mock

from pxxl import PxxlAPIError, PxxlClient, Sandbox, SandboxError, resolve_api_base_url
from pxxl import sandboxes as sandboxes_module


def sandbox(**fields):
    base = {"id": "sbx_1", "name": "demo", "template": "node", "status": "creating", "domain": "demo.pxxl.click", "cpus": 2, "memoryMb": 4096, "hourlyUsd": 0.048}
    base.update(fields)
    return base


class FakeResponse(io.BytesIO):
    def __init__(self, body: bytes, content_type: str):
        super().__init__(body)
        self.headers = {"Content-Type": content_type}


class SandboxTests(unittest.TestCase):
    def client(self, handler):
        client = PxxlClient(api_key="pxxl_sbx", team_id="team_1")
        calls = []

        def fake_raw(method, path, *, body=None, content_type=None):
            calls.append((method, path, json.loads(body) if body else None))
            return json.dumps(handler(method, path)).encode()

        client._raw = fake_raw
        return client, calls

    def test_routes(self):
        def handler(method, path):
            if path.startswith("/sandboxes/pricing"):
                return {"vcpuHourUsd": 0.012}
            if method == "GET" and path.startswith("/sandboxes?"):
                return {"sandboxes": [sandbox(status="running")], "usage": {"runningCount": 1}}
            if "/files" in path:
                return {"files": [{"path": "/workspace/a.js", "name": "a.js", "type": "file"}]}
            if "/file" in path and method == "GET":
                return {"path": "/workspace/a.js", "content": "hi"}
            if "/stop" in path:
                return {"sandbox": sandbox(status="paused")}
            if "/exec" in path:
                return {"exitCode": 0, "output": "ok\n", "timedOut": False}
            return {"sandbox": sandbox(status="running"), "ok": True}

        client, calls = self.client(handler)
        self.assertEqual(client.sandboxes.pricing()["vcpuHourUsd"], 0.012)
        created = client.sandboxes.create(name="demo", template="node", size="small", disk_gb=5, auto_stop_minutes=30, env={"A": "1"})
        self.assertIsInstance(created, Sandbox)
        self.assertEqual(created.preview_url, "https://demo.pxxl.click")
        listed = client.sandboxes.list()
        self.assertEqual(listed["sandboxes"][0].status, "running")
        self.assertEqual(created.exec("echo ok", workdir="/workspace")["output"], "ok\n")
        self.assertEqual(created.files.read("/workspace/a.js"), "hi")
        created.files.write("/workspace/a.js", "hello")
        self.assertEqual(created.files.list("/workspace")[0]["name"], "a.js")
        created.stop()
        self.assertTrue(created.is_paused)
        created.set_auto_stop(15)
        created.delete()
        self.assertEqual(calls[1], ("POST", "/sandboxes?teamId=team_1", {"name": "demo", "template": "node", "size": "small", "diskGb": 5, "autoStopMinutes": 30, "env": {"A": "1"}}))
        self.assertEqual(calls[3], ("POST", "/sandboxes/sbx_1/exec?teamId=team_1", {"command": "echo ok", "workdir": "/workspace"}))
        self.assertEqual(calls[4][1], "/sandboxes/sbx_1/file?path=%2Fworkspace%2Fa.js&teamId=team_1")
        self.assertEqual(calls[5], ("PUT", "/sandboxes/sbx_1/file?teamId=team_1", {"path": "/workspace/a.js", "content": "hello"}))
        self.assertEqual(calls[8], ("PATCH", "/sandboxes/sbx_1?teamId=team_1", {"autoStopMinutes": 15}))
        self.assertEqual(calls[9][:2], ("DELETE", "/sandboxes/sbx_1?teamId=team_1"))

    def test_exec_streams_ndjson(self):
        client = PxxlClient(api_key="pxxl_sbx")
        box = Sandbox(client.sandboxes, sandbox(status="running"))
        lines = [{"type": "output", "data": "one\n"}, {"type": "output", "data": "two\n"}, {"type": "exit", "exitCode": 2, "timedOut": False, "durationMs": 9}]
        body = ("\n".join(json.dumps(line) for line in lines) + "\n").encode()
        seen = {}

        def fake_urlopen(req, timeout=None):
            seen["accept"] = req.get_header("Accept")
            seen["url"] = req.full_url
            return FakeResponse(body, "application/x-ndjson")

        chunks = []
        with mock.patch.object(sandboxes_module.urllib.request, "urlopen", fake_urlopen):
            result = box.exec("false", on_output=chunks.append)
        self.assertEqual(seen["accept"], "application/x-ndjson")
        self.assertEqual(seen["url"], "https://server.pxxl.app/api/v3/sandboxes/sbx_1/exec")
        self.assertEqual(chunks, ["one\n", "two\n"])
        self.assertEqual(result["exitCode"], 2)
        self.assertEqual(result["output"], "one\ntwo\n")

        with mock.patch.object(sandboxes_module.urllib.request, "urlopen", lambda req, timeout=None: FakeResponse(b'{"exitCode":0,"output":"all","timedOut":false}', "application/json")):
            chunks = []
            self.assertEqual(box.exec("echo", on_output=chunks.append)["exitCode"], 0)
            self.assertEqual(chunks, ["all"])

        error = b'{"type":"error","message":"runtime gone"}\n'
        with mock.patch.object(sandboxes_module.urllib.request, "urlopen", lambda req, timeout=None: FakeResponse(error, "application/x-ndjson")):
            with self.assertRaisesRegex(PxxlAPIError, "runtime gone"):
                box.exec("echo", on_output=lambda chunk: None)

    def test_labels(self):
        def handler(method, path):
            if method == "GET" and path.startswith("/sandboxes?"):
                return {"sandboxes": [sandbox(labels={"team": "payments"})], "usage": {}}
            if method == "PATCH":
                return {"sandbox": sandbox(labels={"team": "growth"})}
            return {"sandbox": sandbox(labels={"team": "payments", "env": "ci"})}

        client, calls = self.client(handler)
        box = client.sandboxes.create(template="python", labels={"team": "payments", "env": "ci"})
        self.assertEqual(calls[0][2], {"template": "python", "labels": {"team": "payments", "env": "ci"}})
        self.assertEqual(box.labels, {"team": "payments", "env": "ci"})
        listed = client.sandboxes.list(labels={"team": "payments", "env": True})
        self.assertEqual(listed["sandboxes"][0].labels["team"], "payments")
        self.assertEqual(calls[1][1], "/sandboxes?label=team%3Apayments&label=env&teamId=team_1")
        box.set_labels({"team": "growth"})
        self.assertEqual(calls[2], ("PATCH", "/sandboxes/sbx_1?teamId=team_1", {"labels": {"team": "growth"}}))
        self.assertEqual(box.labels, {"team": "growth"})
        box.set_labels({})
        self.assertEqual(calls[3][2], {"labels": {}})

    def test_egress(self):
        state = {"calls": None}

        def handler(method, path):
            body = state["calls"][-1][2] or {}
            if method == "PATCH" and body.get("egress", {}).get("mode") == "deny-all":
                return {"sandbox": sandbox(egress={"mode": "deny-all", "allow": []}), "egressApplied": False, "message": "Applies at the next start."}
            if method == "PATCH":
                egress = body["egress"]
                return {"sandbox": sandbox(egress={"mode": egress.get("mode", "allowlist"), "allow": egress.get("allow", [])}), "egressApplied": True}
            return {"sandbox": sandbox(egress={"mode": "allowlist", "allow": ["github.com", "*.npmjs.org"]})}

        client, calls = self.client(handler)
        state["calls"] = calls
        box = client.sandboxes.create(template="node", egress={"allow": ["github.com", "*.npmjs.org"]})
        self.assertEqual(calls[0], ("POST", "/sandboxes?teamId=team_1", {"template": "node", "egress": {"allow": ["github.com", "*.npmjs.org"]}}))
        self.assertEqual(box.egress, {"mode": "allowlist", "allow": ["github.com", "*.npmjs.org"]})

        result = box.set_network("deny-all")
        self.assertEqual(calls[1], ("PATCH", "/sandboxes/sbx_1?teamId=team_1", {"egress": {"mode": "deny-all"}}))
        self.assertFalse(result["egressApplied"])
        self.assertEqual(result["message"], "Applies at the next start.")
        self.assertEqual(box.egress["mode"], "deny-all")

        result = client.sandboxes.set_network("sbx_1", allow=["pypi.org", "140.82.112.0/20"])
        self.assertEqual(calls[2][2], {"egress": {"allow": ["pypi.org", "140.82.112.0/20"]}})
        self.assertTrue(result["egressApplied"])

        box.update(egress={"mode": "allow-all"})
        self.assertEqual(calls[3][2], {"egress": {"mode": "allow-all"}})
        self.assertEqual(box.egress, {"mode": "allow-all", "allow": []})

        self.assertEqual(Sandbox(client.sandboxes, sandbox()).egress, {"mode": "allow-all", "allow": []})
        with self.assertRaises(ValueError):
            box.set_network("everything")
        with self.assertRaises(ValueError):
            box.set_network()

    def test_processes_and_kill(self):
        def handler(method, path):
            if "/processes/" in path:
                return {"pid": 42, "signal": "KILL"}
            return {"processes": [{"pid": 42, "ppid": 1, "elapsedSeconds": 3, "cpuPercent": 0.1, "memoryKb": 900, "command": "python3 -m http.server"}]}

        client, calls = self.client(handler)
        box = Sandbox(client.sandboxes, sandbox(status="running"), "team_1")
        self.assertEqual(box.processes()[0]["pid"], 42)
        self.assertEqual(box.kill(42, "kill"), {"pid": 42, "signal": "KILL"})
        box.kill(42)
        self.assertEqual(calls[0][:2], ("GET", "/sandboxes/sbx_1/processes?teamId=team_1"))
        self.assertEqual(calls[1][:2], ("DELETE", "/sandboxes/sbx_1/processes/42?signal=KILL&teamId=team_1"))
        self.assertEqual(calls[2][1], "/sandboxes/sbx_1/processes/42?signal=TERM&teamId=team_1")

    def test_binary_files(self):
        png = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0xFF, 0xFE])
        encoded = base64.b64encode(png).decode()

        def handler(method, path):
            if method == "GET":
                return {"path": "/workspace/a.png", "encoding": "base64", "content": encoded}
            return {"path": "/workspace/a.png"}

        client, calls = self.client(handler)
        box = Sandbox(client.sandboxes, sandbox(status="running"), "team_1")
        self.assertEqual(box.files.read("/workspace/a.png", binary=True), png)
        self.assertEqual(calls[0][1], "/sandboxes/sbx_1/file?path=%2Fworkspace%2Fa.png&encoding=base64&teamId=team_1")
        box.files.write("/workspace/a.png", png)
        self.assertEqual(calls[1], ("PUT", "/sandboxes/sbx_1/file?teamId=team_1", {"path": "/workspace/a.png", "content": encoded, "encoding": "base64"}))
        box.files.write("/workspace/t.txt", "text")
        self.assertEqual(calls[2][2], {"path": "/workspace/t.txt", "content": "text"})

    def test_wait_until_ready(self):
        statuses = ["creating", "running"]
        client, _ = self.client(lambda method, path: {"sandbox": sandbox(status=statuses.pop(0) if statuses else "running")})
        box = Sandbox(client.sandboxes, sandbox())
        box.wait_until_ready(interval=0)
        self.assertTrue(box.is_running)
        failing, _ = self.client(lambda method, path: {"sandbox": sandbox(status="failed")})
        with self.assertRaises(SandboxError):
            Sandbox(failing.sandboxes, sandbox()).wait_until_ready(interval=0)

    def test_api_url_override(self):
        with mock.patch.dict(os.environ, {"PXXL_API_URL": "https://staging-gateway.pxxl.app"}):
            self.assertEqual(resolve_api_base_url(), "https://staging-gateway.pxxl.app/api/v3")
            self.assertEqual(PxxlClient(api_key="k").base_url, "https://staging-gateway.pxxl.app/api/v3")
        with mock.patch.dict(os.environ, {"PXXL_API_URL": "https://evil.example.com"}):
            with self.assertRaises(ValueError):
                resolve_api_base_url()


if __name__ == "__main__":
    unittest.main()

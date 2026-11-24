"""Sandboxes: isolated Linux workspaces you create, run commands in and throw away.

Billed per second from your USD wallet while running, $0 while paused. Paid plans
only (Plus and up). Use an API key scoped to ``all`` or ``sandbox``.

    sandbox = client.sandboxes.create(template="node", size="small", labels={"team": "payments"})
    sandbox.wait_until_ready()
    result = sandbox.exec("npm test", on_output=lambda chunk: print(chunk, end=""))
    sandbox.files.write("/workspace/notes.txt", "hello")
    print(sandbox.preview_url)
    sandbox.stop()
"""

from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import TYPE_CHECKING, Any, Callable, Mapping

if TYPE_CHECKING:
    from .client import PxxlClient


def _esc(value: str) -> str:
    return urllib.parse.quote(str(value).strip(), safe="")


#: Template ids. ``base`` (Debian 13) is the default; aliases nodejs/js/typescript,
#: py and golang map to node, python and go.
TEMPLATES = ("base", "node", "python", "go", "rust", "bun")
#: Signals ``kill()`` can send.
SIGNALS = ("TERM", "KILL", "INT", "HUP")


def _label_query(labels: Mapping[str, Any] | None) -> str:
    """``label=key:value`` parameters (AND); a value of True or None matches any value."""
    parts = []
    for key, value in (labels or {}).items():
        term = str(key) if value is True or value is None else f"{key}:{value}"
        parts.append("label=" + _esc(term))
    return "&".join(parts)


def is_sandbox_paused(status: str | None) -> bool:
    """True for every paused state, including the legacy names."""
    return bool(status) and (str(status).startswith("paused") or status == "stopped")


class SandboxError(RuntimeError):
    """wait_until_ready() saw the sandbox fail, or gave up waiting."""

    def __init__(self, message: str, sandbox: Mapping[str, Any]):
        super().__init__(message)
        self.sandbox = dict(sandbox)


class PxxlSandboxes:
    def __init__(self, client: "PxxlClient") -> None:
        self._client = client

    def _path(self, suffix: str = "", team_id: str | None = None) -> str:
        team = team_id or self._client.team_id
        if not team:
            return "/sandboxes" + suffix
        return "/sandboxes" + suffix + ("&" if "?" in suffix else "?") + "teamId=" + _esc(team)

    def _call(self, method: str, suffix: str, body: Mapping[str, Any] | None = None, team_id: str | None = None) -> dict[str, Any]:
        return self._client._request(method, self._path(suffix, team_id), json_body=body)

    # Sandboxes

    def create(
        self,
        *,
        name: str | None = None,
        template: str | None = None,
        size: str | None = None,
        cpus: int | None = None,
        memory_mb: int | None = None,
        disk_gb: int | None = None,
        auto_stop_minutes: int | None = None,
        env: Mapping[str, str] | None = None,
        source_repository: str | None = None,
        preview_access: str | None = None,
        labels: Mapping[str, str] | None = None,
        team_id: str | None = None,
    ) -> "Sandbox":
        """Create a sandbox. It starts as ``creating``; call ``wait_until_ready()`` for ``running``.

        ``template`` is base (Debian 13, the default), node, python, go, rust or bun.
        ``labels`` is up to 20 ``{key: value}`` pairs to find the sandbox by later."""
        body = {
            "name": name,
            "template": template,
            "size": size,
            "cpus": cpus,
            "memoryMb": memory_mb,
            "diskGb": disk_gb,
            "autoStopMinutes": auto_stop_minutes,
            "env": dict(env) if env else None,
            "sourceRepository": source_repository,
            "previewAccess": preview_access,
            "labels": dict(labels) if labels else None,
        }
        result = self._call("POST", "", body, team_id)
        return Sandbox(self, result["sandbox"], team_id)

    def list(self, team_id: str | None = None, *, labels: Mapping[str, Any] | None = None) -> dict[str, Any]:
        """``{"sandboxes": [Sandbox], "usage": {...}, "pricing": {...}}``.

        ``labels={"team": "payments"}`` keeps sandboxes with every given label;
        a value of ``True`` matches any value of that key."""
        query = _label_query(labels)
        result = self._call("GET", f"?{query}" if query else "", None, team_id)
        result["sandboxes"] = [Sandbox(self, info, team_id) for info in result.get("sandboxes") or []]
        return result

    def get(self, sandbox_id: str, team_id: str | None = None) -> "Sandbox":
        return Sandbox(self, self.info(sandbox_id, team_id), team_id)

    connect = get

    def pricing(self) -> dict[str, Any]:
        """Rates, sizes, templates and plan limits."""
        return self._client._request("GET", "/sandboxes/pricing")

    def templates(self) -> list[dict[str, Any]]:
        """``[{id, label, description, version}]``: the templates and their runtime versions."""
        return self.pricing().get("templates") or []

    def summary(self, team_id: str | None = None) -> dict[str, Any]:
        """Running/paused counts, $/hour now, this month's spend, vCPU-hours,
        GB-hours, reserved storage, wallet runway and hints."""
        return self._call("GET", "/summary", None, team_id)["data"]

    # Low-level calls by id

    def info(self, sandbox_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._call("GET", f"/{_esc(sandbox_id)}", None, team_id)["sandbox"]

    def update(
        self,
        sandbox_id: str,
        *,
        name: str | None = None,
        auto_stop_minutes: int | None = None,
        preview_access: str | None = None,
        labels: Mapping[str, str] | None = None,
        team_id: str | None = None,
    ) -> dict[str, Any]:
        """Change fields. ``labels`` replaces all labels (``{}`` clears them)."""
        body = {"name": name, "autoStopMinutes": auto_stop_minutes, "previewAccess": preview_access, "labels": dict(labels) if labels is not None else None}
        return self._call("PATCH", f"/{_esc(sandbox_id)}", body, team_id)["sandbox"]

    def preview_link(self, sandbox_id: str, team_id: str | None = None) -> dict[str, Any]:
        """``{url, access, expiresAt?}``: private previews get a 12-hour token in the URL."""
        return self._call("POST", f"/{_esc(sandbox_id)}/preview-link", None, team_id)

    def start(self, sandbox_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._call("POST", f"/{_esc(sandbox_id)}/start", None, team_id)

    def stop(self, sandbox_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._call("POST", f"/{_esc(sandbox_id)}/stop", None, team_id)

    def delete(self, sandbox_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._call("DELETE", f"/{_esc(sandbox_id)}", None, team_id)

    def logs(self, sandbox_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._call("GET", f"/{_esc(sandbox_id)}/logs", None, team_id)

    def usage(self, sandbox_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._call("GET", f"/{_esc(sandbox_id)}/usage", None, team_id)

    def analytics(self, sandbox_id: str, timeframe: str = "24h", team_id: str | None = None) -> dict[str, Any]:
        """Preview URL traffic for 24h, 7d or 30d."""
        return self._call("GET", f"/{_esc(sandbox_id)}/analytics?timeframe={timeframe}", None, team_id)

    def terminal_ticket(self, sandbox_id: str, team_id: str | None = None) -> dict[str, Any]:
        """A short-lived WebSocket URL (``wsUrl``) for an interactive shell."""
        return self._call("POST", f"/{_esc(sandbox_id)}/terminal/ticket", None, team_id)

    def list_files(self, sandbox_id: str, path: str | None = None, team_id: str | None = None) -> list[dict[str, Any]]:
        query = f"?path={_esc(path)}" if path else ""
        return self._call("GET", f"/{_esc(sandbox_id)}/files{query}", None, team_id).get("files") or []

    def read_file(self, sandbox_id: str, path: str, team_id: str | None = None, *, encoding: str | None = None) -> dict[str, Any]:
        """``{path, content}``; with ``encoding="base64"`` the content is base64 (binary-safe)."""
        query = f"&encoding={_esc(encoding)}" if encoding else ""
        return self._call("GET", f"/{_esc(sandbox_id)}/file?path={_esc(path)}{query}", None, team_id)

    def write_file(self, sandbox_id: str, path: str, content: str | bytes | bytearray | memoryview, team_id: str | None = None) -> dict[str, Any]:
        """Write a file (up to 2 MB): ``str`` as text, ``bytes`` base64-encoded."""
        if isinstance(content, str):
            body: dict[str, Any] = {"path": path, "content": content}
        else:
            body = {"path": path, "content": base64.b64encode(bytes(content)).decode("ascii"), "encoding": "base64"}
        return self._call("PUT", f"/{_esc(sandbox_id)}/file", body, team_id)

    def processes(self, sandbox_id: str, team_id: str | None = None) -> list[dict[str, Any]]:
        """``[{pid, ppid, elapsedSeconds, cpuPercent, memoryKb, command}]``."""
        return self._call("GET", f"/{_esc(sandbox_id)}/processes", None, team_id).get("processes") or []

    def kill(self, sandbox_id: str, pid: int, signal: str = "TERM", team_id: str | None = None) -> dict[str, Any]:
        """Signal a process: TERM (default), KILL, INT or HUP. ``{pid, signal}``; 404 if no such process."""
        return self._call("DELETE", f"/{_esc(sandbox_id)}/processes/{int(pid)}?signal={_esc(signal.upper())}", None, team_id)

    def exec(
        self,
        sandbox_id: str,
        command: str,
        *,
        workdir: str | None = None,
        timeout_seconds: int | None = None,
        on_output: Callable[[str], None] | None = None,
        background: bool = False,
        team_id: str | None = None,
    ) -> dict[str, Any]:
        """Run a shell command: ``{exitCode, output, timedOut, truncated, durationMs}``.

        With ``on_output`` the output streams (NDJSON) and the callback gets each chunk.
        With ``background=True`` it starts detached and returns ``{background, pid, logFile}``."""
        body = {"command": command, "workdir": workdir, "timeoutSeconds": timeout_seconds}
        path = self._path(f"/{_esc(sandbox_id)}/exec", team_id)
        if background:
            return self._client._request("POST", path, json_body=dict(body, background=True))
        if on_output is None:
            return self._client._request("POST", path, json_body=body)
        return self._exec_stream(path, body, on_output, timeout_seconds)

    def _exec_stream(self, path: str, body: Mapping[str, Any], on_output: Callable[[str], None], timeout_seconds: int | None) -> dict[str, Any]:
        from .client import PxxlAPIError, _error_message

        client = self._client
        data = json.dumps({k: v for k, v in body.items() if v is not None}).encode()
        req = urllib.request.Request(client.base_url + path, data=data, method="POST")
        req.add_header("Authorization", f"Bearer {client.api_key}")
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/x-ndjson")
        req.add_header("User-Agent", "pxxl-python-sdk/0.1")
        timeout = max(client.timeout, float(timeout_seconds or 300) + 30)
        try:
            response = urllib.request.urlopen(req, timeout=timeout)
        except urllib.error.HTTPError as err:
            payload = err.read()
            raise PxxlAPIError(err.code, _error_message(payload) or str(err.reason), payload) from err
        with response:
            content_type = response.headers.get("Content-Type", "")
            if "ndjson" not in content_type and "jsonl" not in content_type and "stream" not in content_type:
                # Plain JSON: hand the whole output over at once.
                result = json.loads(response.read().decode() or "{}")
                if result.get("output"):
                    on_output(result["output"])
                return result
            output: list[str] = []
            for raw_line in _iter_lines(response):
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                kind = event.get("type")
                if kind == "output":
                    chunk = str(event.get("data") or "")
                    output.append(chunk)
                    on_output(chunk)
                elif kind == "exit":
                    return {
                        "exitCode": int(event.get("exitCode") or 0),
                        "output": event.get("output") if isinstance(event.get("output"), str) else "".join(output),
                        "timedOut": bool(event.get("timedOut")),
                        "truncated": bool(event.get("truncated")),
                        "durationMs": event.get("durationMs"),
                    }
                elif kind == "error":
                    message = str(event.get("message") or "The command failed in the sandbox")
                    raise PxxlAPIError(502, message, json.dumps(event).encode())
        raise PxxlAPIError(502, "The sandbox closed the output stream before the command finished", b"")


def _iter_lines(response: Any):
    """Lines of a streaming HTTP response, as text, as they arrive."""
    while True:
        line = response.readline()
        if not line:
            return
        yield line.decode("utf-8", errors="replace")


class _SandboxFiles:
    def __init__(self, sandbox: "Sandbox") -> None:
        self._sandbox = sandbox

    def read(self, path: str, binary: bool = False) -> Any:
        """The text content of a file, or its ``bytes`` with ``binary=True``."""
        if binary:
            return base64.b64decode(self.get(path, encoding="base64").get("content") or "")
        return self.get(path).get("content", "")

    def get(self, path: str, encoding: str | None = None) -> dict[str, Any]:
        """The file with its metadata."""
        return self._sandbox._api.read_file(self._sandbox.id, path, self._sandbox.team_id, encoding=encoding)

    def write(self, path: str, content: str | bytes | bytearray | memoryview) -> dict[str, Any]:
        """Write a file (up to 2 MB): ``str`` as text, ``bytes`` as binary."""
        return self._sandbox._api.write_file(self._sandbox.id, path, content, self._sandbox.team_id)

    def list(self, path: str | None = None) -> list[dict[str, Any]]:
        """Files under ``path`` (default /workspace)."""
        return self._sandbox._api.list_files(self._sandbox.id, path, self._sandbox.team_id)


class Sandbox:
    """One sandbox. Attributes reflect the last fetch; call ``refresh()`` for fresh ones."""

    def __init__(self, api: PxxlSandboxes, info: Mapping[str, Any], team_id: str | None = None) -> None:
        self._api = api
        self.info: dict[str, Any] = dict(info)
        self.team_id = team_id
        self.files = _SandboxFiles(self)

    def __repr__(self) -> str:
        return f"Sandbox(id={self.id!r}, name={self.name!r}, status={self.status!r})"

    @property
    def id(self) -> str:
        return str(self.info.get("id"))

    @property
    def name(self) -> str:
        return str(self.info.get("name") or "")

    @property
    def status(self) -> str:
        return str(self.info.get("status") or "")

    @property
    def template(self) -> str:
        return str(self.info.get("template") or "")

    @property
    def labels(self) -> dict[str, str]:
        return dict(self.info.get("labels") or {})

    @property
    def domain(self) -> str | None:
        return self.info.get("domain") or None

    @property
    def preview_url(self) -> str | None:
        """Public URL of the app listening on $PORT (3000) inside the sandbox."""
        if self.info.get("previewUrl"):
            return self.info["previewUrl"]
        return f"https://{self.domain}" if self.domain else None

    @property
    def is_running(self) -> bool:
        return self.status == "running"

    @property
    def is_paused(self) -> bool:
        return is_sandbox_paused(self.status)

    def get_preview_url(self) -> str | None:
        if not self.preview_url:
            self.refresh()
        return self.preview_url

    def refresh(self) -> "Sandbox":
        self.info = self._api.info(self.id, self.team_id)
        return self

    def wait_until_ready(self, timeout: float = 180.0, interval: float = 2.0) -> "Sandbox":
        """Poll until running. Raises SandboxError if it fails or ``timeout`` seconds pass."""
        deadline = time.monotonic() + timeout
        while True:
            if self.status == "running":
                return self
            if self.status == "failed":
                raise SandboxError(f"pxxl: sandbox {self.name or self.id} failed to start", self.info)
            if time.monotonic() >= deadline:
                raise SandboxError(f"pxxl: sandbox {self.name or self.id} is still {self.status}; gave up waiting", self.info)
            time.sleep(interval)
            self.refresh()

    def exec(
        self,
        command: str,
        *,
        workdir: str | None = None,
        timeout_seconds: int | None = None,
        on_output: Callable[[str], None] | None = None,
        background: bool = False,
    ) -> dict[str, Any]:
        return self._api.exec(self.id, command, workdir=workdir, timeout_seconds=timeout_seconds, on_output=on_output, background=background, team_id=self.team_id)

    def _apply(self, result: Mapping[str, Any]) -> "Sandbox":
        if isinstance(result.get("sandbox"), Mapping):
            self.info = dict(result["sandbox"])
            return self
        return self.refresh()

    def start(self) -> "Sandbox":
        """Start or resume. Needs a wallet balance of at least $0.25."""
        return self._apply(self._api.start(self.id, self.team_id))

    resume = start

    def stop(self) -> "Sandbox":
        """Pause. /workspace is kept and billing stops."""
        return self._apply(self._api.stop(self.id, self.team_id))

    pause = stop

    def delete(self) -> dict[str, Any]:
        """Delete the sandbox and its /workspace. Cannot be undone."""
        return self._api.delete(self.id, self.team_id)

    def update(self, *, name: str | None = None, auto_stop_minutes: int | None = None, preview_access: str | None = None, labels: Mapping[str, str] | None = None) -> "Sandbox":
        self.info = self._api.update(self.id, name=name, auto_stop_minutes=auto_stop_minutes, preview_access=preview_access, labels=labels, team_id=self.team_id)
        return self

    def set_labels(self, labels: Mapping[str, str]) -> "Sandbox":
        """Replace the labels (``{}`` clears them)."""
        return self.update(labels=labels)

    def processes(self) -> list[dict[str, Any]]:
        """Processes running in the sandbox."""
        return self._api.processes(self.id, self.team_id)

    def kill(self, pid: int, signal: str = "TERM") -> dict[str, Any]:
        """Signal a process: TERM (default), KILL, INT or HUP."""
        return self._api.kill(self.id, pid, signal, self.team_id)

    def set_preview_access(self, access: str) -> "Sandbox":
        """``"public"`` or ``"private"``."""
        return self.update(preview_access=access)

    def preview_link(self) -> dict[str, Any]:
        return self._api.preview_link(self.id, self.team_id)

    def set_auto_stop(self, minutes: int) -> "Sandbox":
        """Pause after this many idle minutes (0-1440; 0 = never)."""
        return self.update(auto_stop_minutes=minutes)

    def usage(self) -> dict[str, Any]:
        return self._api.usage(self.id, self.team_id)

    def analytics(self, timeframe: str = "24h") -> dict[str, Any]:
        return self._api.analytics(self.id, timeframe, self.team_id)

    def logs(self) -> dict[str, Any]:
        return self._api.logs(self.id, self.team_id)

    def terminal_ticket(self) -> dict[str, Any]:
        return self._api.terminal_ticket(self.id, self.team_id)

from __future__ import annotations

import json
import mimetypes
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, BinaryIO, Mapping

PXXL_API_BASE_URL = "https://server.pxxl.app/api/v3"
MAX_DEPLOY_FILES = 12000
MAX_DEPLOY_SOURCE_BYTES = 220 * 1024 * 1024


class PxxlAPIError(RuntimeError):
    def __init__(self, status_code: int, message: str, body: bytes):
        super().__init__(f"pxxl: request failed with {status_code}: {message}")
        self.status_code = status_code
        self.message = message
        self.body = body


@dataclass
class PxxlClient:
    api_key: str
    team_id: str | None = None
    timeout: float = 60.0

    def __post_init__(self) -> None:
        self.api_key = (self.api_key or "").strip()
        if not self.api_key:
            raise ValueError("pxxl: api_key is required")
        self.team_id = (self.team_id or "").strip() or None
        self.base_url = PXXL_API_BASE_URL

    def summary(self) -> dict[str, Any]:
        return self._request("GET", "/cdn/summary")["data"]

    def list_assets(self, **params: Any) -> dict[str, Any]:
        return self._request("GET", "/cdn/assets" + _query(params))

    def upload_asset(
        self,
        *,
        file_path: str | os.PathLike[str] | None = None,
        file: BinaryIO | bytes | None = None,
        file_name: str | None = None,
        visibility: str = "public",
        kind: str = "file",
        project_id: str | None = None,
        deployment_id: str | None = None,
    ) -> dict[str, Any]:
        payload, inferred_name = _read_upload_file(file_path=file_path, file=file, file_name=file_name)
        fields = {
            "visibility": visibility,
            "kind": kind,
            "projectId": project_id,
            "deploymentId": deployment_id,
        }
        body, content_type = _multipart(fields, "file", inferred_name, payload)
        return self._request("POST", "/cdn/assets", body=body, content_type=content_type)["asset"]

    def download_asset(self, asset_id: str) -> bytes:
        return self._raw("GET", f"/cdn/assets/{_escape(asset_id)}/download")

    def delete_asset(self, asset_id: str) -> None:
        self._request("DELETE", f"/cdn/assets/{_escape(asset_id)}")

    def list_tlds(self) -> dict[str, Any]:
        return self._request("GET", "/domains/tlds")

    def popular_tlds(self) -> dict[str, Any]:
        return self._request("GET", "/domains/tlds/popular")

    def search_tlds(self, query: str) -> dict[str, Any]:
        return self._request("GET", f"/domains/tlds/search?q={urllib.parse.quote(query)}")

    def search_domains(self, query: str, type: str | None = None) -> dict[str, Any]:
        return self._request("POST", "/domains/search", json_body={"query": query, "type": type})

    def list_domains(self, team_id: str | None = None) -> dict[str, Any]:
        return self._request("GET", "/cli/domains" + self._team_query(team_id))

    def domain_stats(self, domain: str, timeframe: str | None = None, team_id: str | None = None) -> dict[str, Any]:
        params = {"timeframe": timeframe, "teamId": team_id or self.team_id}
        return self._request("GET", f"/cli/domains/{_escape(domain)}/stats" + _query(params))

    def check_domain(self, domain: str, team_id: str | None = None) -> dict[str, Any]:
        return self._request("GET", f"/cli/domains/{_escape(domain)}/check" + self._team_query(team_id))

    def connect_domain(
        self,
        domain: str,
        project_id: str,
        alias: bool = False,
        team_id: str | None = None,
        service_alias: str | None = None,
        microservice_id: str | None = None,
        service_id: str | None = None,
        service_port: int | None = None,
    ) -> dict[str, Any]:
        target_service = service_alias or microservice_id or service_id
        payload: dict[str, Any] = {"domain": domain, "projectId": project_id, "alias": alias}
        if target_service:
            payload["serviceAlias"] = target_service
        if service_port:
            payload["servicePort"] = service_port
        return self._request(
            "POST",
            "/cli/domains" + self._team_query(team_id),
            json_body=payload,
        )

    def verify_domain_record(self, domain: str, project_id: str, team_id: str | None = None) -> dict[str, Any]:
        selected_team = team_id or self.team_id
        return self._request(
            "POST",
            "/cli/domains/checkrecord" + self._team_query(selected_team),
            json_body={"domain": domain, "projectId": project_id, "teamId": selected_team},
        )

    def verify_domain_dns_record(self, domain: str, project_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self.verify_domain_record(domain, project_id, team_id)

    def get_domain(self, domain_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._request("GET", f"/cli/domains/{_escape(domain_id)}" + self._team_query(team_id))

    def update_domain(self, domain_id: str, settings: Mapping[str, Any], team_id: str | None = None) -> dict[str, Any]:
        return self._request("PATCH", f"/cli/domains/{_escape(domain_id)}" + self._team_query(team_id), json_body=dict(settings))

    def disconnect_domain(self, domain: str, project_id: str | None = None, team_id: str | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {}
        selected_team = team_id or self.team_id
        if project_id:
            params["projectId"] = project_id
        if selected_team:
            params["teamId"] = selected_team
        return self._request("DELETE", f"/cli/domains/{_escape(domain)}" + _query(params))

    def resync_domain_proxy(self, domain: str, team_id: str | None = None) -> dict[str, Any]:
        return self._request("POST", f"/cli/domains/{_escape(domain)}/resync" + self._team_query(team_id), json_body={})

    def list_domain_dns_records(self, domain_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._request("GET", f"/cli/domains/{_escape(domain_id)}/dns-records" + self._team_query(team_id))

    def create_domain_dns_record(self, domain_id: str, record: Mapping[str, Any], team_id: str | None = None) -> dict[str, Any]:
        return self._request("POST", f"/cli/domains/{_escape(domain_id)}/dns-records" + self._team_query(team_id), json_body=dict(record))

    def update_domain_dns_records(self, domain_id: str, record: Mapping[str, Any], team_id: str | None = None) -> dict[str, Any]:
        return self._request("PUT", f"/cli/domains/{_escape(domain_id)}/dns-records" + self._team_query(team_id), json_body=dict(record))

    def delete_domain_dns_record(self, domain_id: str, record: Mapping[str, Any], team_id: str | None = None) -> dict[str, Any]:
        return self._request("DELETE", f"/cli/domains/{_escape(domain_id)}/dns-records" + self._team_query(team_id), json_body=dict(record))

    def activate_domain(self, domain_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._request("POST", f"/cli/domains/{_escape(domain_id)}/activate" + self._team_query(team_id), json_body={})

    def get_domain_zone_status(self, domain_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self.get_domain_connection_status(domain_id, team_id)

    def get_domain_connection_status(self, domain_id: str, team_id: str | None = None) -> dict[str, Any]:
        domain = self.get_domain(domain_id, team_id)
        if _is_cv_domain_name(_domain_name_from_response(domain)):
            try:
                return self._get_domain_zone_status_raw(domain_id, team_id)
            except PxxlAPIError as error:
                if "zone status is only available for .cv domains" not in error.message.lower():
                    raise
        return self.activate_domain(domain_id, team_id)

    def _get_domain_zone_status_raw(self, domain_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._request("GET", f"/cli/domains/{_escape(domain_id)}/zone-status" + self._team_query(team_id))

    def download_domain_certificate(self, domain_id: str, team_id: str | None = None) -> bytes:
        return self._raw("GET", f"/cli/domains/{_escape(domain_id)}/certificate/download" + self._team_query(team_id))

    def list_cron_jobs(self, team_id: str | None = None) -> dict[str, Any]:
        return self._request("GET", "/cli/cronjobs" + self._team_query(team_id))

    def create_cron_job(self, *, name: str, schedule: str, url: str, method: str = "GET", **kwargs: Any) -> dict[str, Any]:
        body = {"name": name, "schedule": schedule, "url": url, "method": method, **kwargs}
        team_id = body.pop("team_id", None) or body.pop("teamId", None)
        return self._request("POST", "/cli/cronjobs" + self._team_query(team_id), json_body=body)

    def get_cron_job(self, cron_job_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._request("GET", f"/cli/cronjobs/{_escape(cron_job_id)}" + self._team_query(team_id))

    def update_cron_job(self, cron_job_id: str, values: Mapping[str, Any], team_id: str | None = None) -> dict[str, Any]:
        return self._request("PUT", f"/cli/cronjobs/{_escape(cron_job_id)}" + self._team_query(team_id), json_body=dict(values))

    def delete_cron_job(self, cron_job_id: str, team_id: str | None = None) -> None:
        self._request("DELETE", f"/cli/cronjobs/{_escape(cron_job_id)}" + self._team_query(team_id))

    def start_cron_job(self, cron_job_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._cron_action(cron_job_id, "start", team_id)

    def stop_cron_job(self, cron_job_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._cron_action(cron_job_id, "stop", team_id)

    def trigger_cron_job(self, cron_job_id: str, team_id: str | None = None) -> dict[str, Any]:
        return self._cron_action(cron_job_id, "trigger", team_id)

    def list_cron_job_runs(self, cron_job_id: str, **params: Any) -> dict[str, Any]:
        return self._request("GET", f"/cli/cronjobs/{_escape(cron_job_id)}/runs" + _query(params))

    def validate_cron_schedule(self, schedule: str) -> dict[str, Any]:
        return self._request("POST", "/cli/cronjobs/validate-schedule", json_body={"schedule": schedule})

    def validate_cron_url(self, url: str) -> dict[str, Any]:
        return self._request("POST", "/cli/cronjobs/validate-url", json_body={"url": url})

    def deploy(
        self,
        *,
        directory: str | os.PathLike[str] | None = None,
        archive_path: str | os.PathLike[str] | None = None,
        name: str | None = None,
        project_id: str | None = None,
        domain_choice: str | None = None,
        **metadata: Any,
    ) -> dict[str, Any]:
        if archive_path:
            archive = Path(archive_path).read_bytes()
            file_name = Path(archive_path).name
        else:
            archive = create_project_zip(directory or ".")
            file_name = "pxxl-source.zip"
        fields = {
            "name": name,
            "projectId": project_id,
            "domainChoice": domain_choice,
            "environment": metadata.pop("environment", "production"),
            "sourceShape": "clideploy",
            "deploymentSource": "clideploy",
            **{_camel(k): v for k, v in metadata.items()},
        }
        body, content_type = _multipart(fields, "file", file_name, archive)
        return self._request("POST", "/projects/spacedrop", body=body, content_type=content_type)

    def _cron_action(self, cron_job_id: str, action: str, team_id: str | None = None) -> dict[str, Any]:
        return self._request("POST", f"/cli/cronjobs/{_escape(cron_job_id)}/{action}" + self._team_query(team_id), json_body={})

    def _team_query(self, team_id: str | None = None) -> str:
        return _query({"teamId": team_id or self.team_id})

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: Mapping[str, Any] | None = None,
        body: bytes | None = None,
        content_type: str | None = None,
    ) -> dict[str, Any]:
        data = body
        if json_body is not None:
            data = json.dumps({k: v for k, v in json_body.items() if v is not None}).encode()
            content_type = "application/json"
        raw = self._raw(method, path, body=data, content_type=content_type)
        if not raw:
            return {}
        return json.loads(raw.decode())

    def _raw(self, method: str, path: str, *, body: bytes | None = None, content_type: str | None = None) -> bytes:
        req = urllib.request.Request(self.base_url + path, data=body, method=method)
        req.add_header("Authorization", f"Bearer {self.api_key}")
        req.add_header("User-Agent", "pxxl-python-sdk/0.1")
        if content_type:
            req.add_header("Content-Type", content_type)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                return response.read()
        except urllib.error.HTTPError as err:
            payload = err.read()
            message = _error_message(payload) or err.reason
            raise PxxlAPIError(err.code, message, payload) from err


def create_project_zip(root: str | os.PathLike[str]) -> bytes:
    root_path = Path(root).resolve()
    files: list[Path] = []
    total = 0
    for file_path in sorted(root_path.rglob("*")):
        if file_path.is_dir() or file_path.is_symlink():
            continue
        rel = file_path.relative_to(root_path).as_posix()
        if _skip_deploy_path(rel) or _looks_sensitive(rel):
            continue
        total += file_path.stat().st_size
        if total > MAX_DEPLOY_SOURCE_BYTES:
            raise ValueError("pxxl: deploy archive exceeds 220MB source limit")
        files.append(file_path)
        if len(files) > MAX_DEPLOY_FILES:
            raise ValueError("pxxl: deploy archive exceeds file count limit")
    if not files:
        raise ValueError("pxxl: no deployable files found")

    import io

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for file_path in files:
            archive.write(file_path, file_path.relative_to(root_path).as_posix())
    return buffer.getvalue()


def _read_upload_file(*, file_path: str | os.PathLike[str] | None, file: BinaryIO | bytes | None, file_name: str | None) -> tuple[bytes, str]:
    if file_path:
        path = Path(file_path)
        return path.read_bytes(), file_name or path.name
    if isinstance(file, bytes):
        return file, file_name or "upload.bin"
    if file is not None:
        return file.read(), file_name or getattr(file, "name", "upload.bin")
    raise ValueError("pxxl: upload requires file_path or file")


def _multipart(fields: Mapping[str, Any], file_field: str, file_name: str, file_bytes: bytes) -> tuple[bytes, str]:
    boundary = "----pxxl-" + secrets.token_hex(16)
    lines: list[bytes] = []
    for key, value in fields.items():
        if value is None or value == "":
            continue
        lines.extend([
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode(),
            str(value).encode(),
            b"\r\n",
        ])
    content_type = mimetypes.guess_type(file_name)[0] or "application/octet-stream"
    lines.extend([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="{file_field}"; filename="{Path(file_name).name}"\r\n'.encode(),
        f"Content-Type: {content_type}\r\n\r\n".encode(),
        file_bytes,
        b"\r\n",
        f"--{boundary}--\r\n".encode(),
    ])
    return b"".join(lines), f"multipart/form-data; boundary={boundary}"


def _query(values: Mapping[str, Any]) -> str:
    clean = {k: v for k, v in values.items() if v is not None and v != ""}
    return "?" + urllib.parse.urlencode(clean) if clean else ""


def _escape(value: str) -> str:
    return urllib.parse.quote(str(value), safe="")


def _error_message(payload: bytes) -> str:
    try:
        body = json.loads(payload.decode())
    except Exception:
        return ""
    return str(body.get("message") or body.get("error") or "")


def _domain_name_from_response(value: Mapping[str, Any]) -> str:
    paths = (
        ("name",),
        ("domainName",),
        ("domain",),
        ("domain", "name"),
        ("domain", "domain"),
        ("data", "name"),
        ("data", "domainName"),
        ("data", "domain"),
        ("data", "domain", "name"),
        ("data", "domain", "domain"),
    )
    for path in paths:
        current: Any = value
        for key in path:
            if not isinstance(current, Mapping) or key not in current:
                current = None
                break
            current = current[key]
        if isinstance(current, str) and current.strip():
            return current.strip().lower().removesuffix(".")
    return ""


def _is_cv_domain_name(domain: str) -> bool:
    return domain.strip().lower().removesuffix(".").endswith(".cv")


def _camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:])


def _skip_deploy_path(rel: str) -> bool:
    first = rel.split("/", 1)[0]
    if first in {".git", "node_modules", ".next", ".turbo", ".cache", "dist", "build", ".output", "__pycache__"}:
        return True
    base = Path(rel).name
    return base == ".pxxlignore" or base.startswith(".env") or base.endswith(".log") or base == "pxxl-source.zip"


def _looks_sensitive(rel: str) -> bool:
    lower = rel.lower()
    return lower.endswith((".pem", ".key")) or "id_rsa" in lower or "service-account" in lower or "credentials.json" in lower

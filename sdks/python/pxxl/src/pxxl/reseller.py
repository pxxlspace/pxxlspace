"""Domain reselling (Pro plan and up).

Make the client with a reseller key (``pxxl_rsl_...`` from Tools > Domain
reseller) and use ``client.reseller``. Every purchase is charged to your Pxxl
wallet at the wholesale price; ``customerPrice*`` fields add your markup.

    client = PxxlClient(api_key=os.environ["PXXL_RESELLER_KEY"])
    quote = client.reseller.quote("example.cv")
    client.reseller.register("example.cv", customer={"reference": "cust_42"})
"""

from __future__ import annotations

import json
import urllib.parse
from typing import TYPE_CHECKING, Any, Iterable, Mapping

if TYPE_CHECKING:
    from .client import PxxlClient


def _esc(value: str) -> str:
    return urllib.parse.quote(str(value).strip(), safe="")


def _clean(values: Mapping[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in values.items() if v is not None}


class PxxlReseller:
    def __init__(self, client: "PxxlClient") -> None:
        self._client = client

    def _call(self, method: str, path: str, body: Mapping[str, Any] | None = None, *, idempotency_key: str | None = None) -> dict[str, Any]:
        full = "/domain-reseller" + path
        if not idempotency_key:
            return self._client._request(method, full, json_body=body)
        data = json.dumps(_clean(body or {})).encode()
        raw = self._client._raw(method, full, body=data, content_type="application/json", extra_headers={"Idempotency-Key": idempotency_key})
        return json.loads(raw.decode()) if raw else {}

    def account(self) -> dict[str, Any]:
        """Plan access, wallet balance, markup settings and wholesale terms."""
        return self._call("GET", "/account")

    def update_settings(self, **settings: Any) -> dict[str, Any]:
        """markupPercent, markupFixedNgn, markupFixedUsd, roundCustomerPrices, defaultNameservers, defaultYears, defaultContactId, autoRenew, brandName, supportEmail."""
        return self._call("PATCH", "/account", settings)["account"]

    def prices(self, tlds: Iterable[str] | None = None) -> list[dict[str, Any]]:
        query = "?tld=" + _esc(",".join(tlds)) if tlds else ""
        return self._call("GET", "/prices" + query)["prices"]

    def quote(self, domain: str, years: int | None = None) -> dict[str, Any]:
        """Availability, what your wallet is charged (chargeMinor, US cents) and your customer's price."""
        query = "?domain=" + _esc(domain) + (f"&years={int(years)}" if years else "")
        return self._call("GET", "/availability" + query)["quote"]

    availability = quote

    def register(
        self,
        domain: str,
        *,
        years: int | None = None,
        nameservers: list[str] | None = None,
        contact_id: int | None = None,
        contact: Mapping[str, Any] | None = None,
        address: Mapping[str, Any] | None = None,
        customer: Mapping[str, Any] | None = None,
        max_charge_minor: int | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Buy a domain and charge your wallet."""
        body = _clean({"domain": domain, "years": years, "nameservers": nameservers, "contactId": contact_id, "contact": contact, "address": address, "customer": customer, "maxChargeMinor": max_charge_minor})
        return self._call("POST", "/domains", body, idempotency_key=idempotency_key)

    buy = register

    def renew(self, domain: str, years: int = 1, *, max_charge_minor: int | None = None, idempotency_key: str | None = None) -> dict[str, Any]:
        return self._call("POST", f"/domains/{_esc(domain)}/renew", _clean({"years": years, "maxChargeMinor": max_charge_minor}), idempotency_key=idempotency_key)

    def transfer_in(self, domain: str, auth_code: str, *, years: int | None = None, nameservers: list[str] | None = None, customer: Mapping[str, Any] | None = None, idempotency_key: str | None = None) -> dict[str, Any]:
        """Transfer a domain in from another registrar (not .cv) and charge your wallet."""
        body = _clean({"domain": domain, "authCode": auth_code, "years": years, "nameservers": nameservers, "customer": customer})
        return self._call("POST", "/transfers", body, idempotency_key=idempotency_key)

    def list(self, *, customer_ref: str | None = None, status: str | None = None, search: str | None = None, limit: int | None = None, offset: int | None = None) -> dict[str, Any]:
        params = _clean({"customerRef": customer_ref, "status": status, "search": search, "limit": limit, "offset": offset})
        query = "?" + urllib.parse.urlencode(params) if params else ""
        return self._call("GET", "/domains" + query)

    def get(self, domain: str) -> dict[str, Any]:
        return self._call("GET", f"/domains/{_esc(domain)}")["domain"]

    status = get

    def update_customer(self, domain: str, **customer: Any) -> dict[str, Any]:
        return self._call("PATCH", f"/domains/{_esc(domain)}", {"customer": customer})["domain"]

    def dns_records(self, domain: str) -> dict[str, Any]:
        return self._call("GET", f"/domains/{_esc(domain)}/dns-records")

    def set_dns_record(self, domain: str, type: str, name: str, value: str, *, ttl: int | None = None, priority: int | None = None) -> dict[str, Any]:
        return self._call("POST", f"/domains/{_esc(domain)}/dns-records", _clean({"type": type, "name": name, "value": value, "ttl": ttl, "priority": priority}))

    def replace_dns_records(self, domain: str, type: str, name: str, value: str, *, ttl: int | None = None) -> dict[str, Any]:
        return self._call("PUT", f"/domains/{_esc(domain)}/dns-records", _clean({"type": type, "name": name, "value": value, "ttl": ttl}))

    def delete_dns_record(self, domain: str, *, id: str | None = None, type: str | None = None, name: str | None = None, value: str | None = None) -> dict[str, Any]:
        return self._call("DELETE", f"/domains/{_esc(domain)}/dns-records", _clean({"id": id, "type": type, "name": name, "value": value}))

    def set_nameservers(self, domain: str, nameservers: list[str]) -> dict[str, Any]:
        return self._call("POST", f"/domains/{_esc(domain)}/nameservers", {"nameservers": nameservers})

    def reset_nameservers(self, domain: str) -> dict[str, Any]:
        return self._call("POST", f"/domains/{_esc(domain)}/nameservers/reset")

    def verify_nameservers(self, domain: str) -> dict[str, Any]:
        return self._call("POST", f"/domains/{_esc(domain)}/nameservers/verify")

    def zone_status(self, domain: str) -> dict[str, Any]:
        return self._call("GET", f"/domains/{_esc(domain)}/zone-status")

    def set_registrar_lock(self, domain: str, locked: bool) -> dict[str, Any]:
        return self._call("POST", f"/domains/{_esc(domain)}/registrar-lock", {"locked": locked})

    def transfer_code(self, domain: str) -> dict[str, Any]:
        return self._call("POST", f"/domains/{_esc(domain)}/transfer-code")

    def charges(self, limit: int | None = None) -> list[dict[str, Any]]:
        return self._call("GET", "/charges" + (f"?limit={int(limit)}" if limit else ""))["charges"]

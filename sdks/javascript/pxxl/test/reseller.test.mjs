import assert from "node:assert/strict";
import test from "node:test";
import { Pxxl } from "../../../../dist/index.js";

test("reseller uses the reseller key and the domain-reseller API", async () => {
  const calls = [];
  const pxxl = new Pxxl({
    apiKey: "pxxl_general",
    resellerKey: "pxxl_rsl_test",
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method || "GET", auth: init.headers.get("Authorization"), idem: init.headers.get("Idempotency-Key"), body: init.body ? JSON.parse(init.body) : undefined });
      if (url.includes("/availability")) return Response.json({ quote: { domain: "a.cv", available: true, chargeMinor: 412 } });
      if (url.endsWith("/domain-reseller/domains") && init.method === "POST") return Response.json({ domain: { domain: "a.cv" }, chargedMinor: 412, balanceMinor: 588 }, { status: 201 });
      return Response.json({ ok: true });
    },
  });
  const quote = await pxxl.reseller.quote("a.cv", 2);
  assert.equal(quote.chargeMinor, 412);
  const bought = await pxxl.reseller.register({ domain: "a.cv", customer: { reference: "c1" }, idempotencyKey: "k1" });
  assert.equal(bought.balanceMinor, 588);
  await pxxl.reseller.setDNSRecord("a.cv", { type: "A", name: "@", value: "1.2.3.4" });
  await pxxl.reseller.setNameservers("a.cv", ["ns1.x.com", "ns2.x.com"]);
  assert.equal(calls[0].url, "https://server.pxxl.app/api/v3/domain-reseller/availability?domain=a.cv&years=2");
  assert.ok(calls.every((call) => call.auth === "Bearer pxxl_rsl_test"));
  assert.equal(calls[1].idem, "k1");
  assert.deepEqual(calls[1].body, { domain: "a.cv", customer: { reference: "c1" } });
  assert.equal(calls[2].url, "https://server.pxxl.app/api/v3/domain-reseller/domains/a.cv/dns-records");
  assert.deepEqual(calls[3].body, { nameservers: ["ns1.x.com", "ns2.x.com"] });
});

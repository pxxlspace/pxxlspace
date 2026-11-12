import type { PxxlClient } from "./index.js";
import { TunnelConnection, parseTunnelTarget, type TunnelOptions } from "./tunnel.js";

export { TunnelConnection, TunnelFatalError, parseTunnelTarget } from "./tunnel.js";
export type { TunnelHello, TunnelOptions, TunnelRequestEvent, TunnelStatus } from "./tunnel.js";

export type ToolLimits = {
  tier: "free" | "plus" | "pro" | "enterprise";
  planName: string;
  tunnels: number;
  tunnelMaxBodyBytes: number;
  webhookEndpoints: number;
  webhookStoredRequests: number;
  webhookRetentionHours: number;
  webhookMaxBodyBytes: number;
  webhookForwarding: boolean;
};

export type Tunnel = {
  id: string;
  name: string;
  slug: string;
  publicUrl: string;
  online: boolean;
  tokenPrefix: string;
  targetHint: string;
  requestsTotal: number;
  bytesIn: number;
  bytesOut: number;
  lastConnectedAt?: string;
  lastRequestAt?: string;
  createdAt: string;
};
export type TunnelSecret = { tunnel: Tunnel; token: string; commands: { install: string; connect: string } };

export type WebhookEndpoint = {
  id: string;
  name: string;
  url: string;
  forwardUrl: string;
  forwardHeaders: Record<string, string>;
  responseStatus: number;
  paused: boolean;
  requestsTotal: number;
  lastRequestAt?: string;
  createdAt: string;
};
export type WebhookEndpointInput = Partial<Pick<WebhookEndpoint, "name" | "forwardUrl" | "forwardHeaders" | "responseStatus" | "paused">>;
export type WebhookDelivery = { url: string; method: string; status: number; durationMs: number; error?: string; headers?: Record<string, string>; body?: string; truncated?: boolean; at: string };
export type WebhookRequest = {
  id: string;
  endpointId: string;
  method: string;
  path: string;
  query: string;
  headers: Record<string, string[]>;
  bodySize: number;
  contentType: string;
  sourceIp: string;
  receivedAt: string;
  expiresAt: string;
  forwardStatus: number;
  forwardError?: string;
  forwardMs: number;
  replayCount: number;
  lastReplay?: WebhookDelivery;
  body?: string;
  bodyEncoding?: "utf8" | "base64";
};

/** What happened when `listen` forwarded a request to your machine. */
export type WebhookLocalDelivery = { url: string; status: number; durationMs: number; error?: string };
export type WebhookListenEvent = { request: WebhookRequest; delivery?: WebhookLocalDelivery };
export type WebhookListenOptions = {
  /** Send each new request here as it arrives, e.g. http://localhost:3000/webhooks. The request's own path is appended. */
  forward?: string;
  /** Keep the endpoint's path out of the forwarded URL (send everything to `forward` exactly). */
  exactPath?: boolean;
  /** Extra headers on each forwarded request. */
  headers?: Record<string, string>;
  /** Also deliver requests that arrived before listening started (default false). */
  includeExisting?: boolean;
  intervalMs?: number;
  signal?: AbortSignal;
  onRequest?: (event: WebhookListenEvent) => void;
  onError?: (error: Error) => void;
};

const enc = encodeURIComponent;

export class PxxlTools {
  constructor(private readonly client: PxxlClient) {}

  /** What the plan includes for tunnels and webhooks, and how much is in use. */
  limits() {
    return this.client.request<{ limits: ToolLimits; usage: { tunnels: number; webhookEndpoints: number; webhookRequests: number }; tiers: ToolLimits[] }>("/cli/tools/limits");
  }

  /** Request a URL from Pxxl and see redirects, timings, headers and TLS. */
  httpCheck(input: { url: string; method?: string; headers?: Record<string, string>; body?: string }) {
    return this.client.request<Record<string, unknown>>("/cli/tools/http-check", { method: "POST", body: JSON.stringify({ method: "GET", ...input }) });
  }

  /** DNS records and the TLS certificate for a hostname, as Pxxl sees them. */
  domainCheck(host: string) {
    return this.client.request<Record<string, unknown>>("/cli/tools/domain-check", { method: "POST", body: JSON.stringify({ host }) });
  }
}

export class PxxlTunnels {
  constructor(private readonly client: PxxlClient) {}

  list() {
    return this.client.request<{ tunnels: Tunnel[]; limits: ToolLimits }>("/cli/tools/tunnels");
  }

  /** A tunnel by id, slug or name. */
  async get(idOrName: string): Promise<Tunnel> {
    const { tunnels } = await this.list();
    const wanted = idOrName.trim().toLowerCase();
    const tunnel = tunnels.find((item) => item.id === idOrName || item.slug === wanted) || tunnels.find((item) => item.name.toLowerCase() === wanted);
    if (!tunnel) throw new Error(`No tunnel named "${idOrName}". Run \`pxxl tunnel list\` to see yours.`);
    return tunnel;
  }

  create(input: { name: string; target?: string | number }) {
    return this.client.request<TunnelSecret>("/cli/tools/tunnels", { method: "POST", body: JSON.stringify({ name: input.name, target: input.target === undefined ? undefined : String(input.target) }) });
  }

  /** A new token for pxxl-tunnel; the old one stops working and its client disconnects. */
  async rotate(idOrName: string) {
    const tunnel = await this.get(idOrName);
    return this.client.request<TunnelSecret>(`/cli/tools/tunnels/${enc(tunnel.id)}/rotate`, { method: "POST" });
  }

  async delete(idOrName: string) {
    const tunnel = await this.get(idOrName);
    await this.client.request(`/cli/tools/tunnels/${enc(tunnel.id)}`, { method: "DELETE" });
    return tunnel;
  }

  /** Connect an existing tunnel to a local service with your API key. */
  async connect(idOrName: string, options: TunnelOptions): Promise<TunnelConnection> {
    parseTunnelTarget(options.target);
    const tunnel = await this.get(idOrName);
    return this.open(tunnel, options);
  }

  /**
   * Share a local service: reuses the tunnel with this name (default
   * "<this machine>-<port>"), or creates it, then connects.
   */
  async expose(target: string | number, options: Omit<TunnelOptions, "target"> & { name?: string } = {}): Promise<{ tunnel: Tunnel; connection: TunnelConnection }> {
    const parsed = parseTunnelTarget(target);
    const name = (options.name || defaultTunnelName(parsed)).slice(0, 80);
    const { tunnels } = await this.list();
    const tunnel = tunnels.find((item) => item.name.toLowerCase() === name.toLowerCase()) || (await this.create({ name, target: parsed.href })).tunnel;
    return { tunnel, connection: this.open(tunnel, { ...options, target }) };
  }

  private open(tunnel: Tunnel, options: TunnelOptions) {
    const url = this.client.apiURL(`/cli/tools/tunnels/${enc(tunnel.id)}/connect`).replace(/^http/, "ws");
    return new TunnelConnection({ ...options, url, headers: this.client.authHeaders(), userAgent: "pxxl-js-tunnel" });
  }
}

function defaultTunnelName(target: URL): string {
  const host = typeof process !== "undefined" ? (process.env.HOSTNAME || process.env.COMPUTERNAME || "") : "";
  const machine = (host.split(".")[0] || "local").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "local";
  return `${machine}-${target.port || (target.protocol === "https:" ? "443" : "80")}`;
}

export class PxxlWebhooks {
  constructor(private readonly client: PxxlClient) {}

  list() {
    return this.client.request<{ endpoints: WebhookEndpoint[]; limits: ToolLimits }>("/cli/tools/webhooks");
  }

  /** An endpoint by id or name. */
  async get(idOrName: string): Promise<WebhookEndpoint> {
    if (idOrName.startsWith("whe_")) return (await this.client.request<{ endpoint: WebhookEndpoint }>(`/cli/tools/webhooks/${enc(idOrName)}`)).endpoint;
    const { endpoints } = await this.list();
    const endpoint = endpoints.find((item) => item.name.toLowerCase() === idOrName.trim().toLowerCase());
    if (!endpoint) throw new Error(`No webhook endpoint named "${idOrName}". Run \`pxxl webhook list\` to see yours.`);
    return endpoint;
  }

  async create(input: WebhookEndpointInput & { name: string }) {
    return (await this.client.request<{ endpoint: WebhookEndpoint }>("/cli/tools/webhooks", { method: "POST", body: JSON.stringify(input) })).endpoint;
  }

  async update(idOrName: string, input: WebhookEndpointInput) {
    const endpoint = await this.get(idOrName);
    return (await this.client.request<{ endpoint: WebhookEndpoint }>(`/cli/tools/webhooks/${enc(endpoint.id)}`, { method: "PATCH", body: JSON.stringify(input) })).endpoint;
  }

  pause(idOrName: string) { return this.update(idOrName, { paused: true }); }
  resume(idOrName: string) { return this.update(idOrName, { paused: false }); }

  async delete(idOrName: string) {
    const endpoint = await this.get(idOrName);
    await this.client.request(`/cli/tools/webhooks/${enc(endpoint.id)}`, { method: "DELETE" });
    return endpoint;
  }

  /** The newest requests first. */
  async requests(idOrName: string, input: { limit?: number } = {}) {
    const endpoint = await this.get(idOrName);
    return (await this.client.request<{ requests: WebhookRequest[] }>(`/cli/tools/webhooks/${enc(endpoint.id)}/requests?limit=${input.limit || 50}`)).requests;
  }

  /** One request with its body. */
  async request(idOrName: string, requestId: string) {
    const endpoint = await this.get(idOrName);
    return (await this.client.request<{ request: WebhookRequest }>(`/cli/tools/webhooks/${enc(endpoint.id)}/requests/${enc(requestId)}`)).request;
  }

  /** Send a stored request again from Pxxl, to its forward URL or another public URL. */
  async replay(idOrName: string, requestId: string, input: { url?: string; method?: string; headers?: Record<string, string> } = {}) {
    const endpoint = await this.get(idOrName);
    return (await this.client.request<{ result: WebhookDelivery }>(`/cli/tools/webhooks/${enc(endpoint.id)}/requests/${enc(requestId)}/replay`, { method: "POST", body: JSON.stringify(input) })).result;
  }

  async clear(idOrName: string) {
    const endpoint = await this.get(idOrName);
    await this.client.request(`/cli/tools/webhooks/${enc(endpoint.id)}/requests`, { method: "DELETE" });
  }

  /**
   * Watch an endpoint and, with `forward`, send each new request to a URL on
   * your machine from here (so localhost works, unlike a replay from Pxxl).
   */
  async listen(idOrName: string, options: WebhookListenOptions = {}) {
    const endpoint = await this.get(idOrName);
    const seen = new Set<string>();
    if (!options.includeExisting) for (const request of (await this.requests(endpoint.id, { limit: 100 }))) seen.add(request.id);
    let stopped = false;
    let resolveClosed!: () => void;
    const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });
    const stop = () => { stopped = true; resolveClosed(); };
    options.signal?.addEventListener("abort", stop, { once: true });
    const interval = Math.max(500, options.intervalMs || 1500);
    void (async () => {
      while (!stopped) {
        try {
          const fresh = (await this.requests(endpoint.id, { limit: 25 })).filter((request) => !seen.has(request.id)).reverse();
          for (const summary of fresh) {
            seen.add(summary.id);
            const request = await this.request(endpoint.id, summary.id);
            const delivery = options.forward ? await forwardLocally(request, options) : undefined;
            options.onRequest?.({ request, delivery });
          }
        } catch (error) {
          options.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    })();
    return { endpoint, stop, closed };
  }
}

const SKIP_FORWARD_HEADERS = new Set(["host", "content-length", "connection", "transfer-encoding", "accept-encoding", "keep-alive", "upgrade"]);

async function forwardLocally(request: WebhookRequest, options: WebhookListenOptions): Promise<WebhookLocalDelivery> {
  const base = options.forward!.replace(/\/+$/, "");
  const path = options.exactPath || request.path === "/" ? "" : request.path;
  const url = `${base}${path}${request.query ? `?${request.query}` : ""}`;
  const headers = new Headers();
  for (const [name, values] of Object.entries(request.headers || {})) {
    if (SKIP_FORWARD_HEADERS.has(name.toLowerCase())) continue;
    for (const value of values) headers.append(name, value);
  }
  for (const [name, value] of Object.entries(options.headers || {})) headers.set(name, value);
  headers.set("X-Pxxl-Webhook-Request", request.id);
  const body = request.body && request.method !== "GET" && request.method !== "HEAD"
    ? (request.bodyEncoding === "base64" ? Buffer.from(request.body, "base64") : request.body)
    : undefined;
  const started = Date.now();
  try {
    const response = await fetch(url, { method: request.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(30_000) });
    await response.arrayBuffer().catch(() => undefined);
    return { url, status: response.status, durationMs: Date.now() - started };
  } catch (error) {
    return { url, status: 0, durationMs: Date.now() - started, error: error instanceof Error ? (error.cause instanceof Error ? error.cause.message : error.message) : String(error) };
  }
}

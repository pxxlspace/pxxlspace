import type { PxxlClient } from "./index.js";

/** What a server action does on the machine. */
export type ServerAction = "restart" | "stop" | "start" | "logs" | "prune" | "update";

const enc = encodeURIComponent;

/**
 * Bring-your-own servers: link a machine you run to Pxxl, watch it, run
 * actions and operations on it, and see the apps placed there.
 * Pass `teamId` to work in a spaceship; a spaceship API key is always pinned to its own.
 */
export class PxxlServers {
  constructor(private readonly client: PxxlClient, private readonly defaultTeamId?: string) {}

  private path(suffix = "", teamId = this.defaultTeamId) {
    const query = teamId ? `${suffix.includes("?") ? "&" : "?"}teamId=${enc(teamId)}` : "";
    return `/cli/servers${suffix}${query}`;
  }

  /** Your servers, with plan allowance. */
  list(input: { teamId?: string } = {}) { return this.client.request<Record<string, any>>(this.path("", input.teamId)); }
  /** Start linking a server: returns the install command to run on it. */
  create(input: { name: string; teamId?: string }) { return this.client.request<Record<string, any>>(this.path("", input.teamId), { method: "POST", body: JSON.stringify({ name: input.name }) }); }
  get(id: string) { return this.client.request<Record<string, any>>(this.path(`/${enc(id)}`)); }
  rename(id: string, name: string) { return this.client.request<Record<string, any>>(this.path(`/${enc(id)}`), { method: "PATCH", body: JSON.stringify({ name }) }); }
  /** Unlink and forget a server. Apps on it stop being managed by Pxxl. */
  delete(id: string) { return this.client.request<Record<string, any>>(this.path(`/${enc(id)}`), { method: "DELETE" }); }
  projects(id: string) { return this.client.request<Record<string, any>>(this.path(`/${enc(id)}/projects`)); }
  health(id: string) { return this.client.request<Record<string, any>>(this.path(`/${enc(id)}/health`)); }
  metrics(id: string) { return this.client.request<Record<string, any>>(this.path(`/${enc(id)}/metrics`)); }
  events(id: string) { return this.client.request<Record<string, any>>(this.path(`/${enc(id)}/events`)); }
  alerts(id: string) { return this.client.request<Record<string, any>>(this.path(`/${enc(id)}/alerts`)); }
  settings(id: string) { return this.client.request<Record<string, any>>(this.path(`/${enc(id)}/settings`)); }
  updateSettings(id: string, settings: Record<string, unknown>) { return this.client.request<Record<string, any>>(this.path(`/${enc(id)}/settings`), { method: "PATCH", body: JSON.stringify(settings) }); }
  /** A new one-time install command (for example after reinstalling the machine). */
  linkToken(id: string) { return this.client.request<Record<string, any>>(this.path(`/${enc(id)}/link-token`), { method: "POST" }); }

  /** Queue an action on the server or on one app (`app` is a container or project name). */
  action(id: string, action: ServerAction, input: { app?: string } = {}) {
    return this.client.request<Record<string, any>>(this.path(`/${enc(id)}/actions`), { method: "POST", body: JSON.stringify({ action, app: input.app }) });
  }
  actionStatus(id: string, actionId: string) { return this.client.request<Record<string, any>>(this.path(`/${enc(id)}/actions/${enc(actionId)}`)); }
  /** Run an action and wait until the server reports back. */
  async runAction(id: string, action: ServerAction, input: { app?: string; timeoutMs?: number; onUpdate?: (status: Record<string, any>) => void } = {}) {
    const queued = await this.action(id, action, input);
    const actionId = String((queued.action || queued).id || "");
    const until = Date.now() + (input.timeoutMs || 120_000);
    let latest: Record<string, any> = queued.action || queued;
    while (actionId && Date.now() < until) {
      latest = (await this.actionStatus(id, actionId)).action || latest;
      input.onUpdate?.(latest);
      if (/^(succeeded|success|done|completed|failed|error|cancelled)$/i.test(String(latest.status))) return latest;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return latest;
  }

  /** The operations a server supports (disk usage, docker ps, journal, …). */
  ops() { return this.client.request<Record<string, any>>("/cli/servers/ops"); }
  /** Run an operation. Read operations only look; change operations need `change: true`. */
  runOp(id: string, op: string, input: { app?: string; lines?: number; change?: boolean; wait?: boolean } = {}) {
    return this.client.request<Record<string, any>>(this.path(`/${enc(id)}/ops/${input.change ? "change" : "read"}`), { method: "POST", body: JSON.stringify({ op, app: input.app, lines: input.lines, wait: input.wait ?? true }) });
  }
}

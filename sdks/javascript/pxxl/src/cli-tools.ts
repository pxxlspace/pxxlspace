import type { Pxxl } from "./index.js";
import { TunnelFatalError, parseTunnelTarget, type Tunnel, type TunnelConnection, type TunnelOptions, type TunnelRequestEvent, type WebhookEndpoint, type WebhookListenEvent, type WebhookRequest } from "./tools.js";

// `pxxl tunnel`, `pxxl webhook`, `pxxl check` and `pxxl tools`.

const tty = () => !process.env.NO_COLOR && process.stdout.isTTY;
const paint = (code: number) => (value: string) => (tty() ? `\u001b[${code}m${value}\u001b[0m` : value);
const bold = paint(1);
const dim = paint(2);
const red = paint(31);
const green = paint(32);
const yellow = paint(33);
const cyan = paint(36);
const print = (value = "") => process.stdout.write(`${value}\n`);
const json = (value: unknown) => print(JSON.stringify(value, null, 2));

export const toolsHelp = {
  tunnel: `${bold("pxxl tunnel")} – share a local app at a public HTTPS URL

  ${cyan("pxxl tunnel")} <port|url>                Share it now (reuses or creates "<machine>-<port>")
  ${cyan("pxxl tunnel list")}                      List your tunnels and whether they are online
  ${cyan("pxxl tunnel create")} <name> [--to 3000]  Create a tunnel
  ${cyan("pxxl tunnel connect")} <name> --to <port> Connect an existing tunnel
  ${cyan("pxxl tunnel rotate")} <name>             New token for the standalone pxxl-tunnel binary
  ${cyan("pxxl tunnel delete")} <name>             Delete a tunnel and its URL

Options when connecting:
  --name <name>              Tunnel to use or create (default "<machine>-<port>")
  --auth <user:password>     Ask visitors to sign in before anything reaches your app
  --header "Name: value"     Add a header to every request to your app (repeatable)
  --response-header "N: v"   Add a header to every response (repeatable)
  --host-header <mode>       rewrite (default), preserve, or a host your app expects
  --strict-tls               Verify the certificate of an https:// target
  --json                     One JSON line per request
  --quiet                    Only print the URL

WebSockets are relayed too. Plus includes 2 tunnels, Pro 10, Enterprise 50.`,
  webhook: `${bold("pxxl webhook")} – URLs that record every request, with replay and local forwarding

  ${cyan("pxxl webhook list")}                         Your endpoints
  ${cyan("pxxl webhook create")} <name> [--forward <url>] [--status 200] [--header "N: v"]
  ${cyan("pxxl webhook get")} <name>                   Endpoint details and URL
  ${cyan("pxxl webhook requests")} <name> [--limit 20] Recent requests
  ${cyan("pxxl webhook show")} <name> <request-id>     One request with headers and body
  ${cyan("pxxl webhook replay")} <name> <request-id> [--to <url>] [--method POST]
  ${cyan("pxxl webhook listen")} <name> --forward http://localhost:3000/webhooks
                                              Stream new requests to your machine
  ${cyan("pxxl webhook pause|resume|clear|delete")} <name>

listen options: --exact-path (don't append the request path), --header "N: v", --all (include existing requests).`,
  check: `${bold("pxxl check")} – look at a URL or domain from Pxxl's network

  ${cyan("pxxl check http")} <url> [--method GET] [--header "N: v"]   Redirects, timings, headers, TLS
  ${cyan("pxxl check domain")} <host>                               DNS records and certificate`,
  tools: `${bold("pxxl tools")} – what your plan includes for tunnels and webhooks

  ${cyan("pxxl tools")}            Plan limits and usage
  ${cyan("pxxl tunnel --help")}    Tunnels
  ${cyan("pxxl webhook --help")}   Webhooks
  ${cyan("pxxl check --help")}     HTTP and domain checks`,
};

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline?.slice(name.length + 1);
}

function flagValues(args: string[], name: string): string[] {
  const values: string[] = [];
  args.forEach((arg, index) => {
    if (arg === name && args[index + 1] !== undefined) values.push(args[index + 1]!);
    else if (arg.startsWith(`${name}=`)) values.push(arg.slice(name.length + 1));
  });
  return values;
}

const VALUE_FLAGS = new Set(["--to", "--name", "--auth", "--header", "--response-header", "--host-header", "--forward", "--status", "--limit", "--method", "--interval"]);

function positionals(args: string[]): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg.startsWith("-")) {
      if (VALUE_FLAGS.has(arg)) index += 1;
      continue;
    }
    values.push(arg);
  }
  return values;
}

function headerFlags(args: string[], name: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const raw of flagValues(args, name)) {
    const split = raw.indexOf(":");
    if (split <= 0) throw new Error(`${name} must look like "Name: value" (got "${raw}")`);
    headers[raw.slice(0, split).trim()] = raw.slice(split + 1).trim();
  }
  return headers;
}

function need(value: string | undefined, label: string): string {
  if (!value) throw new Error(`Missing ${label}. Run with --help for usage.`);
  return value;
}

const formatBytes = (bytes: number) => (bytes >= 1 << 20 ? `${Math.round(bytes / (1 << 20))} MB` : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`);
const statusColor = (status: number) => (status >= 500 || status === 0 ? red : status >= 400 ? yellow : status >= 300 ? cyan : green)(String(status || "ERR"));
const clock = () => new Date().toLocaleTimeString([], { hour12: false });
const ago = (value?: string) => {
  if (!value) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.round(seconds / 60)}m ago` : seconds < 86400 ? `${Math.round(seconds / 3600)}h ago` : `${Math.round(seconds / 86400)}d ago`;
};

function table(rows: string[][]) {
  const widths = rows[0]!.map((_, column) => Math.max(...rows.map((row) => stripAnsi(row[column] || "").length)));
  rows.forEach((row, index) => print(row.map((cell, column) => cell + " ".repeat(Math.max(0, widths[column]! - stripAnsi(cell).length))).join("  ").trimEnd() + (index === 0 ? "" : "")));
}
const stripAnsi = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, "");

// ---- tunnels ----

export async function tunnelCommand(pxxl: Pxxl, args: string[]) {
  const [sub, ...rest] = args;
  const asJSON = args.includes("--json");
  if (!sub) return print(toolsHelp.tunnel);
  if (sub === "list" || sub === "ls") {
    const { tunnels, limits } = await pxxl.tunnels.list();
    if (asJSON) return json({ tunnels, limits });
    if (!tunnels.length) return print(limits.tunnels > 0 ? `No tunnels yet. Run ${cyan("pxxl tunnel 3000")} to share a local app.` : "Tunnels are included on Plus, Pro and Enterprise.");
    table([["NAME", "STATUS", "PUBLIC URL", "TARGET", "REQUESTS", "LAST REQUEST"].map(dim), ...tunnels.map((tunnel) => [tunnel.name, tunnel.online ? green("online") : dim("offline"), tunnel.publicUrl, tunnel.targetHint, tunnel.requestsTotal.toLocaleString(), ago(tunnel.lastRequestAt)])]);
    return print(dim(`\n${tunnels.length} of ${limits.tunnels} tunnels on ${limits.planName}`));
  }
  if (sub === "create") {
    const name = need(positionals(rest)[0] || flagValue(rest, "--name"), "tunnel name");
    const created = await pxxl.tunnels.create({ name, target: flagValue(rest, "--to") });
    if (asJSON) return json(created);
    print(`${green("✓")} Created tunnel ${bold(created.tunnel.name)}  ${created.tunnel.publicUrl}`);
    print(`\nConnect it from here:  ${cyan(`pxxl tunnel connect ${shellWord(created.tunnel.name)} --to ${new URL(created.tunnel.targetHint).port || 3000}`)}`);
    print(dim(`Or with the standalone binary (token shown once):\n  ${created.commands.install}\n  ${created.commands.connect}`));
    return;
  }
  if (sub === "rotate") {
    const secret = await pxxl.tunnels.rotate(need(positionals(rest)[0], "tunnel name"));
    if (asJSON) return json(secret);
    print(`${green("✓")} New token for ${bold(secret.tunnel.name)}. The old one no longer works.`);
    return print(`  ${secret.commands.connect}`);
  }
  if (sub === "delete" || sub === "rm") {
    const tunnel = await pxxl.tunnels.delete(need(positionals(rest)[0], "tunnel name"));
    return asJSON ? json({ deleted: tunnel.id }) : print(`${green("✓")} Deleted tunnel ${bold(tunnel.name)}`);
  }
  if (sub === "connect") {
    const name = need(positionals(rest)[0], "tunnel name");
    const target = flagValue(rest, "--to") || (await pxxl.tunnels.get(name)).targetHint;
    const connection = await pxxl.tunnels.connect(name, tunnelOptions(rest, target));
    return runTunnel(connection, await pxxl.tunnels.get(name), rest);
  }
  const target = sub === "start" || sub === "share" || sub === "http" ? need(rest[0], "port or URL") : sub;
  parseTunnelTarget(target);
  const { tunnel, connection } = await pxxl.tunnels.expose(target, { ...tunnelOptions(args, target), name: flagValue(args, "--name") });
  return runTunnel(connection, tunnel, args);
}

function tunnelOptions(args: string[], target: string): TunnelOptions {
  return {
    target,
    basicAuth: flagValue(args, "--auth"),
    requestHeaders: headerFlags(args, "--header"),
    responseHeaders: headerFlags(args, "--response-header"),
    hostHeader: flagValue(args, "--host-header"),
    allowInsecureTarget: !args.includes("--strict-tls"),
  };
}

function shellWord(value: string) {
  return /^[\w.-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`;
}

async function runTunnel(connection: TunnelConnection, tunnel: Tunnel, args: string[]) {
  const asJSON = args.includes("--json");
  const quiet = args.includes("--quiet");
  const stop = () => { connection.close(); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  let announced = false;
  connection.on("status", (status) => {
    if (asJSON) return print(JSON.stringify({ event: "status", status, at: new Date().toISOString() }));
    if (status === "reconnecting" && !quiet) print(yellow(`${clock()}  connection dropped, reconnecting…`));
  });
  connection.on("online", (hello) => {
    if (asJSON) return print(JSON.stringify({ event: "online", publicUrl: hello.publicUrl, tunnel: tunnel.id, target: connection.target.href }));
    if (quiet) { if (!announced) print(hello.publicUrl); announced = true; return; }
    if (announced) return print(green(`${clock()}  reconnected`));
    announced = true;
    print(`${green("✓")} Tunnel ${bold(hello.name || tunnel.name)} is online\n`);
    print(`  ${dim("Public URL")}   ${cyan(hello.publicUrl)}`);
    print(`  ${dim("Forwarding")}   ${connection.target.href.replace(/\/$/, "")}`);
    const extras = [hello.maxBodyBytes ? `${formatBytes(hello.maxBodyBytes)} per request` : "", hello.websockets ? "WebSockets on" : "", args.includes("--auth") ? "sign-in required" : ""].filter(Boolean);
    if (extras.length) print(`  ${dim("Limits")}       ${extras.join(" · ")}`);
    print(dim("\n  Ctrl+C to stop\n"));
  });
  connection.on("request", (event: TunnelRequestEvent) => {
    if (asJSON) return print(JSON.stringify({ event: "request", ...event, at: new Date().toISOString() }));
    if (quiet) return;
    const detail = event.websocket ? dim("websocket") : `${event.durationMs}ms`;
    print(`${dim(clock())}  ${event.method.padEnd(6)} ${event.path}  ${statusColor(event.status)}  ${detail}${event.error ? `  ${red(event.error)}` : ""}`);
  });
  const failure = new Promise<never>((_, reject) => connection.once("error", reject));
  try {
    await Promise.race([connection.closed, failure]);
  } catch (error) {
    if (error instanceof TunnelFatalError) throw new Error(error.message);
    throw error;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
  if (!asJSON && !quiet) print("\nStopped.");
}

// ---- webhooks ----

export async function webhookCommand(pxxl: Pxxl, args: string[]) {
  const [sub, ...rest] = args;
  const asJSON = args.includes("--json");
  const words = positionals(rest);
  if (!sub) return print(toolsHelp.webhook);
  if (sub === "list" || sub === "ls") {
    const { endpoints, limits } = await pxxl.webhooks.list();
    if (asJSON) return json({ endpoints, limits });
    if (!endpoints.length) return print(`No webhook endpoints yet. Run ${cyan("pxxl webhook create stripe")} to make one.`);
    table([["NAME", "STATUS", "URL", "REQUESTS", "LAST REQUEST", "FORWARDS TO"].map(dim), ...endpoints.map((endpoint) => [endpoint.name, endpoint.paused ? yellow("paused") : green("listening"), endpoint.url, endpoint.requestsTotal.toLocaleString(), ago(endpoint.lastRequestAt), endpoint.forwardUrl || dim("-")])]);
    return print(dim(`\n${endpoints.length} of ${limits.webhookEndpoints} endpoints on ${limits.planName} · requests kept ${Math.round(limits.webhookRetentionHours / 24) || 1} days`));
  }
  if (sub === "create") {
    const endpoint = await pxxl.webhooks.create({
      name: need(words[0] || flagValue(rest, "--name"), "endpoint name"),
      forwardUrl: flagValue(rest, "--forward"),
      responseStatus: flagValue(rest, "--status") ? Number(flagValue(rest, "--status")) : undefined,
      forwardHeaders: headerFlags(rest, "--header"),
    });
    if (asJSON) return json(endpoint);
    print(`${green("✓")} Created ${bold(endpoint.name)}`);
    print(`\n  ${cyan(endpoint.url)}\n`);
    return print(dim(`Send a request to it, then: pxxl webhook listen ${shellWord(endpoint.name)} --forward http://localhost:3000/webhooks`));
  }
  if (sub === "get") {
    const endpoint = await pxxl.webhooks.get(await defaultEndpoint(pxxl, words[0]));
    return asJSON ? json(endpoint) : printEndpoint(endpoint);
  }
  if (sub === "requests") {
    const name = await defaultEndpoint(pxxl, words[0]);
    const requests = await pxxl.webhooks.requests(name, { limit: Number(flagValue(rest, "--limit")) || 20 });
    if (asJSON) return json(requests);
    if (!requests.length) return print("No requests yet.");
    return table([["ID", "RECEIVED", "METHOD", "PATH", "SIZE", "FORWARD"].map(dim), ...requests.map((request) => [request.id, ago(request.receivedAt), request.method, request.path + (request.query ? `?${request.query}` : ""), formatBytes(request.bodySize), request.forwardStatus ? statusColor(request.forwardStatus) : request.forwardError ? red("failed") : dim("-")])]);
  }
  if (sub === "show") {
    const request = await pxxl.webhooks.request(need(words[0], "endpoint name"), need(words[1], "request id"));
    return asJSON ? json(request) : printRequest(request);
  }
  if (sub === "replay") {
    const result = await pxxl.webhooks.replay(need(words[0], "endpoint name"), need(words[1], "request id"), { url: flagValue(rest, "--to"), method: flagValue(rest, "--method"), headers: headerFlags(rest, "--header") });
    if (asJSON) return json(result);
    return print(`${statusColor(result.status)}  ${result.method} ${result.url}  ${result.durationMs}ms${result.error ? `  ${red(result.error)}` : ""}`);
  }
  if (sub === "listen") return listenCommand(pxxl, rest, words);
  if (sub === "pause" || sub === "resume") {
    const endpoint = await (sub === "pause" ? pxxl.webhooks.pause(need(words[0], "endpoint name")) : pxxl.webhooks.resume(need(words[0], "endpoint name")));
    return asJSON ? json(endpoint) : print(`${green("✓")} ${endpoint.name} is ${endpoint.paused ? "paused" : "listening"}`);
  }
  if (sub === "clear") {
    await pxxl.webhooks.clear(need(words[0], "endpoint name"));
    return print(`${green("✓")} Cleared stored requests`);
  }
  if (sub === "delete" || sub === "rm") {
    const endpoint = await pxxl.webhooks.delete(need(words[0], "endpoint name"));
    return asJSON ? json({ deleted: endpoint.id }) : print(`${green("✓")} Deleted ${bold(endpoint.name)} and its requests`);
  }
  throw new Error(`Unknown webhook command: ${sub}. Run pxxl webhook --help.`);
}

/** The named endpoint, or the only one the user has. */
async function defaultEndpoint(pxxl: Pxxl, name?: string): Promise<string> {
  if (name) return name;
  const { endpoints } = await pxxl.webhooks.list();
  if (endpoints.length === 1) return endpoints[0]!.id;
  throw new Error(endpoints.length ? "Name the endpoint: pxxl webhook list shows them." : "No webhook endpoints yet. Run pxxl webhook create <name>.");
}

async function listenCommand(pxxl: Pxxl, args: string[], words: string[]) {
  const asJSON = args.includes("--json");
  const forward = flagValue(args, "--forward");
  if (forward && !/^https?:\/\//.test(forward)) throw new Error("--forward must be an http(s) URL, like http://localhost:3000/webhooks");
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  const listener = await pxxl.webhooks.listen(await defaultEndpoint(pxxl, words[0]), {
    forward, exactPath: args.includes("--exact-path"), headers: headerFlags(args, "--header"), includeExisting: args.includes("--all"),
    intervalMs: Number(flagValue(args, "--interval")) || undefined, signal: controller.signal,
    onRequest: (event: WebhookListenEvent) => {
      if (asJSON) return print(JSON.stringify({ event: "request", request: { ...event.request, body: undefined }, delivery: event.delivery }));
      const { request, delivery } = event;
      const line = `${dim(clock())}  ${request.method.padEnd(6)} ${request.path}${request.query ? `?${request.query}` : ""}  ${dim(formatBytes(request.bodySize))}`;
      print(delivery ? `${line}  →  ${statusColor(delivery.status)} ${dim(`${delivery.durationMs}ms`)}${delivery.error ? `  ${red(delivery.error)}` : ""}` : line);
    },
    onError: (error) => { if (!asJSON) print(yellow(`${clock()}  ${error.message} (retrying)`)); },
  });
  if (!asJSON) {
    print(`${green("✓")} Listening on ${bold(listener.endpoint.name)}\n`);
    print(`  ${dim("Webhook URL")}  ${cyan(listener.endpoint.url)}`);
    if (forward) print(`  ${dim("Forwarding")}   ${forward}${args.includes("--exact-path") ? "" : dim(" + request path")}`);
    print(dim("\n  Ctrl+C to stop\n"));
  }
  await listener.closed;
  process.off("SIGINT", stop);
}

function printEndpoint(endpoint: WebhookEndpoint) {
  print(bold(endpoint.name));
  const rows: [string, string][] = [["URL", cyan(endpoint.url)], ["Status", endpoint.paused ? yellow("paused") : green("listening")], ["Answers with", String(endpoint.responseStatus)], ["Forwards to", endpoint.forwardUrl || "-"], ["Requests", endpoint.requestsTotal.toLocaleString()], ["Last request", ago(endpoint.lastRequestAt)], ["ID", endpoint.id]];
  for (const [name, value] of rows) print(`  ${dim(name.padEnd(13))} ${value}`);
  const headers = Object.entries(endpoint.forwardHeaders || {});
  if (headers.length) print(`  ${dim("Headers".padEnd(13))} ${headers.map(([name]) => name).join(", ")}`);
}

function printRequest(request: WebhookRequest) {
  print(`${bold(`${request.method} ${request.path}${request.query ? `?${request.query}` : ""}`)}  ${dim(`${request.receivedAt} · ${request.sourceIp} · ${formatBytes(request.bodySize)}`)}`);
  print(dim("\nHeaders"));
  for (const [name, values] of Object.entries(request.headers || {}).sort()) for (const value of values) print(`  ${name}: ${value}`);
  print(dim("\nBody"));
  if (!request.body) return print(dim("  (empty)"));
  if (request.bodyEncoding === "base64") return print(dim(`  ${request.bodySize} bytes of binary data (use --json to get it base64-encoded)`));
  try {
    print(JSON.stringify(JSON.parse(request.body), null, 2));
  } catch {
    print(request.body);
  }
}

// ---- checks and limits ----

export async function checkCommand(pxxl: Pxxl, args: string[]) {
  const [kind, ...rest] = args;
  const asJSON = args.includes("--json");
  const target = positionals(rest)[0];
  if (kind === "http" || kind === "url") {
    const url = need(target, "URL");
    const result = await pxxl.tools.httpCheck({ url: /^https?:\/\//.test(url) ? url : `https://${url}`, method: flagValue(rest, "--method"), headers: headerFlags(rest, "--header") }) as Record<string, any>;
    if (asJSON) return json(result);
    if (result.error) print(red(result.error));
    for (const hop of result.hops || []) {
      const timings = Object.entries(hop.timingsMs || {}).map(([name, ms]) => `${name} ${ms}ms`).join(" · ");
      print(`${statusColor(hop.status)}  ${hop.url}${hop.location ? dim(`  →  ${hop.location}`) : ""}`);
      if (timings) print(dim(`     ${timings}`));
    }
    const tls = result.tls;
    if (tls?.chain?.[0]) print(`\n${dim("TLS")}  ${tls.version} · ${tls.chain[0].subject} · expires in ${tls.chain[0].daysLeft} days${tls.valid === false ? red(`  ${tls.validationError}`) : ""}`);
    return print(dim(`\n${result.totalMs}ms total${result.redirects ? ` · ${result.redirects} redirects` : ""}`));
  }
  if (kind === "domain" || kind === "dns" || kind === "ssl") {
    const host = need(target, "hostname").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const result = await pxxl.tools.domainCheck(host) as Record<string, any>;
    if (asJSON) return json(result);
    print(bold(result.host || host));
    const dns = result.dns || {};
    for (const [type, value] of Object.entries(dns)) {
      const values = Array.isArray(value) ? value.map((item) => (typeof item === "object" ? `${item.priority} ${item.host}` : String(item))) : [String(value)];
      if (values.length) print(`  ${dim(type.toUpperCase().padEnd(6))} ${values.join(", ")}`);
    }
    const leaf = result.tls?.chain?.[0];
    if (leaf) print(`  ${dim("TLS".padEnd(6))} ${leaf.issuer} · expires in ${leaf.daysLeft} days${result.tls.valid === false ? red(`  ${result.tls.validationError}`) : green("  valid")}`);
    else if (result.tlsError) print(`  ${dim("TLS".padEnd(6))} ${red(result.tlsError)}`);
    return;
  }
  return print(toolsHelp.check);
}

export async function toolsCommand(pxxl: Pxxl, args: string[]) {
  if (args[0] && args[0] !== "limits") return print(toolsHelp.tools);
  const { limits, usage } = await pxxl.tools.limits();
  if (args.includes("--json")) return json({ limits, usage });
  print(`${bold("Tools")} on ${limits.planName}\n`);
  print(`  ${dim("Tunnels".padEnd(18))} ${usage.tunnels} of ${limits.tunnels}${limits.tunnels ? dim(` · ${formatBytes(limits.tunnelMaxBodyBytes)} per request`) : dim(" · Plus and above")}`);
  print(`  ${dim("Webhook endpoints".padEnd(18))} ${usage.webhookEndpoints} of ${limits.webhookEndpoints}${dim(` · ${formatBytes(limits.webhookMaxBodyBytes)} payloads`)}`);
  print(`  ${dim("Stored requests".padEnd(18))} ${usage.webhookRequests.toLocaleString()} of ${limits.webhookStoredRequests.toLocaleString()}${dim(` · kept ${Math.round(limits.webhookRetentionHours / 24) || 1} days`)}`);
  print(`  ${dim("Forwarding".padEnd(18))} ${limits.webhookForwarding ? green("included") : dim("Plus and above")}`);
}

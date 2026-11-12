import { EventEmitter } from "node:events";
import { createServer, request as httpRequest, type IncomingMessage, type OutgoingHttpHeaders, type ServerResponse } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";
import type { Duplex } from "node:stream";
import WebSocket from "ws";
import { YamuxSession, type YamuxStream } from "./yamux.js";

export type TunnelStatus = "connecting" | "online" | "reconnecting" | "closed";

export interface TunnelRequestEvent {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  bytes: number;
  websocket?: boolean;
  error?: string;
}

export interface TunnelOptions {
  /** The local service: a port (3000) or a URL (http://localhost:8080, https://app.test). */
  target: string | number;
  /** Ask visitors for this username and password before anything reaches your app. */
  basicAuth?: string | { username: string; password: string };
  /** Headers added to every request sent to your app. */
  requestHeaders?: Record<string, string>;
  /** Headers added to every response sent back to visitors. */
  responseHeaders?: Record<string, string>;
  /** The Host header your app sees: "rewrite" (the target's host, the default), "preserve" (the public host) or a value. */
  hostHeader?: "rewrite" | "preserve" | string;
  /** Accept self-signed certificates on an https target (default true: the target is your own machine). */
  allowInsecureTarget?: boolean;
  /** Reconnect when the connection drops (default true). */
  reconnect?: boolean;
  /** Stop the tunnel when this signal aborts. */
  signal?: AbortSignal;
}

export interface TunnelConnectionInit extends TunnelOptions {
  url: string;
  headers: Record<string, string>;
  userAgent: string;
}

export interface TunnelHello {
  publicUrl: string;
  name: string;
  tunnelId?: string;
  slug?: string;
  maxBodyBytes?: number;
  websockets?: boolean;
}

/** Thrown when connecting cannot succeed by retrying (bad key, missing tunnel, plan limit). */
export class TunnelFatalError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "TunnelFatalError";
  }
}

/** Parse a port or URL into the local target. */
export function parseTunnelTarget(raw: string | number): URL {
  let value = String(raw).trim();
  if (/^\d{1,5}$/.test(value)) value = `http://localhost:${value}`;
  if (!value.includes("://")) value = `http://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`The target must be a port or an http(s) URL, like 3000 or http://localhost:8080 (got "${raw}")`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("The target must be an http:// or https:// URL");
  return parsed;
}

function basicAuthHeader(value: TunnelOptions["basicAuth"]): string | undefined {
  if (!value) return undefined;
  const pair = typeof value === "string" ? value : `${value.username}:${value.password}`;
  if (!pair.includes(":")) throw new Error("basicAuth must be user:password");
  return `Basic ${Buffer.from(pair).toString("base64")}`;
}

/**
 * A live tunnel. Events: "status" (TunnelStatus), "online" (TunnelHello),
 * "request" (TunnelRequestEvent), "error" (Error, only when it stops for good).
 */
export class TunnelConnection extends EventEmitter {
  status: TunnelStatus = "connecting";
  publicUrl = "";
  hello?: TunnelHello;
  readonly target: URL;
  readonly closed: Promise<void>;
  private socket?: WebSocket;
  private session?: YamuxSession;
  private stopped = false;
  private resolveClosed!: () => void;
  private readonly http = createServer();
  private readonly auth?: string;
  private heartbeat?: NodeJS.Timeout;

  constructor(private readonly init: TunnelConnectionInit) {
    super();
    this.target = parseTunnelTarget(init.target);
    this.auth = basicAuthHeader(init.basicAuth);
    this.closed = new Promise((resolve) => { this.resolveClosed = resolve; });
    this.http.on("request", (request, response) => this.handleRequest(request, response));
    this.http.on("upgrade", (request, socket, head) => this.handleUpgrade(request, socket, head));
    this.http.on("clientError", (_error, socket) => socket.destroy());
    init.signal?.addEventListener("abort", () => this.close(), { once: true });
    void this.run();
  }

  /** Resolves with the public URL once connected; rejects if it stops for good first. */
  ready(): Promise<string> {
    if (this.status === "online") return Promise.resolve(this.publicUrl);
    return new Promise((resolve, reject) => {
      const onOnline = () => { cleanup(); resolve(this.publicUrl); };
      const onError = (error: Error) => { cleanup(); reject(error); };
      const cleanup = () => { this.off("online", onOnline); this.off("error", onError); };
      this.once("online", onOnline);
      this.once("error", onError);
    });
  }

  close() {
    if (this.stopped) return;
    this.stopped = true;
    this.session?.close();
    this.socket?.close();
    this.setStatus("closed");
    this.resolveClosed();
  }

  private setStatus(status: TunnelStatus) {
    if (this.status === status) return;
    this.status = status;
    this.emit("status", status);
  }

  private async run() {
    let backoff = 1000;
    while (!this.stopped) {
      const started = Date.now();
      try {
        await this.connectOnce();
      } catch (error) {
        if (error instanceof TunnelFatalError || this.init.reconnect === false) {
          this.stopped = true;
          this.setStatus("closed");
          if (this.listenerCount("error")) this.emit("error", error);
          this.resolveClosed();
          return;
        }
      }
      if (this.stopped) return;
      if (Date.now() - started > 30_000) backoff = 1000;
      this.setStatus("reconnecting");
      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff = Math.min(backoff * 2, 30_000);
    }
  }

  private connectOnce(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.init.url, { headers: { ...this.init.headers, "User-Agent": this.init.userAgent }, handshakeTimeout: 20_000, perMessageDeflate: false });
      this.socket = socket;
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearInterval(this.heartbeat);
        this.session?.close();
        this.session = undefined;
        if (error) reject(error); else resolve();
      };
      socket.on("unexpected-response", (_request, response) => {
        let body = "";
        response.on("data", (chunk: Buffer) => { if (body.length < 4096) body += chunk.toString(); });
        response.on("end", () => {
          let message = `Pxxl refused the tunnel connection (${response.statusCode})`;
          try { message = JSON.parse(body).message || message; } catch { /* not JSON */ }
          const status = response.statusCode || 0;
          finish([401, 402, 403, 404].includes(status) ? new TunnelFatalError(message, status) : new Error(message));
          socket.terminate();
        });
      });
      socket.on("error", (error) => finish(error));
      socket.on("close", () => finish());
      let alive = true;
      socket.on("pong", () => { alive = true; });
      socket.once("message", (data: Buffer) => {
        try { this.hello = JSON.parse(data.toString()) as TunnelHello; } catch { this.hello = { publicUrl: "", name: "" }; }
        this.publicUrl = this.hello.publicUrl;
        this.session = new YamuxSession((frame) => { if (socket.readyState === WebSocket.OPEN) socket.send(frame); }, (stream) => this.serve(stream), () => socket.close());
        socket.on("message", (chunk: Buffer) => this.session?.receive(chunk));
        // The Gateway pings over yamux; this catches a connection that died without a close.
        this.heartbeat = setInterval(() => {
          if (!alive) return socket.terminate();
          alive = false;
          socket.ping();
        }, 25_000);
        this.setStatus("online");
        this.emit("online", this.hello);
      });
    });
  }

  private serve(stream: YamuxStream) {
    this.http.emit("connection", stream as unknown as Socket);
  }

  private authorized(request: IncomingMessage): boolean {
    return !this.auth || request.headers.authorization === this.auth;
  }

  private targetHeaders(request: IncomingMessage): OutgoingHttpHeaders {
    const headers: OutgoingHttpHeaders = { ...request.headers, ...lowerKeys(this.init.requestHeaders) };
    const mode = this.init.hostHeader || "rewrite";
    if (mode === "rewrite") headers.host = this.target.host;
    else if (mode !== "preserve") headers.host = mode;
    if (this.auth) delete headers.authorization;
    return headers;
  }

  private targetPath(request: IncomingMessage) {
    const base = this.target.pathname.replace(/\/+$/, "");
    return `${base}${request.url || "/"}`;
  }

  private handleRequest(request: IncomingMessage, response: ServerResponse) {
    const started = Date.now();
    const report = (status: number, bytes: number, error?: string) => this.emit("request", { method: request.method || "GET", path: request.url || "/", status, durationMs: Date.now() - started, bytes, error } satisfies TunnelRequestEvent);
    if (!this.authorized(request)) {
      response.writeHead(401, { "WWW-Authenticate": 'Basic realm="Pxxl tunnel"', "Content-Type": "text/plain; charset=utf-8" });
      response.end("This tunnel needs a username and password.\n");
      return report(401, 0);
    }
    const send = this.target.protocol === "https:" ? httpsRequest : httpRequest;
    const outbound = send({
      protocol: this.target.protocol, hostname: this.target.hostname, port: this.target.port || undefined,
      method: request.method, path: this.targetPath(request), headers: this.targetHeaders(request),
      rejectUnauthorized: this.init.allowInsecureTarget === false,
    }, (local) => {
      let bytes = 0;
      local.on("data", (chunk: Buffer) => { bytes += chunk.length; });
      response.writeHead(local.statusCode || 502, { ...local.headers, ...lowerKeys(this.init.responseHeaders) });
      local.pipe(response);
      local.on("end", () => report(local.statusCode || 502, bytes));
    });
    outbound.on("error", (error) => {
      if (!response.headersSent) {
        const body = `Pxxl tunnel could not reach ${this.target.origin}: ${error.message}\n`;
        response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
        response.end(body);
      } else response.destroy();
      report(502, 0, error.message);
    });
    request.pipe(outbound);
  }

  private handleUpgrade(request: IncomingMessage, client: Duplex, head: Buffer) {
    const started = Date.now();
    if (!this.authorized(request)) {
      client.end("HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm=\"Pxxl tunnel\"\r\nContent-Length: 0\r\n\r\n");
      return;
    }
    const port = Number(this.target.port || (this.target.protocol === "https:" ? 443 : 80));
    const local = this.target.protocol === "https:"
      ? tlsConnect({ host: this.target.hostname, port, servername: this.target.hostname, rejectUnauthorized: this.init.allowInsecureTarget === false })
      : netConnect({ host: this.target.hostname, port });
    local.once(this.target.protocol === "https:" ? "secureConnect" : "connect", () => {
      const lines = [`${request.method} ${this.targetPath(request)} HTTP/1.1`];
      for (const [name, value] of Object.entries(this.targetHeaders(request))) {
        for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) lines.push(`${name}: ${item}`);
      }
      local.write(`${lines.join("\r\n")}\r\n\r\n`);
      if (head.length) local.write(head);
      local.pipe(client);
      client.pipe(local);
      this.emit("request", { method: request.method || "GET", path: request.url || "/", status: 101, durationMs: Date.now() - started, bytes: 0, websocket: true } satisfies TunnelRequestEvent);
    });
    const end = () => { local.destroy(); client.destroy(); };
    local.on("error", (error) => {
      client.end(`HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(error.message) + 1}\r\n\r\n${error.message}\n`);
      this.emit("request", { method: request.method || "GET", path: request.url || "/", status: 502, durationMs: Date.now() - started, bytes: 0, websocket: true, error: error.message } satisfies TunnelRequestEvent);
    });
    local.on("close", end);
    client.on("error", end);
    client.on("close", end);
  }
}

function lowerKeys(headers: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(headers || {}).map(([name, value]) => [name.toLowerCase(), value]));
}

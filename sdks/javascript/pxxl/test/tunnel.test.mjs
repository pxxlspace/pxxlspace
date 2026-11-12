import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import WebSocket, { WebSocketServer } from "ws";
import { TunnelConnection, TunnelFatalError, parseTunnelTarget } from "../../../../dist/index.js";

// A stand-in for the Gateway's side of a tunnel: it sends the hello, then acts
// as the yamux client (odd stream ids), opening one stream per request, like
// internal/handlers/tools_tunnel_relay.go.
function frame(type, flags, id, payload = Buffer.alloc(0), length = payload.length) {
  const header = Buffer.alloc(12);
  header.writeUInt8(0, 0);
  header.writeUInt8(type, 1);
  header.writeUInt16BE(flags, 2);
  header.writeUInt32BE(id, 4);
  header.writeUInt32BE(length, 8);
  return Buffer.concat([header, payload]);
}

function fakeGateway({ refuse } = {}) {
  const server = createServer();
  const wss = new WebSocketServer({ noServer: true });
  const state = { headers: null, socket: null, pongs: 0, nextId: 1, streams: new Map(), buffer: Buffer.alloc(0) };
  server.on("upgrade", (request, socket, head) => {
    if (refuse) {
      socket.end(`HTTP/1.1 ${refuse} Refused\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{"message":"That API key cannot use tunnels."}`);
      return;
    }
    state.headers = request.headers;
    wss.handleUpgrade(request, socket, head, (ws) => {
      state.socket = ws;
      ws.send(Buffer.from(JSON.stringify({ publicUrl: "https://example.test/t/abc", name: "dev", slug: "abc", websockets: true, maxBodyBytes: 1048576 })));
      ws.on("message", (chunk) => {
        state.buffer = Buffer.concat([state.buffer, chunk]);
        while (state.buffer.length >= 12) {
          const type = state.buffer.readUInt8(1), flags = state.buffer.readUInt16BE(2), id = state.buffer.readUInt32BE(4), length = state.buffer.readUInt32BE(8);
          const size = type === 0 ? 12 + length : 12;
          if (state.buffer.length < size) break;
          const payload = state.buffer.subarray(12, size);
          state.buffer = state.buffer.subarray(size);
          if (type === 2 && flags & 2) state.pongs += 1;
          const stream = state.streams.get(id);
          if (!stream) continue;
          if (type === 0 && payload.length) { stream.data = Buffer.concat([stream.data, payload]); stream.onData?.(); ws.send(frame(1, 0, id, Buffer.alloc(0), payload.length)); }
          if (flags & 4) { stream.fin = true; stream.onData?.(); }
        }
      });
    });
  });
  // Open a stream, write raw bytes, return the stream for reading.
  state.open = (bytes, { end = false } = {}) => {
    const id = state.nextId;
    state.nextId += 2;
    const stream = { id, data: Buffer.alloc(0), fin: false, onData: null };
    state.streams.set(id, stream);
    state.socket.send(frame(1, 1, id, Buffer.alloc(0), 768 * 1024));
    state.socket.send(frame(0, end ? 4 : 0, id, Buffer.from(bytes)));
    stream.write = (more) => state.socket.send(frame(0, 0, id, Buffer.from(more)));
    stream.until = (check) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out; got ${stream.data.toString()}`)), 3000);
      stream.onData = () => { if (check(stream)) { clearTimeout(timer); resolve(stream.data.toString()); } };
      stream.onData();
    });
    return stream;
  };
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ state, url: `ws://127.0.0.1:${server.address().port}/connect`, close: () => { wss.close(); server.close(); } })));
}

function localApp() {
  const app = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      response.setHeader("X-App", "local");
      response.end(`method=${request.method} path=${request.url} host=${request.headers.host} extra=${request.headers["x-extra"]} auth=${request.headers.authorization || ""} body=${body}`);
    });
  });
  const wss = new WebSocketServer({ server: app, path: "/ws" });
  wss.on("connection", (ws) => ws.on("message", (message) => ws.send(`echo:${message}`)));
  return new Promise((resolve) => app.listen(0, "127.0.0.1", () => resolve({ port: app.address().port, close: () => { wss.close(); app.close(); } })));
}

test("parseTunnelTarget accepts ports and URLs", () => {
  assert.equal(parseTunnelTarget(3000).href, "http://localhost:3000/");
  assert.equal(parseTunnelTarget("localhost:8080/api").href, "http://localhost:8080/api");
  assert.throws(() => parseTunnelTarget("ftp://x"));
});

test("a tunnel relays HTTP and WebSockets from the Gateway to a local app", async () => {
  const gateway = await fakeGateway();
  const app = await localApp();
  const tunnel = new TunnelConnection({ url: gateway.url, headers: { Authorization: "Bearer pxxl_test" }, userAgent: "test", target: app.port, requestHeaders: { "X-Extra": "yes" }, responseHeaders: { "X-Tunnel": "pxxl" } });
  try {
    assert.equal(await tunnel.ready(), "https://example.test/t/abc");
    assert.equal(gateway.state.headers.authorization, "Bearer pxxl_test");
    assert.equal(gateway.state.headers.origin, undefined);

    const stream = gateway.state.open("POST /hello?x=1 HTTP/1.1\r\nHost: example.test\r\nContent-Length: 4\r\n\r\nping");
    const response = await stream.until((s) => s.data.toString().includes("body=ping"));
    assert.match(response, /^HTTP\/1\.1 200 OK/);
    assert.match(response, /x-tunnel: pxxl/i);
    assert.match(response, new RegExp(`method=POST path=/hello\\?x=1 host=localhost:${app.port} extra=yes`));

    // A larger body than one yamux frame, both ways.
    const big = "x".repeat(300 * 1024);
    const large = gateway.state.open(`PUT /big HTTP/1.1\r\nHost: example.test\r\nContent-Length: ${big.length}\r\n\r\n${big}`);
    const largeResponse = await large.until((s) => s.data.length > big.length);
    assert.ok(largeResponse.endsWith(big));

    // Gateway pings are answered.
    gateway.state.socket.send(frame(2, 1, 0, Buffer.alloc(0), 7));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(gateway.state.pongs, 1);

    // A WebSocket upgrade, then frames both ways.
    const key = Buffer.from("0123456789abcdef").toString("base64");
    const upgrade = gateway.state.open(`GET /ws HTTP/1.1\r\nHost: example.test\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`, { end: false });
    await upgrade.until((s) => s.data.toString().includes("\r\n\r\n"));
    assert.match(upgrade.data.toString(), /^HTTP\/1\.1 101/);
    upgrade.data = Buffer.alloc(0);
    // A masked client text frame "hi".
    const mask = Buffer.from([1, 2, 3, 4]);
    const text = Buffer.from("hi").map((byte, index) => byte ^ mask[index % 4]);
    upgrade.write(Buffer.concat([Buffer.from([0x81, 0x80 | 2]), mask, text]));
    await upgrade.until((s) => s.data.length >= 9);
    assert.equal(upgrade.data.subarray(2).toString(), "echo:hi");
  } finally {
    tunnel.close();
    gateway.close();
    app.close();
  }
});

test("basic auth is required before anything reaches the app", async () => {
  const gateway = await fakeGateway();
  const app = await localApp();
  const tunnel = new TunnelConnection({ url: gateway.url, headers: {}, userAgent: "test", target: app.port, basicAuth: "dev:secret" });
  try {
    await tunnel.ready();
    const denied = await gateway.state.open("GET / HTTP/1.1\r\nHost: example.test\r\n\r\n").until((s) => s.data.toString().includes("sign in") || s.data.toString().includes("password"));
    assert.match(denied, /^HTTP\/1\.1 401/);
    const auth = Buffer.from("dev:secret").toString("base64");
    const allowed = await gateway.state.open(`GET / HTTP/1.1\r\nHost: example.test\r\nAuthorization: Basic ${auth}\r\n\r\n`).until((s) => s.data.toString().includes("body="));
    assert.match(allowed, /^HTTP\/1\.1 200/);
    assert.match(allowed, /auth= body=/, "the visitor's credentials are not passed to the app");
  } finally {
    tunnel.close();
    gateway.close();
    app.close();
  }
});

test("a refused key stops the tunnel with the Gateway's message", async () => {
  const gateway = await fakeGateway({ refuse: 403 });
  const tunnel = new TunnelConnection({ url: gateway.url, headers: {}, userAgent: "test", target: 3000 });
  try {
    await assert.rejects(tunnel.ready(), (error) => error instanceof TunnelFatalError && error.status === 403 && /cannot use tunnels/.test(error.message));
    assert.equal(tunnel.status, "closed");
  } finally {
    gateway.close();
  }
});

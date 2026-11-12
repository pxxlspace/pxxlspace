import { Duplex } from "node:stream";

/**
 * A small yamux implementation (https://github.com/hashicorp/yamux/blob/master/spec.md),
 * the multiplexing the Pxxl Gateway runs over a tunnel's WebSocket. Pxxl opens
 * one stream per public request; this side accepts them.
 */

const VERSION = 0;
const TYPE_DATA = 0;
const TYPE_WINDOW_UPDATE = 1;
const TYPE_PING = 2;
const TYPE_GO_AWAY = 3;
const FLAG_SYN = 1;
const FLAG_ACK = 2;
const FLAG_FIN = 4;
const FLAG_RST = 8;
const HEADER_SIZE = 12;
const INITIAL_WINDOW = 256 * 1024;
const MAX_WINDOW = 1024 * 1024;
const MAX_FRAME = 64 * 1024;

function header(type: number, flags: number, streamId: number, length: number): Buffer {
  const frame = Buffer.alloc(HEADER_SIZE);
  frame.writeUInt8(VERSION, 0);
  frame.writeUInt8(type, 1);
  frame.writeUInt16BE(flags, 2);
  frame.writeUInt32BE(streamId, 4);
  frame.writeUInt32BE(length, 8);
  return frame;
}

type PendingWrite = { data: Buffer; callback: (error?: Error | null) => void };

export class YamuxStream extends Duplex {
  /** Set so Node's HTTP server can treat the stream like a socket. */
  remoteAddress = "127.0.0.1";
  remotePort = 0;
  private sendWindow = INITIAL_WINDOW;
  private uncredited = 0;
  private pending: PendingWrite[] = [];
  private localClosed = false;
  private remoteClosed = false;

  constructor(readonly id: number, private readonly session: YamuxSession) {
    super({ allowHalfOpen: true });
  }

  setTimeout() { return this; }
  setNoDelay() { return this; }
  setKeepAlive() { return this; }
  ref() { return this; }
  unref() { return this; }

  /** @internal */
  receiveData(data: Buffer) {
    if (this.remoteClosed || this.destroyed) return;
    this.uncredited += data.length;
    if (this.push(data)) this.credit();
  }

  /** @internal */
  receiveWindow(delta: number) {
    this.sendWindow += delta;
    this.flush();
  }

  /** @internal */
  receiveFlags(flags: number) {
    if (flags & FLAG_RST) {
      this.remoteClosed = this.localClosed = true;
      this.destroy();
      return;
    }
    if (flags & FLAG_FIN && !this.remoteClosed) {
      this.remoteClosed = true;
      this.push(null);
      this.maybeForget();
    }
  }

  _read() {
    this.credit();
  }

  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    if (this.localClosed) return callback(new Error("yamux stream is closed"));
    this.pending.push({ data: Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk), callback });
    this.flush();
  }

  _final(callback: (error?: Error | null) => void) {
    const finish = () => {
      if (!this.localClosed) {
        this.localClosed = true;
        this.session.send(header(TYPE_WINDOW_UPDATE, FLAG_FIN, this.id, 0));
      }
      this.maybeForget();
      callback();
    };
    if (!this.pending.length) return finish();
    this.pending.push({ data: Buffer.alloc(0), callback: () => finish() });
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void) {
    if (!this.localClosed || !this.remoteClosed) this.session.send(header(TYPE_WINDOW_UPDATE, FLAG_RST, this.id, 0));
    this.localClosed = this.remoteClosed = true;
    for (const write of this.pending.splice(0)) write.callback(error || new Error("yamux stream reset"));
    this.session.forget(this.id);
    callback(error);
  }

  private credit() {
    if (this.uncredited <= 0 || this.remoteClosed) return;
    this.session.send(header(TYPE_WINDOW_UPDATE, 0, this.id, this.uncredited));
    this.uncredited = 0;
  }

  private flush() {
    while (this.pending.length) {
      const write = this.pending[0]!;
      if (!write.data.length) {
        this.pending.shift();
        write.callback();
        continue;
      }
      if (this.sendWindow <= 0) return;
      const size = Math.min(write.data.length, this.sendWindow, MAX_FRAME);
      this.session.send(Buffer.concat([header(TYPE_DATA, 0, this.id, size), write.data.subarray(0, size)]));
      this.sendWindow -= size;
      write.data = write.data.subarray(size);
      if (!write.data.length) {
        this.pending.shift();
        write.callback();
      }
    }
  }

  private maybeForget() {
    if (this.localClosed && this.remoteClosed) this.session.forget(this.id);
  }
}

/** The accepting side of a yamux session over any transport that carries bytes in order. */
export class YamuxSession {
  private buffer: Buffer = Buffer.alloc(0);
  private readonly streams = new Map<number, YamuxStream>();
  private closed = false;

  constructor(private readonly write: (data: Buffer) => void, private readonly onStream: (stream: YamuxStream) => void, private readonly onClose: () => void = () => {}) {}

  get streamCount() { return this.streams.size; }

  /** Feed bytes received from the transport. */
  receive(chunk: Buffer) {
    if (this.closed) return;
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    while (this.buffer.length >= HEADER_SIZE) {
      const type = this.buffer.readUInt8(1);
      const flags = this.buffer.readUInt16BE(2);
      const streamId = this.buffer.readUInt32BE(4);
      const length = this.buffer.readUInt32BE(8);
      const frameSize = type === TYPE_DATA ? HEADER_SIZE + length : HEADER_SIZE;
      if (this.buffer.length < frameSize) return;
      const payload = type === TYPE_DATA ? this.buffer.subarray(HEADER_SIZE, frameSize) : undefined;
      this.buffer = this.buffer.subarray(frameSize);
      this.handle(type, flags, streamId, length, payload);
    }
  }

  /** @internal */
  send(frame: Buffer) {
    if (!this.closed) this.write(frame);
  }

  /** @internal */
  forget(id: number) {
    this.streams.delete(id);
  }

  close() {
    if (this.closed) return;
    this.send(header(TYPE_GO_AWAY, 0, 0, 0));
    this.closed = true;
    for (const stream of this.streams.values()) stream.destroy();
    this.streams.clear();
    this.onClose();
  }

  private handle(type: number, flags: number, streamId: number, length: number, payload?: Buffer) {
    if (type === TYPE_PING) {
      if (flags & FLAG_SYN) this.send(header(TYPE_PING, FLAG_ACK, 0, length));
      return;
    }
    if (type === TYPE_GO_AWAY) {
      this.closed = true;
      for (const stream of this.streams.values()) stream.destroy();
      this.streams.clear();
      this.onClose();
      return;
    }
    let stream = this.streams.get(streamId);
    if (!stream && flags & FLAG_SYN) {
      stream = new YamuxStream(streamId, this);
      this.streams.set(streamId, stream);
      // Accept, and offer the peer our full window.
      this.send(header(TYPE_WINDOW_UPDATE, FLAG_ACK, streamId, MAX_WINDOW - INITIAL_WINDOW));
      this.onStream(stream);
    }
    if (!stream) {
      if (!(flags & FLAG_RST)) this.send(header(TYPE_WINDOW_UPDATE, FLAG_RST, streamId, 0));
      return;
    }
    if (type === TYPE_WINDOW_UPDATE) stream.receiveWindow(length);
    else if (payload?.length) stream.receiveData(payload);
    stream.receiveFlags(flags);
  }
}

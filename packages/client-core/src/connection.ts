// The protocol client: connects, says hello, keeps chunk subscriptions and
// reconnects with backoff (ux.md §7). Works in browsers and in Node (pass `ws`).
import { CHUNK, PROTOCOL_VERSION, chunkKey, type ClientMsg, type ServerMsg } from '@owc/shared';
import { Mirror } from './mirror.ts';

type WSLike = {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
};
type WSCtor = new (url: string) => WSLike;

export interface ConnectionOptions {
  url: string;
  WebSocket: WSCtor;
  token?: string | null;
  name?: string;
  onToken?: (token: string) => void;
  onStatus?: (s: 'connecting' | 'open' | 'closed') => void;
  /** Wait for start() instead of connecting immediately. */
  autoStart?: boolean;
  /** The server refused to let us in (e.g. the name is taken). The connection stops. */
  onHelloError?: (msg: string, code: string) => void;
}

export class Connection {
  mirror = new Mirror();
  private ws: WSLike | null = null;
  private opts: ConnectionOptions;
  private token: string | null;
  private backoff = 500;
  private subs: [number, number][] = [];
  private rid = 1;
  private pending = new Map<number, (err: string | null) => void>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private resubTimer: ReturnType<typeof setInterval> | null = null;
  closed = false;
  /** Bytes and messages received (for the ?perf overlay). */
  stats = { bytes: 0, msgs: 0 };
  status: 'connecting' | 'open' | 'closed' = 'connecting';

  constructor(opts: ConnectionOptions) {
    this.opts = opts;
    this.token = opts.token ?? null;
    const m = this.mirror;
    const prevErr = m.onError.bind(m);
    m.onError = (msg, rid) => { if (rid != null && this.pending.has(rid)) { this.pending.get(rid)!(msg); this.pending.delete(rid); } else prevErr(msg, rid); };
    m.onAck = (rid) => { this.pending.get(rid)?.(null); this.pending.delete(rid); };
    if (opts.autoStart !== false) this.open();
  }

  /** Connect (optionally as a new player with this name). */
  start(name?: string) {
    if (name) this.opts.name = name;
    this.closed = false;
    if (this.ws && this.ws.readyState <= 1) return;
    this.open();
  }

  get hasToken() { return !!this.token; }
  forgetToken() { this.token = null; }

  private setStatus(s: 'connecting' | 'open' | 'closed') { this.status = s; this.opts.onStatus?.(s); }

  private open() {
    this.setStatus('connecting');
    const ws = new this.opts.WebSocket(this.opts.url);
    this.ws = ws;
    ws.onopen = () => {
      this.backoff = 500;
      this.sendRaw({ t: 'hello', v: PROTOCOL_VERSION, token: this.token ?? undefined, name: this.opts.name });
    };
    ws.onmessage = (ev) => {
      const raw = String(ev.data);
      this.stats.bytes += raw.length; this.stats.msgs++;
      const m = JSON.parse(raw) as ServerMsg;
      if (m.t === 'err' && m.code && this.status !== 'open') {
        this.closed = true;
        this.token = null;
        ws.close();
        this.opts.onHelloError?.(m.msg, m.code);
        return;
      }
      if (m.t === 'welcome') {
        this.token = m.token;
        this.opts.onToken?.(m.token);
        this.setStatus('open');
        // Resubscribe: the server resends chunk snapshots (networking.md §4).
        this.mirror.chunks.clear();
        if (this.subs.length) this.sendRaw({ t: 'sub', chunks: this.subs });
        this.pingTimer = setInterval(() => this.sendRaw({ t: 'ping', at: Date.now() }), 10_000);
        // The server sends at most ~30 new chunks per request: ask again for any still missing.
        this.resubTimer ??= setInterval(() => {
          if (this.status === 'open' && this.subs.some(([x, y]) => !this.mirror.chunks.has(chunkKey(x, y)))) this.sendRaw({ t: 'sub', chunks: this.subs });
        }, 700);
      }
      this.mirror.handle(m);
    };
    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.setStatus('closed');
      for (const cb of this.pending.values()) cb('Disconnected');
      this.pending.clear();
      if (!this.closed) setTimeout(() => this.open(), this.backoff);
      this.backoff = Math.min(8000, this.backoff * 1.7);
    };
    ws.onerror = () => {};
  }

  private sendRaw(m: ClientMsg) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
  }

  send(m: ClientMsg) { this.sendRaw(m); }

  /** Send a message that expects an ack or an error. */
  request(m: ClientMsg & { rid?: number }): Promise<string | null> {
    const rid = this.rid++;
    return new Promise((resolve) => {
      this.pending.set(rid, resolve);
      this.sendRaw({ ...m, rid } as ClientMsg);
      setTimeout(() => { if (this.pending.has(rid)) { this.pending.delete(rid); resolve(null); } }, 8000);
    });
  }

  /** Subscribe to the chunks covering a square area around (x, y). */
  watchArea(x: number, y: number, radius: number) {
    const c0x = Math.floor((x - radius) / CHUNK), c1x = Math.floor((x + radius) / CHUNK);
    const c0y = Math.floor((y - radius) / CHUNK), c1y = Math.floor((y + radius) / CHUNK);
    const chunks: [number, number][] = [];
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) chunks.push([cx, cy]);
    this.setSubs(chunks.slice(0, 81));
  }

  setSubs(chunks: [number, number][]) {
    const a = new Set(chunks.map(([x, y]) => chunkKey(x, y)));
    const b = new Set(this.subs.map(([x, y]) => chunkKey(x, y)));
    if (a.size === b.size && [...a].every((k) => b.has(k))) return;
    this.subs = chunks;
    this.mirror.prune(a);
    this.sendRaw({ t: 'sub', chunks });
  }

  close() { this.closed = true; if (this.resubTimer) clearInterval(this.resubTimer); this.ws?.close(); }
}

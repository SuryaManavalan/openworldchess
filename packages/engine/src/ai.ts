// Stockfish on the server (TECH.md T10): a small pool of WASM engines, each
// fed one request at a time. GPL-3, server-side only, never shipped to clients.
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
/** The engine script; run as a child process speaking UCI over stdio. */
const ENGINE = join(dirname(require.resolve('stockfish/package.json')), 'bin', 'stockfish-19-lite-single.js');

interface Engine {
  send(cmd: string): void;
  listener?: (line: string) => void;
  busy: boolean;
  proc: ChildProcess;
}

interface Job { fen: string; rating: number; movetime: number; priority: number; resolve: (uci: string | null) => void }

export class ChessAI {
  private engines: Engine[] = [];
  private queue: Job[] = [];
  private ready: Promise<void>;

  constructor(size = 2) {
    this.ready = Promise.all(Array.from({ length: size }, () => this.start())).then(() => undefined);
  }

  private start(): Promise<void> {
    return new Promise((resolve) => {
      const proc = spawn(process.execPath, [ENGINE], { stdio: ['pipe', 'pipe', 'ignore'] });
      const e: Engine = { send: (c) => proc.stdin!.write(c + '\n'), busy: false, proc };
      let buf = '';
      proc.stdout!.on('data', (d: Buffer) => {
        buf += d.toString();
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (line === 'uciok') { this.engines.push(e); resolve(); }
          e.listener?.(line);
        }
      });
      proc.on('exit', () => { this.engines = this.engines.filter((x) => x !== e); });
      e.send('uci');
    });
  }

  stop() { for (const e of this.engines) e.proc.kill(); }

  /** Best move in UCI for `fen`, played at roughly `rating` strength. */
  /** Higher priority jobs (real battles) jump ahead of lower ones (practice). */
  async bestMove(fen: string, rating: number, movetime = 400, priority = 1): Promise<string | null> {
    await this.ready;
    return new Promise((resolve) => {
      const job = { fen, rating, movetime, priority, resolve };
      const i = this.queue.findIndex((j) => j.priority < priority);
      if (i < 0) this.queue.push(job); else this.queue.splice(i, 0, job);
      this.pump();
    });
  }

  private pump() {
    const e = this.engines.find((x) => !x.busy);
    const job = this.queue.shift();
    if (!e || !job) { if (job) this.queue.unshift(job); return; }
    e.busy = true;
    const done = (uci: string | null) => { e.busy = false; e.listener = undefined; job.resolve(uci); this.pump(); };
    const timer = setTimeout(() => done(null), job.movetime + 5000);
    e.listener = (line) => {
      if (line.startsWith('bestmove')) {
        clearTimeout(timer);
        const mv = line.split(' ')[1];
        done(mv && mv !== '(none)' ? mv : null);
      }
    };
    // Stockfish's UCI_Elo floor is 1320; below that, use Skill Level.
    if (job.rating >= 1320) {
      e.send('setoption name UCI_LimitStrength value true');
      e.send(`setoption name UCI_Elo value ${Math.min(3190, Math.round(job.rating))}`);
    } else {
      e.send('setoption name UCI_LimitStrength value false');
      e.send(`setoption name Skill Level value ${Math.max(0, Math.min(8, Math.round((job.rating - 500) / 100)))}`);
    }
    e.send('ucinewgame');
    e.send(`position fen ${job.fen}`);
    e.send(`go movetime ${job.movetime}`);
  }
}

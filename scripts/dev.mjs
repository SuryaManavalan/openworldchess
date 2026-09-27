// One command for local play: game server, Vite dev client and bots.
// Usage: pnpm dev   (env: SPEED, BOTS, SEED)
import { spawn } from 'node:child_process';

const env = { ...process.env, SPEED: process.env.SPEED ?? '5', SHIELD_MS: process.env.SHIELD_MS ?? '600000' };
const run = (name, cmd, args, extra = {}) => {
  const p = spawn(cmd, args, { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = (d) => d.toString().split('\n').filter(Boolean).map((l) => `[${name}] ${l}`).join('\n');
  p.stdout.on('data', (d) => console.log(tag(d)));
  p.stderr.on('data', (d) => console.error(tag(d)));
  return p;
};

const procs = [run('server', process.execPath, ['apps/server/src/main.ts'])];
setTimeout(() => {
  procs.push(run('client', 'pnpm', ['--filter', '@owc/client', 'dev']));
  if (process.env.BOTS !== '0') procs.push(run('bots', process.execPath, ['apps/bots/src/main.ts'], { BOTS: process.env.BOTS ?? '8' }));
}, 1200);
const stop = () => { for (const p of procs) p.kill('SIGTERM'); setTimeout(() => process.exit(0), 500); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

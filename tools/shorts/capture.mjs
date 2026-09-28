// Film the real world, frame by frame, along a scripted camera path.
// Output: a 1080×1920 MP4 at exactly 30 fps, no interface (?cinema).
//
//   node tools/shorts/capture.mjs <shot.json>
//
// shot.json:
//   {
//     "base": "https://openworldchess.com",
//     "out": "out/day01/world.mp4",
//     "seconds": 18,
//     "center": [x, y] | "busiest",       // where to film ("busiest": the most buildings in view)
//     "focus": "pawn" | "king" | null,    // snap the center to the nearest such piece
//     "path": [ { "t": 0, "zoom": 2.2 }, { "t": 17, "zoom": 0.05, "dx": 0, "dy": 0 } ],
//     "ease": "inOut" | "linear" | "out",
//     "rotate": 0,                         // degrees over the whole shot (optional)
//     "scenario": "out/day02/scenario.env.json",   // film a staged local world (scenario.ts) instead of base
//     "before": [ { "act": "battle.mjs#attack", "args": {...} }, { "wait": 3000 } ],   // setup, not filmed
//     "events": [ { "t": 1.8, "act": "battle.mjs#mate", "args": {...} },               // during the shot
//                 { "t": 0, "eval": "window.__owc.ui.getState().set({ battleFocus: ... })" } ]
//   }
// Acts live in tools/shorts/acts/ (players signed in with the scenario's tokens, moves from our
// engine). An eval runs in the camera's page; it may use `B` = the staged battle's id.
// Camera keys interpolate zoom exponentially (so a zoom-out feels even), and
// dx/dy (squares, relative to the center) linearly.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const env = spec.scenario ? JSON.parse(readFileSync(resolve(spec.scenario), 'utf8')) : null;
// A staged world: its server, and its spot (plus an optional "offset" in squares).
if (env) { spec.base = env.base; spec.center ??= [env.center[0] + (spec.offset?.[0] ?? 0), env.center[1] + (spec.offset?.[1] ?? 0)]; }
const FPS = 30, W = 540, H = 960; // CSS size; ×2 device pixels = 1080×1920
const out = resolve(spec.out);
mkdirSync(dirname(out), { recursive: true });

const ease = {
  linear: (x) => x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
}[spec.ease ?? 'inOut'];

function camAt(t) {
  const p = spec.path;
  if (t <= p[0].t) return p[0];
  for (let i = 1; i < p.length; i++) {
    if (t <= p[i].t) {
      const a = p[i - 1], b = p[i], f = ease((t - a.t) / (b.t - a.t));
      return {
        zoom: Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * f),
        dx: (a.dx ?? 0) + ((b.dx ?? 0) - (a.dx ?? 0)) * f,
        dy: (a.dy ?? 0) + ((b.dy ?? 0) - (a.dy ?? 0)) * f,
      };
    }
  }
  return p[p.length - 1];
}

// A visible window renders about 10× faster than headless (a real GL driver instead of
// SwiftShader: ~175 ms a frame vs ~1.9 s at 1080×1920). It opens briefly on the desktop.
// Set "headless": true in the shot to film without a window.
const headless = spec.headless ?? !process.env.DISPLAY;
const browser = await chromium.launch({ headless, args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('page error:', e.message));
// ?watch: look at the world without an empire (no guest, no rate limit); ?cinema: no interface.
await page.goto(`${spec.base.replace(/\/$/, '')}/?cinema&watch`);
await page.waitForFunction(() => window.__owc?.scene && window.__owc.mirror.me === 'watcher', null, { timeout: 30_000 });
await page.waitForTimeout(2500);

// Acts: staged players doing things (setup before filming, or events during it).
const acts = new Map();
const ctx = { browser, page, env, args: {} };
async function run(step) {
  if (step.wait) return page.waitForTimeout(step.wait);
  if (step.eval) return page.evaluate((code) => { const m = window.__owc.mirror; const B = [...m.battles.values()].reverse().find((b) => b.phase !== 'over')?.id ?? [...m.battles.values()].at(-1)?.id; return new Function('B', code)(B); }, step.eval);
  const [file, fn] = step.act.split('#');
  if (!acts.has(file)) acts.set(file, await import(new URL(`./acts/${file}`, import.meta.url).href));
  console.log(`act ${step.act}`);
  ctx.args = step.args ?? {}; // (one shared context: an act can leave things for a later one)
  return acts.get(file)[fn](ctx, ctx.args);
}
for (const step of spec.before ?? []) await run(step);

// Where to film.
let center = spec.center;
const fly = async (x, y, zoom, wait = 2500) => {
  await page.evaluate(([x, y, z]) => { const s = window.__owc.scene; s.cam.x = x; s.cam.y = y; s.cam.zoom = z; }, [x, y, zoom]);
  await page.waitForTimeout(wait);
};
if (center === 'busiest') {
  // Look around the origin, where the first empires settled, and pick the densest spot.
  await fly(0, 0, 0.06, 4000);
  center = await page.evaluate(() => {
    const bs = [...window.__owc.mirror.buildings.values()].filter((b) => b.owner);
    let best = [0, 0], n = -1;
    for (const b of bs) { const c = bs.filter((o) => Math.abs(o.x - b.x) < 40 && Math.abs(o.y - b.y) < 40).length; if (c > n) { n = c; best = [b.x, b.y]; } }
    return best;
  });
}
await fly(center[0], center[1], spec.path[0].zoom, 1500);
if (spec.focus) {
  const kind = spec.focus === 'king' ? 'K' : 'P';
  const at = await page.evaluate(([cx, cy, k]) => {
    const ps = [...window.__owc.mirror.pieces.values()].filter((p) => p.kind === k && p.owner && p.state !== 'battle');
    ps.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    return ps[0] ? [ps[0].x, ps[0].y] : null;
  }, [center[0], center[1], kind]);
  if (at) center = at;
}
console.log('filming at', center);

// Preload the far view so chunks are in memory before the shot reaches them.
const last = spec.path[spec.path.length - 1];
await fly(center[0] + (last.dx ?? 0), center[1] + (last.dy ?? 0), last.zoom, 5000);
await fly(center[0], center[1], spec.path[0].zoom, 5000);
// Warm up: a few rendered frames at the opening shot, so frame 1 isn't half-loaded.
for (let i = 0; i < 20; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));

const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
const frames = Math.round(spec.seconds * FPS);
const events = [...(spec.events ?? [])].sort((a, b) => a.t - b.t);
for (let i = 0; i < frames; i++) {
  const t = i / FPS, c = camAt(t);
  while (events.length && events[0].t <= t) await run(events.shift());
  await page.evaluate(([x, y, z, rot]) => {
    const s = window.__owc.scene;
    s.fly = null; s.cam.x = x; s.cam.y = y; s.cam.zoom = z;
    if (rot != null) { s.cam.rot = rot; s.cam.rotShown = rot; }
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, [center[0] + c.dx, center[1] + c.dy, c.zoom, spec.rotate ? (spec.rotate * Math.PI / 180) * (t / spec.seconds) : null]);
  ff.stdin.write(await page.screenshot({ type: 'jpeg', quality: 92 }));
  if (i % 30 === 0) process.stdout.write(`\r${i}/${frames}`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
for (const m of acts.values()) m.stop?.();
await browser.close();
console.log(`\nwrote ${out}`);

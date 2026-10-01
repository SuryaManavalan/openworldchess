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
//     "as": "Aurelian",                    // (with a scenario) film as that player, interface and all,
//                                          // on a phone-sized screen: for videos about the interface
//     "css": ".tracker { display: none }", // extra CSS for the filmed page (hide what the shot doesn't need)
//     "viewport": 405,                     // CSS width (default 540); output stays 1080×1920
//     "before": [ { "act": "battle.mjs#attack", "args": {...} }, { "wait": 3000 } ],   // setup, not filmed
//     "events": [ { "t": 1.8, "act": "battle.mjs#mate", "args": {...} },               // during the shot
//                 { "t": 0, "eval": "window.__owc.ui.getState().set({ battleFocus: ... })" } ]
//   }
// Drawing on camera (city building, citybuilding.md §8), in events:
//   { "t": 4, "stroke": { "dur": 1.6, "tool": { "kind": "pave", "style": 1 }, "width": 1, "erase": false,
//                         "from": [-6, 0], "to": [2, 0] | "bridge" } }
// draws through the real input (the stroke grows frame by frame under a fingertip dot) and commits
// on its last frame. Squares are relative to the scenario's spot; "to": "bridge" runs east from
// "from" across the scenario's river. { "t": 9, "tap": [dx, dy] } taps the map there (a ripple).
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
// CSS size: 540×960 × 2 device pixels = 1080×1920. "viewport": a narrower CSS width (e.g. 405, a
// phone's) keeps the output 1080×1920 but draws the interface at a phone's size.
const FPS = 30, W = spec.viewport ?? 540, H = Math.round(W * 16 / 9), DPR = 1080 / W;
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
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
page.on('pageerror', (e) => console.log('page error:', e.message));
if (spec.as) {
  // Signed in as a staged player, with the interface: what a player sees on their phone.
  await page.goto(`${spec.base.replace(/\/$/, '')}/`);
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('owc.token', t); localStorage.setItem('owc.onboarded', '1'); localStorage.setItem('owc.storySeen', '99'); localStorage.setItem('owc.settings', JSON.stringify({ watchMode: false })); }, env.tokens[spec.as]);
  await page.goto(`${spec.base.replace(/\/$/, '')}/`);
  await page.waitForFunction(() => window.__owc?.scene && window.__owc.mirror.self, null, { timeout: 30_000 });
} else {
  // ?watch: look at the world without an empire (no guest, no rate limit); ?cinema: no interface.
  await page.goto(`${spec.base.replace(/\/$/, '')}/?cinema&watch${spec.time ? `&time=${spec.time}` : ''}${spec.nolabels ? '&nolabels' : ''}`);
  await page.waitForFunction(() => window.__owc?.scene && window.__owc.mirror.me === 'watcher', null, { timeout: 30_000 });
}
if (spec.css) await page.addStyleTag({ content: spec.css });
if (spec.as) await page.addStyleTag({ content: '.watch-pill { display: none !important; }' }); // (no one's idle on camera)
await page.waitForTimeout(2500);

// Acts: staged players doing things (setup before filming, or events during it).
const acts = new Map();
const ctx = { browser, page, env, args: {} };
// Strokes being drawn (see above), advanced every frame.
const strokes = [];
const rel = (d) => [env.center[0] + d[0], env.center[1] + d[1]];
async function finger(at, on, ripple = false) {
  await page.evaluate(([at, on, ripple]) => {
    let f = document.getElementById('film-finger');
    if (!f) { f = document.createElement('div'); f.id = 'film-finger'; f.style.cssText = 'position:fixed;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:rgba(255,255,255,0.55);border:3px solid rgba(255,255,255,0.95);box-shadow:0 2px 10px rgba(0,0,0,0.35);pointer-events:none;z-index:9999;transition:transform 0.15s,opacity 0.2s'; document.body.appendChild(f); }
    if (!at) { f.style.opacity = '0'; return; }
    const [sx, sy] = window.__owc.scene.toScreen(at[0], at[1]);
    f.style.left = sx + 'px'; f.style.top = sy + 'px'; f.style.opacity = on ? '1' : '0';
    f.style.transform = ripple ? 'scale(1.6)' : 'scale(1)';
  }, [at, on, ripple]);
}
async function run(step) {
  if (step.wait) return page.waitForTimeout(step.wait);
  if (step.stroke) {
    const s = step.stroke, a = rel(s.from);
    const b = s.to === 'bridge' ? [env.center[0] + env.river[0] + env.river[1] - 1, a[1]] : rel(s.to);
    const cells = [];
    let [x, y] = a; cells.push([x, y]);
    while (x !== b[0] || y !== b[1]) { if (x !== b[0]) x += Math.sign(b[0] - x); else y += Math.sign(b[1] - y); cells.push([x, y]); }
    await page.evaluate((s) => window.__owc.ui.getState().set({ tool: s.tool, toolErase: !!s.erase, toolWidth: s.width ?? 1, sheet: null, stroke: null, selection: [] }), s);
    strokes.push({ t0: step.t, dur: s.dur ?? 1.5, cells, done: 0 });
    return;
  }
  if (step.tap) {
    const at = rel(step.tap);
    await finger(at, true, true);
    await page.evaluate((at) => window.__owc.input.tap(at, 'touch'), at);
    setTimeout(() => {}, 0);
    strokes.push({ t0: step.t, dur: 0.35, cells: [], done: 0, hide: true });
    return;
  }
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
  for (const s of [...strokes]) {
    const k = Math.min(1, (t - s.t0) / s.dur);
    if (s.hide) { if (k >= 1) { await finger(null, false); strokes.splice(strokes.indexOf(s), 1); } continue; }
    const n = Math.max(1, Math.ceil(k * s.cells.length));
    for (; s.done < n; s.done++) await page.evaluate(([c, first]) => window.__owc.input.strokeTo(c, first), [s.cells[s.done], s.done === 0]);
    await finger(s.cells[n - 1], true);
    if (k >= 1) { await page.evaluate(() => window.__owc.input.commitStroke()); await finger(null, false); strokes.splice(strokes.indexOf(s), 1); }
  }
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

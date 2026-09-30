// The overlay renderer: draws a timeline's layers at time t on a transparent
// 1080×1920 canvas (render.mjs screenshots it frame by frame), and renders the
// timeline's music and sound effects offline (renderAudio).
//
// Layer types (all take t0/t1 in seconds):
//   text     { lines, y, size, font: 'display'|'bold', color, stroke, anim: 'slam'|'pop'|'rise'|'fade'|'type', plate, spacing }
//   label    { text, y }                                small corner tag, e.g. "4× speed" (y default 1400)
//   vignette { strength }                               darkens the edges and top/bottom bands for legible text
//   flash    { color }                                  a quick flash at t0
//   endcard  { title, sub, url, dim }                   name + CTA
//   image    { src, x, y, w, anim: 'pop'|'float'|'fade' }
//   board    { mode: 'zoom'|'drift', light, dark, speed, dim }   procedural endless chessboard (no-gameplay pieces)
//   sweep    { color }                                  a diagonal light sweep across the frame
const W = 1080, H = 1920;
// TikTok's safe area for text is about x 60–930; centered text gets the width that
// stays clear of the right-hand buttons on both sides.
const SAFE_W = 820;
const CX = 495; // the safe area's center (x 60–930), not the screen's
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const FONTS = { display: 'Cinzel', bold: 'Inter' };
const images = {};
let TL = null;

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeBack = (x) => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

window.setTimeline = async (tl) => {
  TL = tl;
  await document.fonts.load('900 100px Cinzel');
  await document.fonts.load('900 100px Inter');
  await document.fonts.load('800 100px Inter');
  await Promise.all((tl.layers || []).filter((l) => l.type === 'image').map((l) => new Promise((ok) => {
    const im = new Image(); im.onload = () => { images[l.src] = im; ok(); }; im.onerror = ok; im.src = l.src;
  })));
  return true;
};

/** 0→1 in, 1 on, 1→0 out, for a layer at time t. */
function life(l, t, fadeIn = 0.25, fadeOut = 0.2) {
  if (t < l.t0 || t > l.t1) return null;
  return { a: clamp((t - l.t0) / fadeIn) * clamp((l.t1 - t) / fadeOut), k: t - l.t0 };
}

function drawText(l, t) {
  const L = life(l, t, l.anim === 'slam' ? 0.001 : 0.22, l.out === 'cut' ? 0.001 : 0.18);
  if (!L) return;
  const font = FONTS[l.font ?? 'display'], weight = l.weight ?? 900;
  const lines = l.lines ?? [l.text];
  // Fit the safe zone: shrink until the widest line (with its stroke) fits.
  let size = l.size ?? 120;
  const maxW = l.maxWidth ?? SAFE_W;
  ctx.save();
  if (l.spacing) ctx.letterSpacing = `${l.spacing}px`;
  for (;;) {
    ctx.font = `${weight} ${size}px "${font}", system-ui, sans-serif`;
    const widest = Math.max(...lines.map((s) => ctx.measureText(s).width)) + size * 0.22;
    if (widest <= maxW || size <= 24) break;
    size = Math.floor(size * maxW / widest);
  }
  ctx.restore();
  let scale = 1, dy = 0, alpha = L.a, shown = null;
  if (l.anim === 'slam') { const p = clamp(L.k / 0.28); scale = 1.9 - 0.9 * easeOut(p); alpha *= clamp(L.k / 0.06); }
  if (l.anim === 'pop') scale = 0.6 + 0.4 * easeBack(L.k / 0.35);
  if (l.anim === 'rise') { dy = 70 * (1 - easeOut(L.k / 0.45)); }
  if (l.anim === 'type') { const total = lines.join('').length; shown = Math.floor(clamp(L.k / (l.typeSec ?? 0.05 * total)) * total); }
  const y0 = l.y ?? 520, lh = size * (l.lineHeight ?? 1.08);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(l.x ?? CX, y0 + dy);
  ctx.scale(scale, scale);
  ctx.font = `${weight} ${size}px "${font}", system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (l.spacing) ctx.letterSpacing = `${l.spacing}px`;
  if (l.plate) {
    const wmax = Math.max(...lines.map((s) => ctx.measureText(s).width));
    const hh = lh * lines.length;
    ctx.fillStyle = typeof l.plate === 'string' ? l.plate : 'rgba(20,19,18,0.62)';
    roundRect(-wmax / 2 - 40, -lh / 2 - 22, wmax + 80, hh + 44, 28); ctx.fill();
  }
  let used = 0;
  lines.forEach((s, i) => {
    let str = s;
    if (shown != null) { str = s.slice(0, Math.max(0, shown - used)); used += s.length; }
    const y = i * lh;
    if (l.glow) { ctx.shadowColor = l.glow; ctx.shadowBlur = 40; }
    if (l.stroke !== false) {
      ctx.lineJoin = 'round'; ctx.lineWidth = l.strokeWidth ?? Math.max(8, size * 0.11);
      ctx.strokeStyle = l.stroke ?? 'rgba(18,16,14,0.92)';
      ctx.strokeText(str, 0, y);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = Array.isArray(l.colors) ? l.colors[i] ?? l.color : (l.color ?? '#ece6da');
    ctx.fillText(str, 0, y);
  });
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawLabel(l, t) {
  const L = life(l, t); if (!L) return;
  ctx.save(); ctx.globalAlpha = L.a;
  ctx.font = '800 34px "Inter", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(l.text).width;
  const x = 920, y = l.y ?? 1400;
  ctx.fillStyle = 'rgba(20,19,18,0.72)'; roundRect(x - w - 28, y - 30, w + 56, 60, 30); ctx.fill();
  ctx.fillStyle = '#ece6da'; ctx.fillText(l.text, x, y);
  ctx.restore();
}

function drawVignette(l, t) {
  const L = life(l, t, 0.001, 0.001); if (!L) return;
  const s = l.strength ?? 0.55;
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(12,11,10,${s})`); g.addColorStop(0.28, 'rgba(12,11,10,0)');
  g.addColorStop(0.72, 'rgba(12,11,10,0)'); g.addColorStop(1, `rgba(12,11,10,${s})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${s * 0.7})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function drawFlash(l, t) {
  const k = t - l.t0, d = l.dur ?? 0.35;
  if (k < 0 || k > d) return;
  ctx.save(); ctx.globalAlpha = 0.85 * (1 - k / d); ctx.fillStyle = l.color ?? '#fff8e6'; ctx.fillRect(0, 0, W, H); ctx.restore();
}

function drawSweep(l, t) {
  const L = life(l, t, 0.001, 0.001); if (!L) return;
  const p = clamp(L.k / (l.t1 - l.t0));
  const x = -600 + p * (W + 1200);
  ctx.save();
  const g = ctx.createLinearGradient(x - 250, 0, x + 250, 0);
  g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.5, l.color ?? 'rgba(255,240,200,0.28)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g; ctx.translate(0, 0); ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawEndcard(l, t) {
  const L = life(l, t, 0.3, 0.001); if (!L) return;
  ctx.save();
  ctx.globalAlpha = L.a * (l.dim ?? 0.55);
  ctx.fillStyle = '#141312'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  drawText({ t0: l.t0, t1: l.t1, lines: l.titleLines ?? ['OPEN WORLD', 'CHESS'], y: l.y ?? 640, size: l.size ?? 150, color: '#e3b23c', anim: 'pop', glow: 'rgba(227,178,60,0.45)', out: 'cut' }, t);
  if (l.sub) drawText({ t0: l.t0 + 0.35, t1: l.t1, lines: [l.sub], y: (l.y ?? 640) + 330, size: 64, font: 'bold', weight: 800, color: '#ece6da', anim: 'rise', out: 'cut' }, t);
  // The URL is the point of the whole video: big, on its own bright pill.
  if (l.url) drawText({ t0: l.t0 + 0.6, t1: l.t1, lines: [l.url], y: (l.y ?? 640) + 470, size: l.urlSize ?? 70, font: 'bold', weight: 900, color: '#1d2412', stroke: false, plate: '#95b957', anim: 'pop', out: 'cut' }, t);
}

function drawImage(l, t) {
  const L = life(l, t); const im = images[l.src]; if (!L || !im) return;
  const w = l.w ?? 400, h = w * (im.height / im.width);
  let s = 1, dy = 0;
  if (l.anim === 'pop') s = 0.5 + 0.5 * easeBack(L.k / 0.4);
  if (l.anim === 'float') dy = Math.sin(L.k * 2) * 12;
  ctx.save(); ctx.globalAlpha = L.a; ctx.translate(l.x ?? W / 2, (l.y ?? 900) + dy); ctx.scale(s, s);
  ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
}

function drawBoard(l, t) {
  const L = life(l, t, 0.001, 0.001); if (!L) return;
  const light = l.light ?? '#eeeed2', dark = l.dark ?? '#769656';
  // An endless zoom: squares grow until one square becomes a whole board, forever.
  const period = l.period ?? 4;
  const p = ((L.k * (l.speed ?? 1)) % period) / period;
  const size = 135 * Math.pow(8, p);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  if (l.spin) ctx.rotate(L.k * l.spin);
  for (const [s, a] of [[size, 1], [size / 8, 1 - p]]) {
    const n = Math.ceil(H / s) + 2;
    ctx.globalAlpha = a;
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? light : dark;
      ctx.fillRect(i * s - s / 2, j * s - s / 2, s + 0.5, s + 0.5);
    }
  }
  ctx.restore();
  if (l.dim) { ctx.fillStyle = `rgba(20,19,18,${l.dim})`; ctx.fillRect(0, 0, W, H); }
}

const DRAW = { text: drawText, label: drawLabel, vignette: drawVignette, flash: drawFlash, sweep: drawSweep, endcard: drawEndcard, image: drawImage, board: drawBoard };

window.draw = (t) => {
  ctx.clearRect(0, 0, W, H);
  if (TL.background) { ctx.fillStyle = TL.background; ctx.fillRect(0, 0, W, H); }
  for (const l of TL.layers) DRAW[l.type]?.(l, t);
  return true;
};

// ---------- sound: our own score, in the game's key (D Dorian, 100 BPM) ----------

/** Renders music + effects for the timeline; returns a WAV as base64. */
window.renderAudio = async () => {
  const a = TL.audio ?? {}, secs = TL.seconds, rate = 48000;
  const oac = new OfflineAudioContext(2, Math.ceil(secs * rate), rate);
  const master = oac.createGain(); master.gain.value = a.volume ?? 0.9; master.connect(oac.destination);
  const verb = oac.createConvolver(); verb.buffer = impulse(oac, 2.8); const wet = oac.createGain(); wet.gain.value = 0.35; verb.connect(wet).connect(master);
  const bus = (g) => { const n = oac.createGain(); n.gain.value = g; n.connect(master); n.connect(verb); return n; };
  const music = bus(a.music === false ? 0 : (a.musicGain ?? 0.55));
  const sfx = bus(a.sfxGain ?? 0.8);
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const D = 50; // D3
  const beat = 60 / (a.bpm ?? 100);

  // A drone pad on D and A that swells over the piece.
  for (const [m, g] of [[D - 12, 0.16], [D - 5, 0.1], [D, 0.12], [D + 7, 0.07]]) {
    for (const det of [-4, 4]) {
      const o = oac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
      const f = oac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, 0); f.frequency.linearRampToValueAtTime(a.bright ? 2400 : 1400, secs * 0.8);
      const gn = oac.createGain(); gn.gain.setValueAtTime(0, 0); gn.gain.linearRampToValueAtTime(g, 1.2); gn.gain.setValueAtTime(g, secs - 1.5); gn.gain.linearRampToValueAtTime(0, secs);
      o.connect(f).connect(gn).connect(music); o.start(0); o.stop(secs);
    }
  }
  // A heartbeat pulse on the beat, and a plucked D Dorian figure that climbs.
  const scale = [0, 2, 3, 5, 7, 9, 10];
  for (let i = 0, t = 0; t < secs - 1; i++, t += beat) {
    kick(oac, music, t, i % 4 === 0 ? 0.55 : 0.28);
    if (a.arp !== false && t > (a.arpFrom ?? 1.5)) {
      const deg = [0, 2, 4, 2, 5, 4, 2, 1][i % 8] + Math.floor(t / (secs / 3)) * 2;
      pluck(oac, music, t + beat / 2, hz(D + 12 + scale[deg % 7] + 12 * Math.floor(deg / 7)), 0.09);
    }
  }
  // Effects: a hit on every slam/pop, a riser before the end card, a gong on the end card.
  for (const l of TL.layers) {
    if (l.type === 'text' && (l.anim === 'slam' || l.anim === 'pop') && !l.silent) hit(oac, sfx, l.t0, l.anim === 'slam' ? 1 : 0.55);
    if (l.type === 'endcard') { riser(oac, sfx, l.t0 - 1.6, 1.6); gong(oac, sfx, l.t0, hz(D - 12)); }
    if (l.type === 'flash') hit(oac, sfx, l.t0, 0.8);
  }
  const buf = await oac.startRendering();
  return wavBase64(buf);
};

function impulse(ac, sec) {
  const len = ac.sampleRate * sec, b = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  return b;
}
function kick(ac, out, t, g) {
  const o = ac.createOscillator(), gn = ac.createGain();
  o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(gn).connect(out); o.start(t); o.stop(t + 0.4);
}
function pluck(ac, out, t, f, g) {
  const o = ac.createOscillator(), gn = ac.createGain(); o.type = 'triangle'; o.frequency.value = f;
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  o.connect(gn).connect(out); o.start(t); o.stop(t + 1);
}
function hit(ac, out, t, g) {
  kick(ac, out, t, 0.9 * g);
  const len = Math.floor(ac.sampleRate * 0.5), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
  const gn = ac.createGain(); gn.gain.value = 0.5 * g; s.connect(f).connect(gn).connect(out); s.start(t);
}
function riser(ac, out, t, d) {
  const len = Math.floor(ac.sampleRate * d), b = ac.createBuffer(1, len, ac.sampleRate), x = b.getChannelData(0);
  for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(i / len, 2);
  const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(300, Math.max(0, t)); f.frequency.exponentialRampToValueAtTime(5000, Math.max(0.01, t + d));
  const gn = ac.createGain(); gn.gain.value = 0.35; s.connect(f).connect(gn).connect(out); s.start(Math.max(0, t));
}
function gong(ac, out, t, f) {
  for (const [m, g] of [[1, 0.4], [2.76, 0.18], [5.4, 0.08], [0.5, 0.25]]) {
    const o = ac.createOscillator(), gn = ac.createGain(); o.frequency.value = f * m;
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 4);
    o.connect(gn).connect(out); o.start(t); o.stop(t + 4.2);
  }
}
function wavBase64(buf) {
  const ch = buf.numberOfChannels, len = buf.length, rate = buf.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, rate, true);
  data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, len * ch * 2, true);
  const chans = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, v * 0x7fff, true); o += 2; }
  const bytes = new Uint8Array(data.buffer); let s = '';
  for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s);
}

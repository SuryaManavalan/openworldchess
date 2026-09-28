// Battle clips (docs/specs/tiktok.md): a finished battle, replayed onto a
// vertical 1080x1920 canvas and recorded in the browser as a short video with
// its own move sounds. No logo or watermark: the clip is the player's game.
import { Chess } from 'chess.js';
import type { BattlePublic, PieceKind } from '@owc/shared';
import { creatureUrl, pieceUrl } from './textures.ts';
import { mirror } from '../net.ts';

export interface ClipData {
  battleId: number;
  kind: BattlePublic['kind'];
  side: 'white' | 'black';
  white: { name: string; rating: number; color: string };
  black: { name: string; rating: number; color: string };
  startFen: string;
  moves: string[];
  result: BattlePublic['result'];
  termination?: string;
  /** 'wK', 'bP', ... → image url, resolved while the battle's players were known. */
  art: Record<string, string>;
}

/** Everything a clip needs, captured now (the battle leaves the world soon after it ends). */
export function clipData(b: BattlePublic, side: 'white' | 'black'): ClipData | null {
  if (!b.startFen || !b.moves.length) return null;
  const art: Record<string, string> = {};
  const start = new Chess(b.startFen);
  for (const c of ['w', 'b'] as const) {
    const info = c === 'w' ? b.white : b.black;
    const pl = mirror.players.get(info.playerId);
    // Whether this side's king is an Emperor: look at the world piece that started on the king's square.
    let emperor = false;
    for (const row of start.board()) for (const sq of row) if (sq && sq.type === 'k' && sq.color === c) emperor = !!mirror.pieces.get(b.pieceMap[sq.square] ?? info.kingId)?.emperor || !!mirror.pieces.get(info.kingId)?.emperor;
    for (const k of ['K', 'Q', 'R', 'B', 'N', 'P'] as PieceKind[])
      art[c + k] = pl?.wild ? creatureUrl(pl.wild, k) : pieceUrl(k, c === 'w' ? 'light' : 'dark', info.color, k === 'K' && emperor, pl?.civ);
  }
  return {
    battleId: b.id, kind: b.kind, side, startFen: b.startFen, moves: [...b.moves], result: b.result, termination: b.termination, art,
    white: { name: b.white.name, rating: b.white.rating, color: b.white.color },
    black: { name: b.black.name, rating: b.black.rating, color: b.black.color },
  };
}

const W = 1080, H = 1920, BOARD = 960, BX = (W - BOARD) / 2, BY = 520, SQ = BOARD / 8;
const LIGHT = '#eeeed2', DARK = '#769656', BG = '#23211f', INK = '#ece6da', DIM = '#b8b0a2', GOLD = '#e3b23c', HL = 'rgba(246, 246, 105, 0.5)';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const INTRO = 1400, OUTRO = 2600, MAX_PLIES = 110;

type Plan = { fen: string; after: string; from: string; to: string; san: string; capture: boolean; check: boolean }[];

function plan(d: ClipData): { first: string; plies: Plan; skipped: number } {
  const g = new Chess(d.startFen);
  const plies: Plan = [];
  for (const san of d.moves) {
    const before = g.fen();
    let mv;
    try { mv = g.move(san); } catch { break; }
    plies.push({ fen: before, after: g.fen(), from: mv.from, to: mv.to, san: mv.san, capture: !!mv.captured, check: g.inCheck() });
  }
  // Long games: show the last stretch, where the battle was decided.
  const skipped = Math.max(0, plies.length - MAX_PLIES);
  const shown = plies.slice(skipped);
  return { first: shown[0]?.fen ?? d.startFen, plies: shown, skipped };
}

const loadImg = (src: string) => new Promise<HTMLImageElement | null>((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

/** How long the clip runs, in ms. */
export function clipLength(d: ClipData) {
  const n = Math.min(d.moves.length, MAX_PLIES);
  return INTRO + n * paceOf(n) + OUTRO;
}
const paceOf = (n: number) => Math.max(200, Math.min(620, 24_000 / Math.max(1, n)));

export interface Recording { blob: Blob; type: string; ms: number }

/**
 * Play the battle onto `canvas` in real time and record it. `onProgress`
 * gets 0..1. Resolves with the finished video.
 */
export async function recordClip(d: ClipData, canvas: HTMLCanvasElement, onProgress: (f: number) => void): Promise<Recording> {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const imgs: Record<string, HTMLImageElement | null> = {};
  await Promise.all(Object.entries(d.art).map(async ([k, u]) => { imgs[k] = await loadImg(u); }));
  const { first, plies, skipped } = plan(d);
  const pace = paceOf(plies.length), total = INTRO + plies.length * pace + OUTRO;
  const flip = d.side === 'black';

  const sqXY = (sq: string): [number, number] => {
    const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1;
    return flip ? [BX + (7 - f) * SQ, BY + r * SQ] : [BX + f * SQ, BY + (7 - r) * SQ];
  };
  const bottom = d.side, top = bottom === 'white' ? 'black' : 'white';
  const result = !d.result || d.result === 'draw' ? 'Draw' : d.result === d.side ? 'Victory' : 'Defeat';
  const kindName = d.kind === 'siege' ? 'SIEGE' : d.kind === 'practice' ? 'PRACTICE BATTLE' : 'FIELD BATTLE';

  const bar = (who: 'white' | 'black', y: number) => {
    const p = d[who];
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(BX + 22, y, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK; ctx.font = `700 50px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(p.name, BX + 60, y);
    ctx.fillStyle = DIM; ctx.font = `500 40px ${FONT}`; ctx.textAlign = 'right';
    ctx.fillText(String(p.rating), BX + BOARD, y);
  };

  const draw = (t: number) => {
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, BY + BOARD / 2, 100, W / 2, BY + BOARD / 2, 1100);
    glow.addColorStop(0, 'rgba(149,185,87,0.10)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = GOLD; ctx.font = `700 34px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.letterSpacing = '6px'; ctx.fillText(kindName, W / 2, 250); ctx.letterSpacing = '0px';
    bar(top, BY - 60);
    bar(bottom, BY + BOARD + 60);

    // Which ply we're on, and how far through its slide.
    const mt = t - INTRO;
    const i = mt < 0 ? -1 : Math.min(plies.length - 1, Math.floor(mt / pace));
    const slide = i < 0 ? 0 : Math.min(1, ((mt - i * pace) / pace) / 0.55);
    const ease = 1 - Math.pow(1 - slide, 3);
    const last = i >= 0 ? plies[i] : null;
    // Mid-slide: the position before the move; once it lands, the position after it.
    const cur = !last ? first : ease >= 1 ? last.after : last.fen;
    const board = new Chess(cur).board();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = String.fromCharCode(97 + f) + (8 - r);
      const [x, y] = sqXY(sq);
      ctx.fillStyle = (f + r) % 2 === 0 ? LIGHT : DARK; ctx.fillRect(x, y, SQ, SQ);
    }
    if (last) for (const sq of [last.from, last.to]) { const [x, y] = sqXY(sq); ctx.fillStyle = HL; ctx.fillRect(x, y, SQ, SQ); }
    const piece = (key: string, x: number, y: number, alpha = 1) => {
      const im = imgs[key]; if (!im) return;
      ctx.globalAlpha = alpha; ctx.drawImage(im, x + SQ * 0.06, y + SQ * 0.04, SQ * 0.88, SQ * 0.88); ctx.globalAlpha = 1;
    };
    // Draw the position before the move, with the mover sliding and a captured piece fading.
    let moving: { key: string; from: [number, number]; to: [number, number] } | null = null;
    for (const row of board) for (const s of row) {
      if (!s) continue;
      const key = s.color + s.type.toUpperCase();
      if (last && ease < 1 && s.square === last.from) { moving = { key, from: sqXY(s.square), to: sqXY(last.to) }; continue; }
      if (last && ease < 1 && s.square === last.to) { piece(key, ...sqXY(s.square), 1 - ease); continue; }
      piece(key, ...sqXY(s.square));
    }
    if (moving) piece(moving.key, moving.from[0] + (moving.to[0] - moving.from[0]) * ease, moving.from[1] + (moving.to[1] - moving.from[1]) * ease);

    // The move, big, under the board.
    ctx.textAlign = 'center';
    if (i < 0) {
      ctx.fillStyle = DIM; ctx.font = `500 44px ${FONT}`; ctx.fillText('The armies meet', W / 2, BY + BOARD + 190);
    } else {
      const n = skipped + i;
      ctx.fillStyle = DIM; ctx.font = `500 38px ${FONT}`; ctx.fillText(`Move ${Math.floor(n / 2) + 1}`, W / 2, BY + BOARD + 170);
      ctx.fillStyle = INK; ctx.font = `800 96px ${FONT}`; ctx.fillText(`${n % 2 === 0 ? '' : '… '}${plies[i].san}`, W / 2, BY + BOARD + 270);
    }

    // The ending.
    const end = t - (INTRO + plies.length * pace);
    if (end > 200) {
      const a = Math.min(1, (end - 200) / 450);
      ctx.fillStyle = `rgba(20,19,18,${0.72 * a})`; ctx.fillRect(BX, BY, BOARD, BOARD);
      ctx.globalAlpha = a;
      ctx.fillStyle = result === 'Victory' ? GOLD : INK; ctx.font = `800 150px ${FONT}`; ctx.fillText(result, W / 2, BY + BOARD / 2 - 30);
      if (d.termination) { ctx.fillStyle = INK; ctx.font = `500 48px ${FONT}`; ctx.fillText(d.termination.replace(/^./, (c) => c.toUpperCase()), W / 2, BY + BOARD / 2 + 90); }
      ctx.globalAlpha = 1;
    }
  };

  // Sound: a soft wooden knock per move (heavier for captures and checks), a chord at the end.
  const sounds: { at: number; play: (ac: BaseAudioContext, out: AudioNode, when: number) => void }[] = [];
  const knock = (heavy: boolean) => (ac: BaseAudioContext, out: AudioNode, when: number) => {
    const len = Math.floor(ac.sampleRate * 0.09), buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, heavy ? 3 : 5);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = heavy ? 520 : 900; f.Q.value = 1.4;
    const gain = ac.createGain(); gain.gain.value = heavy ? 1.6 : 1.0;
    src.connect(f).connect(gain).connect(out);
    src.start(when);
  };
  const chord = (win: boolean) => (ac: BaseAudioContext, out: AudioNode, when: number) => {
    (win ? [261.6, 329.6, 392, 523.3] : [220, 261.6, 329.6]).forEach((hz, i) => {
      const o = ac.createOscillator(), gn = ac.createGain();
      o.type = 'triangle'; o.frequency.value = hz;
      const t0 = when + i * 0.09;
      gn.gain.setValueAtTime(0, t0); gn.gain.linearRampToValueAtTime(0.18, t0 + 0.04); gn.gain.exponentialRampToValueAtTime(0.001, t0 + 1.8);
      o.connect(gn).connect(out); o.start(t0); o.stop(t0 + 1.9);
    });
  };
  plies.forEach((p, i) => sounds.push({ at: INTRO + i * pace, play: knock(p.capture || p.check) }));
  sounds.push({ at: INTRO + plies.length * pace + 200, play: chord(result === 'Victory') });

  const fast = await encodeFrames(canvas, draw, sounds, total, onProgress).catch(() => null);
  if (fast) return { blob: fast, type: 'video/mp4', ms: total };
  return recordRealtime(canvas, draw, sounds, total, onProgress);
}

const FPS = 30;

/**
 * Frame by frame with WebCodecs: exactly 30 fps H.264 (TikTok wants a steady
 * 23-60 fps, which a live screen recording can't promise), faster than real
 * time, with the sounds rendered offline. Null where the browser can't.
 */
async function encodeFrames(canvas: HTMLCanvasElement, draw: (t: number) => void, sounds: { at: number; play: (ac: BaseAudioContext, out: AudioNode, when: number) => void }[], total: number, onProgress: (f: number) => void): Promise<Blob | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const vcfg: VideoEncoderConfig = { codec: 'avc1.640028', width: W, height: H, bitrate: 6_000_000, framerate: FPS, avc: { format: 'avc' } };
  let vok = (await VideoEncoder.isConfigSupported(vcfg).catch(() => null))?.supported;
  if (!vok) { vcfg.codec = 'avc1.4d0028'; vok = (await VideoEncoder.isConfigSupported(vcfg).catch(() => null))?.supported; }
  if (!vok) return null;
  const RATE = 48_000;
  const acfgs: AudioEncoderConfig[] = [{ codec: 'mp4a.40.2', sampleRate: RATE, numberOfChannels: 1, bitrate: 128_000 }, { codec: 'opus', sampleRate: RATE, numberOfChannels: 1, bitrate: 128_000 }];
  let acfg: AudioEncoderConfig | null = null;
  if (typeof AudioEncoder !== 'undefined') for (const c of acfgs) if ((await AudioEncoder.isConfigSupported(c).catch(() => null))?.supported) { acfg = c; break; }

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target, fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    video: { codec: 'avc', width: W, height: H, frameRate: FPS },
    audio: acfg ? { codec: acfg.codec === 'opus' ? 'opus' : 'aac', sampleRate: RATE, numberOfChannels: 1 } : undefined,
  });
  let failed: unknown = null;
  const ve = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failed = e; } });
  ve.configure(vcfg);

  // The sound track, rendered offline so it lines up with the frames exactly.
  if (acfg) {
    const len = Math.ceil((total / 1000) * RATE);
    const oac = new OfflineAudioContext(1, len, RATE);
    for (const s of sounds) s.play(oac, oac.destination, s.at / 1000);
    const buf = await oac.startRendering();
    const pcm = buf.getChannelData(0);
    const ae = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { failed = e; } });
    ae.configure(acfg);
    for (let i = 0; i < len; i += 4800) {
      const part = pcm.slice(i, Math.min(len, i + 4800));
      const ad = new AudioData({ format: 'f32-planar', sampleRate: RATE, numberOfFrames: part.length, numberOfChannels: 1, timestamp: Math.round((i / RATE) * 1e6), data: part });
      ae.encode(ad); ad.close();
    }
    await ae.flush(); ae.close();
  }

  const frames = Math.ceil((total / 1000) * FPS);
  for (let i = 0; i < frames; i++) {
    if (failed) throw failed;
    draw(Math.min(total, (i * 1000) / FPS));
    const vf = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    ve.encode(vf, { keyFrame: i % (FPS * 2) === 0 });
    vf.close();
    // Let the encoder catch up, and the page breathe.
    while (ve.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 4));
    if (i % 6 === 0) { onProgress(i / frames); await new Promise((r) => setTimeout(r, 0)); }
  }
  await ve.flush(); ve.close();
  if (failed) throw failed;
  muxer.finalize();
  onProgress(1);
  return new Blob([target.buffer], { type: 'video/mp4' });
}

/** Older browsers: play the clip in real time and record the canvas. */
async function recordRealtime(canvas: HTMLCanvasElement, draw: (t: number) => void, sounds: { at: number; play: (ac: BaseAudioContext, out: AudioNode, when: number) => void }[], total: number, onProgress: (f: number) => void): Promise<Recording> {
  const ac = new AudioContext();
  const dest = ac.createMediaStreamDestination();
  const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const type = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
  const rec = new MediaRecorder(stream, { mimeType: type || undefined, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 128_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<void>((ok) => { rec.onstop = () => ok(); });
  draw(0);
  rec.start(500);
  if (ac.state === 'suspended') await ac.resume().catch(() => {});
  const start = ac.currentTime;
  for (const s of sounds) s.play(ac, dest, start + s.at / 1000);
  const t0 = performance.now();
  await new Promise<void>((finish) => {
    const tick = () => {
      const t = performance.now() - t0;
      draw(Math.min(t, total));
      onProgress(Math.min(1, t / total));
      if (t >= total) { finish(); return; }
      // Keep painting even if the tab loses focus for a moment (rAF pauses in background tabs).
      if (document.hidden) setTimeout(tick, 33); else requestAnimationFrame(tick);
    };
    tick();
  });
  rec.stop();
  await done;
  ac.close().catch(() => {});
  const mime = (type || chunks[0]?.type || 'video/webm').split(';')[0];
  return { blob: new Blob(chunks, { type: mime }), type: mime, ms: total };
}

// Sound (audio.md): everything in key and on the 100 BPM world beat. Armies are
// rhythm sections, rewards cascade upward, music adapts to what's happening.
// Day-0 audio is synthesized (audio.md §9); the event → sound mapping stays
// here so recorded assets can replace synths later.
import * as Tone from 'tone';
import type { PieceKind } from '@owc/shared';

// D Dorian, the home mode (audio.md §2).
const SCALE = ['D', 'E', 'F', 'G', 'A', 'B', 'C'];
const note = (i: number, base = 4) => `${SCALE[((i % 7) + 7) % 7]}${base + Math.floor(i / 7)}`;
const CHORDS = [[0, 2, 4], [3, 5, 0], [6, 1, 3], [4, 6, 1]]; // Dm, G, C, Am as scale degrees

class Audio {
  ready = false;
  private started = false;
  private musicVol!: Tone.Volume;
  private fxVol!: Tone.Volume;
  private ambVol!: Tone.Volume;
  private uiVol!: Tone.Volume;
  private voices!: Record<string, { trigger: (time: number, pan: number) => void }>;
  private pluck!: Tone.PolySynth;
  private bell!: Tone.PolySynth;
  private clackS!: Tone.MembraneSynth;
  private clickS!: Tone.NoiseSynth;
  private horn!: Tone.FMSynth;
  private choir!: Tone.PolySynth;
  private gong!: Tone.MetalSynth;
  private heart!: Tone.MembraneSynth;
  private drone!: Tone.PolySynth;
  private orn!: Tone.PluckSynth;
  private chirp!: Tone.Synth;
  private townBellS!: Tone.PolySynth;
  private townBellPan!: Tone.Panner;
  private wind!: Tone.Noise;
  private windFilter!: Tone.AutoFilter;
  private lastKindAt = new Map<string, number>();
  private lastVoiceTime = new Map<string, number>();
  private ladder = 0;
  private ladderAt = 0;
  private bar = 0;
  tension = 0; // 0 calm .. 1 battle
  countdown = false;
  moving = 0;

  /** Browsers only allow audio after a user gesture (audio.md §8). */
  async unlock() {
    if (this.started) return;
    this.started = true;
    await Tone.start();
    this.setup();
    this.ready = true;
  }

  setVolumes(v: { sound: boolean; music: number; effects: number; ambience: number }) {
    if (!this.ready) return;
    Tone.getDestination().mute = !v.sound;
    const db = (x: number) => (x <= 0.001 ? -Infinity : 20 * Math.log10(x));
    this.musicVol.volume.rampTo(db(v.music) - 6, 0.3);
    this.fxVol.volume.rampTo(db(v.effects) - 4, 0.3);
    this.uiVol.volume.rampTo(db(v.effects) - 2, 0.3);
    this.ambVol.volume.rampTo(db(v.ambience) - 10, 0.3);
  }

  /** Lock the transport to the server's world turn (audio.md §8). */
  syncBeat(msUntilNextTurn: number, turnMs: number) {
    if (!this.ready) return;
    const t = Tone.getTransport();
    t.bpm.value = 60000 / turnMs;
    if (t.state !== 'started') t.start(Tone.now() + msUntilNextTurn / 1000);
  }

  private setup() {
    const out = new Tone.Compressor(-18, 3).toDestination();
    const verb = new Tone.Reverb({ decay: 2.8, wet: 0.25 }).connect(out);
    this.musicVol = new Tone.Volume(-10).connect(verb);
    this.fxVol = new Tone.Volume(-6).connect(verb);
    this.uiVol = new Tone.Volume(-4).connect(out);
    this.ambVol = new Tone.Volume(-18).connect(out);

    // Piece voices: each kind is a percussion voice (audio.md §3).
    const panned = (node: Tone.ToneAudioNode) => { const p = new Tone.Panner(0).connect(this.fxVol); node.connect(p); return p; };
    const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -22 });
    const snareBp = new Tone.Filter(2400, 'bandpass'); snare.connect(snareBp); const snareP = panned(snareBp);
    const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 5, envelope: { attack: 0.001, decay: 0.35, sustain: 0 }, volume: -8 }); const kickP = panned(kick);
    const block = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.07, sustain: 0 }, volume: -14 }); const blockP = panned(block);
    const shaker = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.02, decay: 0.12, sustain: 0 }, volume: -24 });
    const shakerHp = new Tone.Filter(6000, 'highpass'); shaker.connect(shakerHp); const shakerP = panned(shakerHp);
    const bellV = new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 12, envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.4 }, volume: -20 }); const bellP = panned(bellV);
    const tom = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 3, envelope: { attack: 0.001, decay: 0.25, sustain: 0 }, volume: -12 }); const tomP = panned(tom);
    const withPan = (p: Tone.Panner, f: (t: number) => void) => ({ trigger: (t: number, pan: number) => { p.pan.setValueAtTime(pan * 0.8, t); f(t); } });
    this.voices = {
      P: withPan(snareP, (t) => snare.triggerAttackRelease('32n', t)),
      R: withPan(kickP, (t) => kick.triggerAttackRelease('D1', '8n', t)),
      N: withPan(blockP, (t) => block.triggerAttackRelease(Math.random() < 0.5 ? 'A4' : 'D5', '32n', t)),
      Q: withPan(shakerP, (t) => shaker.triggerAttackRelease('16n', t)),
      B: withPan(bellP, (t) => bellV.triggerAttackRelease(note(4 + Math.floor(Math.random() * 3) * 2, 5), '16n', t)),
      K: withPan(tomP, (t) => tom.triggerAttackRelease('A1', '8n', t)),
      turn: withPan(snareP, (t) => snare.triggerAttackRelease('64n', t)),
    };

    this.pluck = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.3 }, volume: -10 }).connect(this.uiVol);
    this.bell = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.5, modulationIndex: 10, envelope: { attack: 0.001, decay: 1.1, sustain: 0, release: 0.8 }, volume: -14 }).connect(this.fxVol);
    this.clackS = new Tone.MembraneSynth({ pitchDecay: 0.004, octaves: 1.5, envelope: { attack: 0.0005, decay: 0.06, sustain: 0 }, volume: -4 }).connect(this.uiVol);
    this.clickS = new Tone.NoiseSynth({ envelope: { attack: 0.0005, decay: 0.03, sustain: 0 }, volume: -16 }).connect(this.uiVol);
    this.horn = new Tone.FMSynth({ harmonicity: 1, modulationIndex: 3, oscillator: { type: 'sawtooth' }, envelope: { attack: 0.08, decay: 0.3, sustain: 0.6, release: 0.8 }, volume: -16 }).connect(this.fxVol);
    this.choir = new Tone.PolySynth(Tone.AMSynth, { envelope: { attack: 0.6, decay: 0.5, sustain: 0.6, release: 2 }, volume: -20 }).connect(this.musicVol);
    this.gong = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 2.5, release: 1 }, harmonicity: 5.1, modulationIndex: 16, resonance: 800, volume: -24 }).connect(this.fxVol);
    this.gong.frequency.value = 80;
    this.heart = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 3, envelope: { attack: 0.001, decay: 0.3, sustain: 0 }, volume: -10 }).connect(this.fxVol);

    // Music: drone + endless generative ornaments over a slow progression (audio.md §2).
    const droneFilter = new Tone.Filter(700, 'lowpass').connect(this.musicVol);
    this.drone = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fattriangle', spread: 12, count: 3 }, envelope: { attack: 3, decay: 1, sustain: 0.8, release: 4 }, volume: -22 }).connect(droneFilter);
    this.orn = new Tone.PluckSynth({ attackNoise: 1.2, dampening: 3800, resonance: 0.93, volume: -12 }).connect(this.musicVol);
    const transport = Tone.getTransport();
    transport.scheduleRepeat((time) => this.onBar(time), '1m');
    transport.scheduleRepeat((time) => this.onBeat(time), '4n');

    // Ambience: wind that breathes, birds now and then.
    this.windFilter = new Tone.AutoFilter({ frequency: 0.07, baseFrequency: 300, octaves: 3, depth: 0.9 }).connect(this.ambVol).start();
    this.wind = new Tone.Noise('pink').connect(this.windFilter);
    this.wind.volume.value = -14;
    this.wind.start();
    // Town bell: a big, low, long-ringing bell (dawn and dusk).
    this.townBellPan = new Tone.Panner(0).connect(this.fxVol);
    this.townBellS = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 2.01, modulationIndex: 14, oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 4, sustain: 0, release: 3 }, modulationEnvelope: { attack: 0.002, decay: 1.2, sustain: 0.2, release: 2 }, volume: -12 }).connect(this.townBellPan);
    this.chirp = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.05 }, volume: -22 }).connect(this.ambVol);
    setInterval(() => { if (Math.random() < 0.35) this.birds(); }, 3500);
  }

  private onBar(time: number) {
    const chord = CHORDS[Math.floor(this.bar / 2) % CHORDS.length];
    this.bar++;
    this.drone.releaseAll(time);
    this.drone.triggerAttack([note(chord[0], 2), note(chord[2], 2), note(chord[1], 3)], time + 0.02);
    if (this.tension > 0.5) this.horn.triggerAttackRelease(note(0, 2), '2n', time, 0.25);
  }

  private onBeat(time: number) {
    const chord = CHORDS[Math.floor((this.bar - 1) / 2) % CHORDS.length];
    // ornaments: sparse when calm, busier when your troops move
    const p = 0.18 + Math.min(0.3, this.moving * 0.05);
    if (Math.random() < p) {
      const deg = chord[Math.floor(Math.random() * 3)] + (Math.random() < 0.3 ? 7 : 0);
      this.orn.triggerAttack(note(deg, 4), time + (Math.random() < 0.3 ? Tone.Time('8n').toSeconds() : 0));
    }
    if (this.countdown) this.heart.triggerAttackRelease('D1', '16n', time);
    this.moving = Math.max(0, this.moving - 0.5);
  }

  /** Footsteps on the beat, one voice per piece kind, merged (audio.md §3). */
  step(kind: PieceKind, turn: boolean, pan: number) {
    if (!this.ready) return;
    const k = turn ? 'turn' : kind;
    const now = Tone.now();
    if (now - (this.lastKindAt.get(k) ?? 0) < 0.09) return;
    this.lastKindAt.set(k, now);
    this.moving = Math.min(8, this.moving + 0.3);
    let t = Math.max(now, Tone.getTransport().state === 'started' ? Tone.getTransport().nextSubdivision('16n') : now);
    // Each voice needs strictly increasing start times.
    t = Math.max(t, (this.lastVoiceTime.get(k) ?? 0) + 0.02);
    this.lastVoiceTime.set(k, t);
    try { this.voices[k].trigger(t, pan); } catch { /* voice busy: skip this footstep */ }
  }

  /** Lasso-selecting plucks up the scale (audio.md §4). */
  select(i: number) { if (this.ready) this.pluck.triggerAttackRelease(note(i, 4), '16n', Tone.now() + i * 0.045); }
  commit() {
    if (!this.ready) return;
    const now = Tone.now();
    this.clackS.triggerAttackRelease('D2', '16n', now);
    const chord = CHORDS[Math.floor(this.bar / 2) % CHORDS.length];
    this.pluck.triggerAttackRelease(chord.map((d) => note(d, 4)), '8n', now + 0.02, 0.5);
  }
  error() { if (this.ready) this.pluck.triggerAttackRelease('D3', '32n', Tone.now(), 0.3); }
  attack() {
    if (!this.ready) return;
    const now = Tone.now();
    this.horn.triggerAttackRelease('D3', '4n', now);
    this.horn.triggerAttackRelease('A3', '4n', now + 0.35);
    this.heart.triggerAttackRelease('D1', '8n', now);
  }
  build() {
    if (!this.ready) return;
    const t = Tone.getTransport().state === 'started' ? Tone.getTransport().nextSubdivision('8n') : Tone.now();
    for (let i = 0; i < 3; i++) this.clackS.triggerAttackRelease(i === 2 ? 'A2' : 'D2', '32n', t + i * Tone.Time('8n').toSeconds());
  }
  /** Production bells climb within 10 seconds (the ladder, audio.md §4). */
  birth() {
    if (!this.ready) return;
    const now = Tone.now();
    if (now - this.ladderAt > 10) this.ladder = 0;
    this.ladderAt = now;
    this.bell.triggerAttackRelease(note(this.ladder++ * 2, 5), '8n', now, 0.6);
  }
  /** Conversion cascade: a payout run of chimes (audio.md §4). */
  cascade(i: number) {
    if (!this.ready) return;
    this.bell.triggerAttackRelease(note(i * 2, 5), '16n', Tone.now(), 0.7);
    if (i === 0) this.choir.triggerAttackRelease([note(0, 3), note(4, 3), note(2, 4)], '1m', Tone.now());
  }
  clack(capture: boolean, check: boolean) {
    if (!this.ready) return;
    const now = Tone.now();
    this.clackS.triggerAttackRelease(capture ? 'F2' : 'A2', '32n', now);
    this.clickS.triggerAttackRelease('64n', now);
    if (capture) this.bell.triggerAttackRelease('A5', '32n', now + 0.01, 0.3);
    if (check) this.pluck.triggerAttackRelease([note(3, 4), note(6, 4)], '8n', now + 0.05, 0.6);
  }
  mate(win: boolean) {
    if (!this.ready) return;
    const now = Tone.now();
    this.gong.triggerAttackRelease('4n', now);
    const chord = win ? ['D4', 'F#4', 'A4', 'D5'] : ['D3', 'F3', 'A3'];
    this.choir.triggerAttackRelease(chord, '1m', now + 0.1);
  }
  lowClock() { if (this.ready) this.clickS.triggerAttackRelease('64n', Tone.now()); }
  /** One strike of a town bell; alternates between two pitches, lower at dusk. */
  townBell(i: number, pan: number, dusk: boolean) {
    if (!this.ready) return;
    const now = Tone.now();
    this.townBellPan.pan.setValueAtTime(pan * 0.7, now);
    const notes = dusk ? ['A2'] : ['D3', 'A2'];
    this.townBellS.triggerAttackRelease([notes[i % notes.length], dusk ? 'E3' : 'A3'], '2n', now, 0.9);
  }

  birds() {
    if (!this.ready) return;
    const now = Tone.now();
    const base = 2200 + Math.random() * 1400;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      this.chirp.frequency.setValueAtTime(base, now + i * 0.12);
      this.chirp.frequency.exponentialRampToValueAtTime(base * 1.4, now + i * 0.12 + 0.07);
      this.chirp.triggerAttackRelease(base, 0.07, now + i * 0.12);
    }
  }
}

// Sound must never break the game: swallow scheduling errors from any cue.
for (const name of ['select', 'commit', 'error', 'attack', 'build', 'birth', 'cascade', 'clack', 'mate', 'lowClock', 'birds', 'townBell'] as const) {
  const proto = Audio.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const fn = proto[name];
  proto[name] = function (this: unknown, ...args: unknown[]) { try { return fn.apply(this, args); } catch { return undefined; } };
}

export const audio = new Audio();

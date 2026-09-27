/**
 * lib/fx/sound.ts — procedural Web Audio synth for the juice system. No audio files.
 *
 * Every cue is built on the fly from oscillators (sine / triangle / sawtooth / square), cached
 * white & pink noise buffers, biquad filters and ADSR-ish gain envelopes. All cues are ≤ 1.2 s,
 * tuned to be tasteful (soft attacks, low-passed harsh waveforms, gentle "wrong"/"error"),
 * and loudness-normalised with a per-cue trim table measured offline (see `render()`).
 *
 * Behaviour:
 * - The AudioContext is created lazily on the first `play()`/`unlock()` — browsers require a
 *   user gesture, so `<FxProvider>` calls `sound.unlock()` from a capturing pointerdown/keydown
 *   listener.
 * - Master gain follows the `fact-duel-volume` pref; playback is skipped when sound is off,
 *   volume is 0, or the document is hidden. The same cue is throttled per cue (see CUE_THROTTLE_MS).
 * - Master chain: cue → master gain → safety limiter → destination, plus a parallel space bus
 *   (a 160 ms generated impulse response) that individual layers tap with `send`. Still no files.
 * - Nothing is bit-identical twice: pitches come from shuffle bags, and `jit` redraws cents, start
 *   offset and velocity on every trigger. Repetition was the loudest tell that these were synthetic.
 * - Loudness is measured, not asserted from TRIM: see lib/fx/sound-levels.ts and
 *   scripts/measure-cues.mjs (`pnpm fx:levels`).
 * - `sound.test()` plays every cue in sequence (for a "Preview sounds" button); `sound.stop()`
 *   cancels it. `sound.render(cue)` renders a cue into an OfflineAudioContext for analysis.
 *
 * SSR-safe: nothing touches `window`/`document` at module scope; on the server `play()` is a
 * silent no-op.
 */
import { getPrefs, subscribePrefs } from './prefs';

export type Cue =
  | 'tap'
  | 'hover'
  | 'select'
  | 'correct'
  | 'wrong'
  | 'combo'
  | 'countdown'
  | 'go'
  | 'reveal'
  | 'win'
  | 'loss'
  | 'draw'
  | 'levelUp'
  | 'quest'
  | 'gem'
  | 'stamp'
  | 'streak'
  | 'unlock'
  | 'xp'
  | 'tick'
  | 'detent'
  | 'kept'
  | 'whoosh'
  | 'error';

export interface PlayOptions {
  /** Frequency multiplier (1 = as designed). 2 = one octave up. */
  pitch?: number;
  /** Gain multiplier (1 = as designed). */
  gain?: number;
  /** Cue-specific count: combo depth for `combo`, XP amount for `xp`. */
  n?: number;
}

/** Ordered list of all cues (also the order used by `sound.test()`). */
export const CUES: readonly Cue[] = [
  'tap',
  'hover',
  'select',
  'correct',
  'wrong',
  'combo',
  'countdown',
  'go',
  'reveal',
  'win',
  'loss',
  'draw',
  'levelUp',
  'quest',
  'gem',
  'stamp',
  'streak',
  'unlock',
  'xp',
  'tick',
  'detent',
  'kept',
  'whoosh',
  'error',
];

/** Minimum gap between two plays of the same cue, in ms. */
export const CUE_THROTTLE_DEFAULT_MS = 40;
/**
 * Per-cue throttles. The interaction cues need a longer gap than the reward cues: they are the
 * ones a player can retrigger dozens of times a minute, and a repeat inside the auditory fusion
 * window is heard as a machine stutter rather than as two presses.
 */
export const CUE_THROTTLE_MS: Readonly<Partial<Record<Cue, number>>> = Object.freeze({
  tap: 45,
  hover: 60,
  tick: 60,
  detent: 60,
  select: 90,
});
export const throttleFor = (cue: Cue): number => CUE_THROTTLE_MS[cue] ?? CUE_THROTTLE_DEFAULT_MS;

type NoiseColor = 'white' | 'pink';

interface ToneParams {
  type?: OscillatorType;
  /** Start frequency in Hz (multiplied by the cue pitch). */
  freq: number;
  /** Glide target frequency (exponential ramp over `glide` seconds, default = `dur`). */
  to?: number;
  glide?: number;
  /** Offset from the cue start, seconds. */
  at?: number;
  /** Attack seconds (linear). */
  a?: number;
  /** Decay seconds (exponential, to `s` × peak). */
  d?: number;
  /** Sustain level 0..1 of peak. */
  s?: number;
  /** Seconds from note start until release begins (≥ a + d). */
  dur: number;
  /** Release seconds (exponential to silence). */
  r?: number;
  /** Peak gain (before trims). */
  peak: number;
  /** Detune in cents. */
  detune?: number;
  /** Low-pass cutoff (Hz) and optional sweep target. */
  lp?: number;
  lpTo?: number;
  q?: number;
  /** Per-trigger randomisation: pitch in cents, start offset in ms, peak as a fraction. */
  jit?: Jitter;
  /** Parallel level into the space bus, 0..1. Omitted or 0 means dry. */
  send?: number;
}

/**
 * Per-trigger randomisation. Without it a cue is bit-identical on every play, which is the single
 * loudest tell that a sound was generated rather than recorded: the noise-bearing cues already
 * sound better than the pure-tone ones purely because `noise()` randomises its buffer offset.
 */
interface Jitter {
  /** Pitch spread in cents, applied symmetrically with an anti-repeat redraw. */
  cents?: number;
  /** Start-time spread in milliseconds, applied forwards only. */
  ms?: number;
  /** Peak spread as a fraction of the composed peak (0.1 = ±10%). */
  vel?: number;
  /** Anti-repeat memory key; defaults to the pitch, so two layers can share or not share a draw. */
  key?: string;
}

interface NoiseParams {
  color?: NoiseColor;
  at?: number;
  a?: number;
  dur: number;
  r?: number;
  peak: number;
  filter?: { type: BiquadFilterType; from: number; to?: number; q?: number };
  jit?: Jitter;
  send?: number;
}

/** Uniform in [lo, hi). */
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/**
 * A cents offset within ±spread that is never twice the same. The redraw rejects a value within a
 * quarter of the spread of the previous one, so consecutive presses are audibly, not just
 * statistically, different.
 */
const lastCents = new Map<string, number>();
function jitterCents(key: string, spread: number): number {
  const previous = lastCents.get(key);
  let value = between(-spread, spread);
  if (previous !== undefined && Math.abs(value - previous) < spread * 0.25) value = between(-spread, spread);
  lastCents.set(key, value);
  return value;
}

const centsMul = (cents: number) => Math.pow(2, cents / 1200);

/**
 * Draw from a shuffled bag rather than round-robin: modulo cycling through four pitches produces
 * an audible four-beat pattern under fast tapping. A new cycle never opens on the note the last
 * one closed with.
 */
function shuffleBag<T>(items: readonly T[]): () => T {
  let bag: T[] = [];
  let last: T | undefined;
  return () => {
    if (!bag.length) {
      bag = [...items];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      const first = bag.length - 1;
      if (bag.length > 1 && bag[first] === last) [bag[0], bag[first]] = [bag[first], bag[0]];
    }
    last = bag.pop() as T;
    return last;
  };
}

const SILENT = 0.0001;

/** Small helper that schedules voices into a context and tracks the cue's total length. */
class Voice {
  /** Cue length in seconds (max end time of any scheduled voice). */
  length = 0;

  constructor(
    private readonly ac: BaseAudioContext,
    private readonly out: AudioNode,
    private readonly t0: number,
    private readonly pitch: number,
    private readonly gain: number,
    private readonly noiseBuffer: (color: NoiseColor) => AudioBuffer,
    /** Parallel bus into the short room; null when the chain has no space (older contexts). */
    private readonly space: AudioNode | null = null,
  ) {}

  private track(end: number): number {
    this.length = Math.max(this.length, end);
    return end;
  }

  /** Tap a scheduled layer into the room without changing its dry level. */
  private sendTo(from: AudioNode, level: number | undefined, at: number): void {
    if (!level || !this.space) return;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(level, at);
    from.connect(g);
    g.connect(this.space);
  }

  tone(p: ToneParams): number {
    const ac = this.ac;
    const j = p.jit;
    const t = this.t0 + (p.at ?? 0) + (j?.ms ? between(0, j.ms) / 1000 : 0);
    const a = p.a ?? 0.006;
    const d = p.d ?? 0;
    const s = p.s ?? 1;
    const r = p.r ?? 0.08;
    const vel = j?.vel ? between(1 - j.vel, 1 + j.vel) : 1;
    const peak = Math.max(SILENT, p.peak * this.gain * vel);
    const osc = ac.createOscillator();
    osc.type = p.type ?? 'sine';
    const drift = j?.cents ? centsMul(jitterCents(j.key ?? `t${p.freq}`, j.cents)) : 1;
    const f0 = Math.min(18000, Math.max(20, p.freq * this.pitch * drift));
    osc.frequency.setValueAtTime(f0, t);
    if (p.to !== undefined) {
      const f1 = Math.min(18000, Math.max(20, p.to * this.pitch * drift));
      osc.frequency.exponentialRampToValueAtTime(f1, t + (p.glide ?? p.dur));
    }
    if (p.detune) osc.detune.setValueAtTime(p.detune, t);
    const g = ac.createGain();
    g.gain.setValueAtTime(SILENT, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    let level = peak;
    if (d > 0 && s < 1) {
      level = Math.max(SILENT, peak * s);
      g.gain.exponentialRampToValueAtTime(level, t + a + d);
    }
    const relStart = t + Math.max(p.dur, a + d);
    g.gain.setValueAtTime(level, relStart);
    g.gain.exponentialRampToValueAtTime(SILENT, relStart + r);
    let head: AudioNode = osc;
    if (p.lp !== undefined) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = p.q ?? 0.7;
      f.frequency.setValueAtTime(p.lp, t);
      if (p.lpTo !== undefined) f.frequency.exponentialRampToValueAtTime(p.lpTo, t + p.dur);
      head.connect(f);
      head = f;
    }
    head.connect(g);
    g.connect(this.out);
    this.sendTo(g, p.send, t);
    osc.start(t);
    const end = relStart + r + 0.02;
    osc.stop(end);
    return this.track(end - this.t0);
  }

  noise(p: NoiseParams): number {
    const ac = this.ac;
    const j = p.jit;
    const t = this.t0 + (p.at ?? 0) + (j?.ms ? between(0, j.ms) / 1000 : 0);
    const a = p.a ?? 0.005;
    const r = p.r ?? 0.08;
    const vel = j?.vel ? between(1 - j.vel, 1 + j.vel) : 1;
    const peak = Math.max(SILENT, p.peak * this.gain * vel);
    const src = ac.createBufferSource();
    const buffer = this.noiseBuffer(p.color ?? 'white');
    src.buffer = buffer;
    let head: AudioNode = src;
    if (p.filter) {
      const f = ac.createBiquadFilter();
      f.type = p.filter.type;
      f.Q.value = p.filter.q ?? 1;
      f.frequency.setValueAtTime(Math.min(18000, p.filter.from * this.pitch), t);
      if (p.filter.to !== undefined) {
        f.frequency.exponentialRampToValueAtTime(Math.min(18000, p.filter.to * this.pitch), t + p.dur);
      }
      head.connect(f);
      head = f;
    }
    const g = ac.createGain();
    g.gain.setValueAtTime(SILENT, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(p.dur, a));
    g.gain.exponentialRampToValueAtTime(SILENT, t + Math.max(p.dur, a) + r);
    head.connect(g);
    g.connect(this.out);
    this.sendTo(g, p.send, t);
    const total = Math.max(p.dur, a) + r + 0.02;
    // Random offset into the buffer so repeated hits don't sound identical.
    const maxOffset = Math.max(0, buffer.duration - total - 0.01);
    src.start(t, Math.random() * maxOffset);
    src.stop(t + total);
    return this.track(t + total - this.t0);
  }

  /**
   * The onset layer. A real contact sound is broadband across two or three octaves in its first
   * few milliseconds; an oscillator has none of that, which is why the three cues with no noise
   * layer were exactly the three the ear refused to believe. Sub-millisecond attacks are the point
   * here, so this only differs from `noise` in its defaults.
   */
  transient(p: NoiseParams): number {
    return this.noise({ color: 'white', a: 0.0005, r: 0.01, ...p });
  }
}

type CueBuilder = (v: Voice, n: number) => void;

const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.51;
const G6 = 1567.98;
const A4 = 440;
const G4 = 392;
const EB4 = 311.13;

/* Pitch bags for the interaction cues. A press is a physical event, so its pitch should wander the
   way a knock on a real surface does; a fixed f0 played two hundred times a session is the tell. */
const TAP_F0 = shuffleBag([640, 684, 720, 760]);
const SELECT_F0 = shuffleBag([587.33, 622.25, 659.25]);

/**
 * The shared tick: a pure onset with no body at all. Used by `hover` and by `detent`, which is the
 * cue for a switch that must sound the same whichever position it lands on — if picking the
 * riskiest option sounded like a small win, the app would be paying you to bet.
 */
const tick: CueBuilder = (v) => {
  v.transient({
    a: between(0.0002, 0.0004),
    dur: between(0.0015, 0.003),
    r: between(0.008, 0.016),
    peak: between(0.035, 0.055),
    filter: { type: 'highpass', from: between(4000, 5200) * between(0.92, 1.08), q: 0.7 },
    // No space send: a tick with reverb on it sounds like a drip.
  });
};

/**
 * Cue designs. Peaks are "as composed"; the TRIM table below normalises loudness.
 *
 * The three interaction cues are built transient-first. Each is an onset layer (broadband, under a
 * millisecond of attack), a short body, and where it earns one a resonance, with the pitch, the
 * velocity and the layer offsets redrawn on every trigger. What they are *not* is a single
 * oscillator sliding ten semitones downwards in thirty milliseconds, which is what `tap` used to
 * be: physical objects fix their pitch at the moment of contact and decay in amplitude, never in
 * pitch, so the old chirp read as a synthesiser the instant you heard two of them.
 */
const BUILDERS: Record<Cue, CueBuilder> = {
  tap: (v) => {
    const f0 = TAP_F0();
    v.transient({
      dur: 0.0015,
      a: between(0.0003, 0.0008),
      r: between(0.006, 0.014),
      peak: between(0.1, 0.16),
      filter: { type: 'bandpass', from: between(2400, 3600), q: between(0.8, 1.2) },
      jit: { vel: 0.1 },
      send: 0.08,
    });
    v.tone({
      type: 'triangle',
      freq: f0,
      // A 68-cent fall over 12 ms reads as the surface giving slightly, not as a pitch bend.
      to: f0 / 1.04,
      glide: 0.012,
      a: between(0.0015, 0.0025),
      d: between(0.018, 0.026),
      s: 0.35,
      dur: 0.022,
      r: between(0.02, 0.03),
      peak: between(0.14, 0.2),
      lp: between(2600, 3400),
      q: 0.5,
      jit: { cents: 50, ms: 1.2, vel: 0.1, key: 'tap' },
      send: 0.08,
    });
    v.noise({
      at: 0.001,
      a: 0.001,
      dur: 0.008,
      r: between(0.04, 0.07),
      peak: between(0.03, 0.05),
      // Deliberately not an exact octave: a partial at 2.00× fuses into the body and is not heard.
      filter: { type: 'bandpass', from: f0 * between(2.02, 2.06), q: between(6, 10) },
      jit: { ms: 2, vel: 0.1 },
    });
  },
  hover: tick,
  detent: tick,
  select: (v) => {
    const f0 = SELECT_F0() * centsMul(jitterCents('select', 25));
    v.transient({
      a: 0.0004,
      dur: between(0.002, 0.003),
      r: between(0.012, 0.02),
      peak: between(0.12, 0.18),
      filter: { type: 'bandpass', from: between(1800, 2600), q: between(1, 1.4) },
      send: 0.16,
    });
    // Two triangles a few cents apart beat slowly against each other, which is what gives a
    // mechanism its body. One oscillator cannot do it at any peak.
    v.tone({
      type: 'triangle',
      freq: f0,
      a: between(0.002, 0.003),
      d: between(0.04, 0.06),
      s: 0.4,
      dur: 0.05,
      r: between(0.09, 0.13),
      peak: 0.11,
      lp: 3000,
      lpTo: 1800,
      q: 0.6,
      send: 0.17,
    });
    v.tone({
      type: 'triangle',
      freq: f0,
      detune: between(7, 13),
      a: 0.0025,
      d: 0.05,
      s: 0.4,
      dur: 0.05,
      r: 0.1,
      peak: 0.08,
      lp: 3000,
      lpTo: 1800,
      q: 0.6,
      send: 0.17,
    });
    // Inside the ~30 ms fusion threshold, so this is heard as timbre. The old `select` put its
    // second partial 60 ms out, which is why it read as two beeps rather than one switch.
    v.tone({
      type: 'sine',
      freq: f0 * between(2.98, 3.02),
      at: between(0.018, 0.026),
      a: 0.0015,
      dur: 0.02,
      r: between(0.06, 0.09),
      peak: between(0.045, 0.065),
      send: 0.16,
    });
  },
  correct: (v) => {
    [C5, E5, G5].forEach((f, i) =>
      v.tone({
        type: 'triangle',
        freq: f,
        at: i * 0.07,
        a: 0.005,
        d: 0.08,
        s: 0.5,
        dur: 0.16,
        r: 0.16,
        peak: 0.4,
      }),
    );
    v.noise({ at: 0.14, dur: 0.05, r: 0.16, peak: 0.1, filter: { type: 'bandpass', from: 6000, q: 1.2 } });
  },
  wrong: (v) => {
    v.tone({ type: 'triangle', freq: G4, to: 380, a: 0.008, dur: 0.14, r: 0.12, peak: 0.36, lp: 1200 });
    v.tone({
      type: 'triangle',
      freq: EB4,
      to: 300,
      at: 0.15,
      a: 0.01,
      dur: 0.18,
      r: 0.16,
      peak: 0.34,
      lp: 900,
    });
  },
  combo: (v, n) => {
    const depth = Math.min(24, Math.max(0, Math.round(n)));
    const base = C5 * Math.pow(2, depth / 12);
    v.tone({ type: 'triangle', freq: base, a: 0.004, d: 0.05, s: 0.6, dur: 0.09, r: 0.14, peak: 0.36 });
    v.tone({ type: 'sine', freq: base, a: 0.004, dur: 0.08, r: 0.1, peak: 0.2 });
    if (depth >= 4) {
      v.tone({ type: 'sine', freq: base * 3, at: 0.02, a: 0.003, dur: 0.04, r: 0.25, peak: 0.1 });
      v.noise({
        at: 0.01,
        dur: 0.04,
        r: 0.2,
        peak: 0.07,
        filter: { type: 'bandpass', from: Math.min(9000, base * 8), q: 1.5 },
      });
    }
  },
  countdown: (v) => {
    v.tone({ type: 'sine', freq: 1000, a: 0.001, dur: 0.02, r: 0.05, peak: 0.45 });
    v.tone({ type: 'square', freq: 2000, a: 0.001, dur: 0.006, r: 0.012, peak: 0.1, lp: 6000 });
  },
  go: (v) => {
    v.tone({
      type: 'sawtooth',
      freq: 220,
      to: 880,
      glide: 0.24,
      a: 0.01,
      dur: 0.24,
      r: 0.18,
      peak: 0.26,
      lp: 600,
      lpTo: 3200,
    });
    v.tone({ type: 'triangle', freq: 880, at: 0.22, a: 0.004, dur: 0.1, r: 0.2, peak: 0.3 });
  },
  reveal: (v) => {
    v.noise({
      a: 0.03,
      dur: 0.38,
      r: 0.15,
      peak: 0.36,
      filter: { type: 'bandpass', from: 300, to: 3000, q: 0.9 },
    });
  },
  win: (v) => {
    [C5, E5, G5, C6].forEach((f, i) => {
      const last = i === 3;
      const at = i * 0.11;
      const dur = last ? 0.45 : 0.16;
      const r = last ? 0.3 : 0.18;
      v.tone({ type: 'sawtooth', freq: f, detune: -6, at, a: 0.006, dur, r, peak: 0.1, lp: 2400 });
      v.tone({ type: 'sawtooth', freq: f, detune: 6, at, a: 0.006, dur, r, peak: 0.1, lp: 2400 });
      v.tone({ type: 'triangle', freq: f, at, a: 0.006, dur, r, peak: 0.28 });
    });
    v.tone({ type: 'sine', freq: 2093, at: 0.36, a: 0.003, dur: 0.05, r: 0.35, peak: 0.12 });
    v.tone({ type: 'sine', freq: 3136, at: 0.42, a: 0.003, dur: 0.04, r: 0.3, peak: 0.07 });
    v.noise({ at: 0.36, dur: 0.1, r: 0.35, peak: 0.07, filter: { type: 'bandpass', from: 7000, q: 1 } });
  },
  loss: (v) => {
    [E5, C5, A4].forEach((f, i) => {
      const last = i === 2;
      v.tone({
        type: 'triangle',
        freq: f,
        at: i * 0.16,
        a: 0.012,
        dur: last ? 0.3 : 0.18,
        r: last ? 0.35 : 0.22,
        peak: 0.3,
        lp: 1500,
      });
    });
  },
  draw: (v) => {
    v.tone({ type: 'triangle', freq: A4, a: 0.005, dur: 0.1, r: 0.15, peak: 0.35 });
    v.tone({ type: 'triangle', freq: A4, at: 0.15, a: 0.005, dur: 0.1, r: 0.15, peak: 0.35 });
  },
  levelUp: (v) => {
    [C5, D5, E5, G5, C6].forEach((f, i) =>
      v.tone({ type: 'triangle', freq: f, at: i * 0.07, a: 0.004, dur: 0.1, r: 0.12, peak: 0.32 }),
    );
    v.tone({ type: 'sine', freq: G6, at: 0.36, a: 0.003, dur: 0.08, r: 0.5, peak: 0.3 });
    v.tone({ type: 'sine', freq: G6 * 2.4, at: 0.36, a: 0.003, dur: 0.03, r: 0.35, peak: 0.1 });
    v.tone({ type: 'sine', freq: G6 * 4.1, at: 0.36, a: 0.003, dur: 0.02, r: 0.25, peak: 0.04 });
    v.noise({ at: 0.36, dur: 0.06, r: 0.3, peak: 0.06, filter: { type: 'bandpass', from: 8000, q: 1.2 } });
  },
  quest: (v) => {
    v.tone({ type: 'sine', freq: E6, a: 0.003, dur: 0.06, r: 0.5, peak: 0.3 });
    v.tone({ type: 'sine', freq: E6 * 2.76, a: 0.003, dur: 0.02, r: 0.3, peak: 0.08 });
    [C5, E5, G5].forEach((f) =>
      v.tone({ type: 'triangle', freq: f, at: 0.05, a: 0.02, dur: 0.3, r: 0.3, peak: 0.14, lp: 2000 }),
    );
  },
  gem: (v) => {
    v.tone({ type: 'sine', freq: 2093, a: 0.002, dur: 0.03, r: 0.12, peak: 0.35 });
    v.tone({ type: 'sine', freq: 4186, a: 0.002, dur: 0.02, r: 0.08, peak: 0.06 });
    v.tone({ type: 'sine', freq: 2349, at: 0.09, a: 0.002, dur: 0.03, r: 0.16, peak: 0.35 });
  },
  stamp: (v) => {
    v.tone({ type: 'sine', freq: 130, to: 45, glide: 0.12, a: 0.003, dur: 0.1, r: 0.12, peak: 0.6 });
    v.noise({ dur: 0.03, r: 0.06, peak: 0.3, filter: { type: 'lowpass', from: 250, q: 0.8 } });
    [G4, C5, E5].forEach((f) =>
      v.tone({ type: 'triangle', freq: f, at: 0.05, a: 0.01, dur: 0.22, r: 0.28, peak: 0.16, lp: 2500 }),
    );
  },
  streak: (v) => {
    [0, 0.05, 0.09, 0.14, 0.2, 0.27].forEach((at, i) =>
      v.noise({
        at,
        a: 0.002,
        dur: 0.012,
        r: 0.03,
        peak: 0.22 + (i % 2) * 0.06,
        filter: { type: 'bandpass', from: 2500 + i * 250, q: 2 },
      }),
    );
    v.tone({ type: 'sine', freq: 440, to: 880, glide: 0.32, a: 0.02, dur: 0.32, r: 0.2, peak: 0.28 });
  },
  unlock: (v) => {
    [C6, E6, G6].forEach((f, i) => {
      v.tone({ type: 'sine', freq: f, at: i * 0.04, a: 0.003, dur: 0.1, r: 0.55, peak: 0.26 });
      v.tone({ type: 'sine', freq: f * 2, at: i * 0.04, a: 0.003, dur: 0.03, r: 0.3, peak: 0.05 });
    });
  },
  xp: (v, n) => {
    const amount = Math.max(1, n);
    const f = 620 * Math.pow(2, Math.min(1.2, Math.max(0, Math.log2(amount) / 8)));
    v.tone({ type: 'sine', freq: f, a: 0.002, dur: 0.025, r: 0.06, peak: 0.38 });
  },
  tick: (v) => {
    v.tone({ type: 'sine', freq: 1800, a: 0.001, dur: 0.008, r: 0.03, peak: 0.3 });
  },
  whoosh: (v) => {
    v.noise({
      color: 'pink',
      a: 0.06,
      dur: 0.22,
      r: 0.16,
      peak: 0.9,
      filter: { type: 'bandpass', from: 500, to: 2200, q: 0.8 },
    });
  },
  /**
   * The cue for a round you lost but did not leave empty-handed. Two soft triangle taps a rising
   * fourth apart, low-passed, with a paper tick: ascending but quiet, so it reads as "noted"
   * rather than as either a win or a consolation prize. Deliberately less than half the length of
   * `win`, and trimmed below it, so it can never be mistaken for one.
   */
  kept: (v) => {
    v.tone({ type: 'triangle', freq: A4, a: 0.01, dur: 0.09, r: 0.13, peak: 0.26, lp: 1100 });
    v.tone({ type: 'triangle', freq: D5, at: 0.13, a: 0.01, dur: 0.12, r: 0.2, peak: 0.24, lp: 1100 });
    v.noise({
      at: 0.13,
      a: 0.002,
      dur: 0.018,
      r: 0.05,
      peak: 0.1,
      filter: { type: 'bandpass', from: 2200, q: 1.4 },
    });
  },
  error: (v) => {
    v.tone({ type: 'square', freq: 196, a: 0.006, dur: 0.1, r: 0.06, peak: 0.16, lp: 700 });
    v.tone({ type: 'square', freq: 165, at: 0.13, a: 0.006, dur: 0.14, r: 0.1, peak: 0.16, lp: 600 });
  },
};

/**
 * Loudness trims (linear gain) applied per cue so that all cues land in a similar perceived
 * loudness band. Derived by rendering each cue offline (`sound.render`, master gain 1) and
 * measuring RMS over the active part of the cue, then targeting ≈ -15 dBFS (short pings a
 * touch hotter to offset temporal integration; hover/tick intentionally softer; loss gentler).
 */
export const TRIM: Readonly<Record<Cue, number>> = Object.freeze({
  tap: 2.03, // measured to -25 dBFS: it plays hundreds of times a session and sits under everything
  hover: 2.3, // a pure onset with no body composes very quiet; measured to ≈ -36 dBFS
  select: 1.75, // measured to ≈ -22 dBFS: a deliberate confirmation, still under every reward
  correct: 0.94,
  wrong: 0.73,
  combo: 1.1,
  countdown: 1.35,
  go: 1.02,
  reveal: 1.75,
  win: 0.88, // climax cues sit ≈ 1 dB hotter
  loss: 0.7, // deliberately gentle
  draw: 0.9,
  levelUp: 0.98,
  quest: 1.03,
  gem: 1.12,
  stamp: 0.93,
  streak: 0.83,
  unlock: 1.06,
  xp: 1.4,
  tick: 1.5, // designed subtle (≈ -22 dB)
  detent: 2.38, // the neutral switch tick: identical for every position, by design
  kept: 0.78, // strictly below `win` (0.88) — a kept fact must never out-shout a victory
  whoosh: 1.8,
  error: 0.98,
});

/** Default cue-specific `n` when the caller passes none. */
const DEFAULT_N: Partial<Record<Cue, number>> = { combo: 1, xp: 25 };

const NOISE_SECONDS = 1.5;

function makeNoise(ac: BaseAudioContext, color: NoiseColor): AudioBuffer {
  const length = Math.floor(ac.sampleRate * NOISE_SECONDS);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  if (color === 'white') {
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  // Pink noise — Paul Kellet's refined method.
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

const SPACE_SECONDS = 0.16;

/**
 * A tiny room, generated rather than loaded — still zero audio files. 160 ms of decorrelated noise
 * per channel (independent draws, so the tail has width), squared-off decay, sparse early
 * reflections in the first 25 ms and a one-pole lowpass so the tail is dark rather than fizzy.
 * Every cue is dry by default; a layer opts in with `send`, and only a little.
 */
function makeSpace(ac: BaseAudioContext): AudioBuffer {
  const rate = ac.sampleRate;
  const length = Math.max(1, Math.floor(rate * SPACE_SECONDS));
  const buffer = ac.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let previous = 0;
    // One-pole coefficient for a ~5 kHz corner.
    const k = Math.exp((-2 * Math.PI * 5000) / rate);
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const env = Math.pow(1 - t / SPACE_SECONDS, 2.4);
      const gate = t < 0.025 ? (Math.random() < 0.12 ? 1 : 0) : 1;
      const sample = (Math.random() * 2 - 1) * env * gate;
      previous = sample * (1 - k) + previous * k;
      data[i] = previous;
    }
  }
  return buffer;
}

interface Chain {
  master: GainNode;
  out: AudioNode;
  /** Parallel send bus; layers tap into it with `send`. */
  space: AudioNode;
}

function buildChain(ac: BaseAudioContext, masterGain: number, ir: AudioBuffer): Chain {
  const master = ac.createGain();
  master.gain.value = masterGain;
  // A safety limiter, not a tone shaper. The old settings (threshold -14, knee 12, ratio 4) put
  // every single tap on the knee — a press peaked at -13.9 dBFS — so the compressor was audibly
  // squashing the one cue that plays hundreds of times a session. It now sits above everything and
  // only catches genuine stacks.
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -8;
  comp.knee.value = 6;
  comp.ratio.value = 6;
  comp.attack.value = 0.001;
  comp.release.value = 0.08;
  const spaceSend = ac.createGain();
  spaceSend.gain.value = 1;
  const convolver = ac.createConvolver();
  convolver.normalize = true;
  convolver.buffer = ir;
  const spaceLevel = ac.createGain();
  spaceLevel.gain.value = 0.9;
  spaceSend.connect(convolver);
  convolver.connect(spaceLevel);
  spaceLevel.connect(master);
  master.connect(comp);
  comp.connect(ac.destination);
  return { master, out: master, space: spaceSend };
}

const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      resolve();
    });
  });

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private chain: Chain | null = null;
  private noise: Partial<Record<NoiseColor, AudioBuffer>> = {};
  private space: AudioBuffer | null = null;
  private lastPlayed = new Map<Cue, number>();
  private prefsBound = false;
  private testRun: AbortController | null = null;
  private adPauses = 0;

  /** All cue names, in audition order. */
  readonly cues = CUES;

  /** The underlying AudioContext (null until first play/unlock, and always null on the server). */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** True once an AudioContext exists and is running. */
  get ready(): boolean {
    return this.ctx?.state === 'running';
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    this.space ??= makeSpace(this.ctx);
    this.chain = buildChain(this.ctx, getPrefs().volume, this.space);
    if (!this.prefsBound) {
      this.prefsBound = true;
      subscribePrefs((p) => {
        if (this.ctx && this.chain) {
          this.chain.master.gain.setTargetAtTime(p.volume, this.ctx.currentTime, 0.02);
        }
      });
    }
    return this.ctx;
  }

  /**
   * Create/resume the AudioContext. Call from a user-gesture handler (pointerdown, keydown);
   * `<FxProvider>` installs one for you. Safe to call repeatedly.
   */
  unlock(): void {
    if (this.adPauses) return;
    const ac = this.ensure();
    if (!ac) return;
    if (ac.state === 'suspended') void ac.resume().catch(() => undefined);
  }

  /** Silence game cues while a provider owns an ad break, including gesture auto-unlock. */
  pauseForAd(): () => void {
    this.adPauses += 1;
    if (this.adPauses === 1) {
      this.stop();
      if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => undefined);
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.adPauses = Math.max(0, this.adPauses - 1);
      // Do not force playback after the break; the next user gesture can unlock it.
    };
  }

  private noiseFor(ac: BaseAudioContext): (color: NoiseColor) => AudioBuffer {
    return (color) => {
      if (ac !== this.ctx) return makeNoise(ac, color); // offline contexts get fresh buffers
      const cached = this.noise[color];
      if (cached) return cached;
      const made = makeNoise(ac, color);
      this.noise[color] = made;
      return made;
    };
  }

  /**
   * Play a cue. Returns the cue length in seconds, or 0 when nothing was scheduled (prefs off,
   * hidden tab, throttled, unsupported, server).
   */
  play(cue: Cue, opts: PlayOptions = {}): number {
    if (typeof document === 'undefined' || this.adPauses) return 0;
    const prefs = getPrefs();
    if (!prefs.sound || prefs.volume <= 0 || document.hidden) return 0;
    const builder = BUILDERS[cue];
    if (!builder) return 0;
    const now = performance.now();
    const last = this.lastPlayed.get(cue);
    if (last !== undefined && now - last < throttleFor(cue)) return 0;
    this.lastPlayed.set(cue, now);
    const ac = this.ensure();
    if (!ac || !this.chain) return 0;
    if (ac.state === 'suspended') void ac.resume().catch(() => undefined);
    try {
      const voice = new Voice(
        ac,
        this.chain.out,
        ac.currentTime + 0.005,
        opts.pitch ?? 1,
        (opts.gain ?? 1) * TRIM[cue],
        this.noiseFor(ac),
        this.chain.space,
      );
      builder(voice, opts.n ?? DEFAULT_N[cue] ?? 1);
      return voice.length;
    } catch (err) {
      console.error('[fx/sound] failed to play', cue, err);
      return 0;
    }
  }

  /**
   * Render a cue into an OfflineAudioContext (mono, 1.3 s) — used for loudness analysis and
   * tests. Ignores prefs. Resolves to null where Web Audio is unavailable.
   */
  async render(cue: Cue, opts: PlayOptions = {}, sampleRate = 44100): Promise<AudioBuffer | null> {
    if (typeof window === 'undefined') return null;
    const Ctor: typeof OfflineAudioContext | undefined =
      window.OfflineAudioContext ??
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext;
    if (!Ctor) return null;
    const ac = new Ctor(1, Math.ceil(sampleRate * 1.3), sampleRate);
    const chain = buildChain(ac, 1, makeSpace(ac));
    const voice = new Voice(
      ac,
      chain.out,
      0.01,
      opts.pitch ?? 1,
      (opts.gain ?? 1) * TRIM[cue],
      (c) => makeNoise(ac, c),
      chain.space,
    );
    BUILDERS[cue](voice, opts.n ?? DEFAULT_N[cue] ?? 1);
    return ac.startRendering();
  }

  /**
   * Audition every cue in sequence (≈ 12 s). Resolves when done or when `stop()` is called.
   * Used by the settings dialog "Preview sounds" button.
   */
  async test(gapMs = 260): Promise<void> {
    this.stop();
    const run = new AbortController();
    this.testRun = run;
    this.unlock();
    for (const cue of CUES) {
      if (run.signal.aborted) break;
      const seconds = this.play(cue, cue === 'combo' ? { n: 5 } : cue === 'xp' ? { n: 50 } : {});
      await wait(Math.max(120, seconds * 1000) + gapMs, run.signal);
    }
    if (this.testRun === run) this.testRun = null;
  }

  /** Cancel an in-progress `test()` run. */
  stop(): void {
    this.testRun?.abort();
    this.testRun = null;
  }

  /** True while `test()` is running. */
  get testing(): boolean {
    return this.testRun !== null;
  }
}

/** Shared engine — one AudioContext per page. */
export const sound = new SoundEngine();

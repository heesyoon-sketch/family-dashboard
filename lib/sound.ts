// Per-task completion chimes.
//
// We pick from 8 distinct sound patterns using a stable hash of the task id,
// so each habit on the dashboard always plays the same chime — and across a
// family of two kids with ~4 tasks each, every habit gets its own voice.
// Patterns vary in waveform, frequency, rhythm, and contour so they're
// audibly distinct rather than transposed copies of each other.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return ctx;
}

function tone(
  ac: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gain = 0.22,
  type: OscillatorType = 'sine',
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.connect(g);
  g.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  // Tiny attack ramp prevents the pop you get from instant-on at gain.
  g.gain.setValueAtTime(0.0001, startTime);
  g.gain.exponentialRampToValueAtTime(gain, startTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

type Chime = (ac: AudioContext, t: number) => void;

const CHIMES: Chime[] = [
  // 0 — Bright triple (C–G–C)
  (ac, t) => {
    [523, 784, 1047].forEach((f, i) => tone(ac, f, t + i * 0.08, 0.16, 0.18, 'sine'));
  },
  // 1 — Soft single triangle pluck
  (ac, t) => {
    tone(ac, 523, t, 0.22, 0.22, 'triangle');
    tone(ac, 1046, t + 0.01, 0.18, 0.10, 'sine');
  },
  // 2 — Quick double bounce (D–A)
  (ac, t) => {
    tone(ac, 587, t,        0.10, 0.20, 'sine');
    tone(ac, 880, t + 0.07, 0.14, 0.18, 'sine');
  },
  // 3 — Descending arpeggio (A–F–D)
  (ac, t) => {
    [880, 698, 587].forEach((f, i) => tone(ac, f, t + i * 0.07, 0.14, 0.18, 'triangle'));
  },
  // 4 — Mellow bell (E sustained)
  (ac, t) => {
    tone(ac, 659, t, 0.34, 0.20, 'sine');
    tone(ac, 1318, t + 0.02, 0.18, 0.06, 'sine');
  },
  // 5 — Two-note jingle (A–E)
  (ac, t) => {
    tone(ac, 440, t,        0.12, 0.22, 'triangle');
    tone(ac, 660, t + 0.10, 0.18, 0.20, 'triangle');
  },
  // 6 — Major chord stab (C–E–G simultaneous)
  (ac, t) => {
    tone(ac, 523, t, 0.22, 0.13, 'sine');
    tone(ac, 659, t, 0.22, 0.12, 'sine');
    tone(ac, 784, t, 0.22, 0.12, 'sine');
  },
  // 7 — Rising synth ladder (G–C–E–G)
  (ac, t) => {
    [392, 523, 659, 784].forEach((f, i) => tone(ac, f, t + i * 0.05, 0.10, 0.16, 'square'));
  },
];

function hashString(s: string): number {
  // FNV-1a — small, stable, no dependencies.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Play the chime assigned to this task. The choice is deterministic from
 *  the task id so the same habit always sounds the same. */
export function playCompletionSound(taskKey: string) {
  if (typeof window === 'undefined') return;
  try {
    const ac = getCtx();
    if (ac.state === 'suspended') ac.resume();
    const idx = hashString(taskKey) % CHIMES.length;
    CHIMES[idx](ac, ac.currentTime);
  } catch {
    // silently ignore (e.g. Safari private mode)
  }
}

/** Soft "rewind" tone for undoing a completion. Deliberately understated
 *  — a quiet descending pair so the gesture feels reversible, not
 *  celebratory. Same shape regardless of task. */
export function playUndoSound() {
  if (typeof window === 'undefined') return;
  try {
    const ac = getCtx();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime;
    tone(ac, 660, t,        0.10, 0.12, 'triangle');
    tone(ac, 440, t + 0.07, 0.18, 0.11, 'triangle');
  } catch {
    // silently ignore
  }
}

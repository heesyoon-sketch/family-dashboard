import type { ThemeName } from './db';

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
  gain = 0.25,
  type: OscillatorType = 'sine',
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.connect(g);
  g.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  g.gain.setValueAtTime(gain, startTime);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function playCompletionSound(theme: ThemeName) {
  if (typeof window === 'undefined') return;
  try {
    const ac = getCtx();
    // Resume if suspended (browser autoplay policy)
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime;

    if (theme === 'robot_neon' || theme === 'pastel_cute') {
      [523, 784, 1047].forEach((freq, i) => {
        tone(ac, freq, t + i * 0.1, 0.15, 0.18, 'sine');
      });
    } else {
      // dark_minimal / warm_minimal
      tone(ac, 440, t, 0.1, 0.2, 'triangle');
    }
  } catch {
    // silently ignore (e.g. Safari private mode)
  }
}

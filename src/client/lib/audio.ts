export type SoundName = 'play' | 'pass' | 'chop' | 'win' | 'turn' | 'instant' | 'error';

let enabled = readEnabled();
let ctx: AudioContext | null = null;

function readEnabled(): boolean {
  try {
    return localStorage.getItem('tl-sound') !== 'off';
  } catch {
    return true;
  }
}

export function soundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem('tl-sound', on ? 'on' : 'off');
  } catch {
    /* ignore private mode */
  }
}

function context(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function playSound(name: SoundName): void {
  if (!enabled) return;
  const notes =
    name === 'play'
      ? [523, 659]
      : name === 'pass'
        ? [196]
        : name === 'chop'
          ? [523, 659, 784]
          : name === 'win'
            ? [523, 659, 784, 1046]
            : name === 'instant'
              ? [392, 523, 659, 784, 1046]
              : name === 'turn'
                ? [784, 988]
                : [160];
  try {
    const audio = context();
    const now = audio.currentTime;
    notes.forEach((freq, index) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = name === 'pass' || name === 'error' ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      const start = now + index * 0.07;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.22);
    });
  } catch {
    /* autoplay can block the first gesture */
  }
}

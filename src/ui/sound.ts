/**
 * Sound and touch feedback, synthesised with WebAudio so the game ships no audio files.
 * Everything here is best-effort: a browser that blocks audio or vibration just stays quiet.
 */

export const SOUND_IDS = ['event', 'urgent', 'choose', 'good', 'bad', 'coin', 'care', 'end'] as const;
export type SoundId = (typeof SOUND_IDS)[number];

export interface Sound {
  /** Must be called from a user gesture once; browsers keep audio locked until then. */
  unlock(): void;
  play(id: SoundId): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
}

interface Note {
  readonly freq: number;
  /** Seconds after the sound starts. */
  readonly at: number;
  readonly length: number;
  readonly type: OscillatorType;
  readonly gain: number;
}

const note = (freq: number, at: number, length: number, type: OscillatorType = 'sine', gain = 0.12): Note => ({
  freq,
  at,
  length,
  type,
  gain,
});

export const SOUNDS: Readonly<Record<SoundId, readonly Note[]>> = {
  event: [note(880, 0, 0.12), note(1175, 0.1, 0.16)],
  urgent: [note(740, 0, 0.14, 'square', 0.08), note(740, 0.18, 0.14, 'square', 0.08), note(988, 0.36, 0.2, 'square', 0.08)],
  choose: [note(523, 0, 0.08, 'triangle')],
  good: [note(523, 0, 0.1, 'triangle'), note(659, 0.09, 0.1, 'triangle'), note(784, 0.18, 0.18, 'triangle')],
  bad: [note(311, 0, 0.16, 'sawtooth', 0.07), note(247, 0.14, 0.24, 'sawtooth', 0.07)],
  coin: [note(1319, 0, 0.07, 'square', 0.06), note(1760, 0.07, 0.16, 'square', 0.06)],
  care: [note(392, 0, 0.12), note(494, 0.1, 0.12), note(587, 0.2, 0.2)],
  end: [note(392, 0, 0.2), note(330, 0.2, 0.2), note(262, 0.4, 0.4)],
};

/** Vibration patterns in milliseconds, for phones. */
export const HAPTICS: Readonly<Partial<Record<SoundId, readonly number[]>>> = {
  urgent: [60, 40, 60],
  bad: [90],
  good: [25],
  coin: [15],
};

export function createSound(): Sound {
  let context: AudioContext | null = null;
  let muted = false;

  const ensure = (): AudioContext | null => {
    if (context !== null) return context;
    const Ctor = typeof AudioContext === 'undefined' ? undefined : AudioContext;
    if (Ctor === undefined) return null;
    try {
      context = new Ctor();
    } catch {
      context = null;
    }
    return context;
  };

  return {
    get muted() {
      return muted;
    },
    setMuted(value) {
      muted = value;
    },
    unlock() {
      const ctx = ensure();
      if (ctx !== null && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    },
    play(id) {
      if (muted) return;
      const pattern = HAPTICS[id];
      if (pattern !== undefined && typeof navigator.vibrate === 'function') navigator.vibrate([...pattern]);
      const ctx = ensure();
      if (ctx === null || ctx.state !== 'running') return;
      const start = ctx.currentTime;
      for (const n of SOUNDS[id]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = n.type;
        osc.frequency.value = n.freq;
        gain.gain.setValueAtTime(0.0001, start + n.at);
        gain.gain.exponentialRampToValueAtTime(n.gain, start + n.at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + n.at + n.length);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start + n.at);
        osc.stop(start + n.at + n.length + 0.02);
      }
    },
  };
}

/** A sound that does nothing: used in tests and when the player mutes. */
export const silentSound: Sound = {
  unlock: () => undefined,
  play: () => undefined,
  setMuted: () => undefined,
  muted: true,
};

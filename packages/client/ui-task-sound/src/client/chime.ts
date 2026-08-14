/**
 * Chime playback: synthesize the default two-tone chime with Web Audio, or
 * play a user-configured audio URL. The browser half injects the concrete
 * constructors so tests drive a fake sink without touching real audio.
 */

import type { TaskSoundSettings } from '../task-sound-settings.ts'

/** Constructor surface the browser half injects (jsdom-safe in tests). */
export interface ChimePlayerSink {
  /** Create an audio context; returns null when audio is unavailable. */
  createContext(): { currentTime: number; createOscillator(): ChimeOscillator; createGain(): ChimeGain; close?(): Promise<void> } | null
  /** Create an element playing a URL (custom chime). */
  createAudio(url: string): { volume: number; play(): Promise<void> | void }
}

/** Oscillator face the sink returns. */
export interface ChimeOscillator {
  type: OscillatorType
  frequency: { value: number }
  connect(destination: unknown): void
  start(when?: number): void
  stop(when?: number): void
}

/** Gain node face the sink returns. */
export interface ChimeGain {
  gain: { value: number; setValueAtTime?(value: number, time: number): void }
  connect(destination: unknown): void
}

/** Default two-tone chime (E5 then C5, 180ms each with a soft envelope). */
const DEFAULT_CHIME: readonly [Note, Note] = [
  { frequency: 659.25, offsetMs: 0 },
  { frequency: 523.25, offsetMs: 200 },
]

/** One synthesized note. */
interface Note {
  frequency: number
  offsetMs: number
}

const NOTE_MS = 220
const TAIL_MS = 80
/** Total playback length: the second note's offset plus its tail. */
const CHIME_END_MS = NOTE_MS + TAIL_MS + DEFAULT_CHIME[1].offsetMs

/**
 * Play the configured chime. Falls back to the synthesized default when the
 * setting carries no URL; a custom URL plays through the element sink.
 * @param settings - resolved task-sound preferences.
 * @param sink - injected audio constructors.
 */
export async function playChime(
  settings: TaskSoundSettings,
  sink: ChimePlayerSink,
): Promise<void> {
  if (!settings.enabled) return
  const url = settings.url.trim()
  if (url !== '') {
    const audio = sink.createAudio(url)
    audio.volume = settings.volume
    await audio.play()
    return
  }
  const ctx = sink.createContext()
  if (ctx === null) return
  const master = ctx.createGain()
  master.gain.value = settings.volume
  const now = ctx.currentTime
  for (const note of DEFAULT_CHIME) {
    const start = now + note.offsetMs / 1000
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = note.frequency
    const gain = ctx.createGain()
    // 10ms attack, held level, 220ms release — a soft "ding".
    gain.gain.setValueAtTime?.(0.0001, start)
    gain.gain.setValueAtTime?.(0.5, start + 0.01)
    gain.gain.setValueAtTime?.(0.0001, start + NOTE_MS / 1000)
    osc.connect(gain)
    gain.connect(master)
    osc.start(start)
    osc.stop(start + (NOTE_MS + TAIL_MS) / 1000)
  }
  master.connect(ctx)
  // Keep the context alive only as long as the longest note's tail.
  const done = new Promise<void>((resolve) => {
    setTimeout(() => {
      const settle = (): void => { resolve() }
      void ctx.close?.().then(settle, settle)
    }, CHIME_END_MS + 40)
  })
  await done
}

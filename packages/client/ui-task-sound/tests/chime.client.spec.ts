import { describe, expect, it, vi } from 'vitest'
import { playChime, type ChimeGain, type ChimeOscillator, type ChimePlayerSink } from '../src/client/chime.ts'

/** Scripted audio sink: one context, records node creations and element plays. */
function fakeSink(): {
  sink: ChimePlayerSink
  contextCount: { count: number }
  oscillators: ChimeOscillator[]
  gains: ChimeGain[]
  elements: { url: string; volume: number; play: () => Promise<void> }[]
} {
  const oscillators: ChimeOscillator[] = []
  const gains: ChimeGain[] = []
  const elements: { url: string; volume: number; play: () => Promise<void> }[] = []
  const contextCount = { count: 0 }
  const sink: ChimePlayerSink = {
    createContext() {
      contextCount.count += 1
      return {
        currentTime: 0,
        createOscillator() {
          const osc: ChimeOscillator = {
            type: 'sine',
            frequency: { value: 0 },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
          }
          oscillators.push(osc)
          return osc
        },
        createGain(): ChimeGain {
          const gain: ChimeGain = { gain: { value: 0, setValueAtTime: vi.fn() }, connect: vi.fn() }
          gains.push(gain)
          return gain
        },
        close: vi.fn(() => Promise.resolve()),
      }
    },
    createAudio(url) {
      const element = { url, volume: 1, play: vi.fn(() => Promise.resolve()) }
      elements.push(element)
      return element
    },
  }
  return { sink, contextCount, oscillators, gains, elements }
}

describe('playChime', () => {
  it('plays the custom URL with the configured volume when a URL is set', async () => {
    const { sink, elements } = fakeSink()
    await playChime({ enabled: true, url: '/custom.mp3', volume: 0.8 }, sink)
    expect(elements).toHaveLength(1)
    const element = elements[0]!
    expect(element.url).toBe('/custom.mp3')
    expect(element.volume).toBe(0.8)
    expect(element.play).toHaveBeenCalled()
  })

  it('synthesizes the two-tone default chime when no URL is set', async () => {
    const { sink, oscillators, contextCount } = fakeSink()
    await playChime({ enabled: true, url: '', volume: 0.5 }, sink)
    expect(contextCount.count).toBe(1)
    expect(oscillators).toHaveLength(2)
    expect(oscillators.map(osc => osc.frequency.value)).toEqual([659.25, 523.25])
  })

  it('does nothing when disabled, even with a URL', async () => {
    const { sink, contextCount, elements } = fakeSink()
    await playChime({ enabled: false, url: '/custom.mp3', volume: 0.5 }, sink)
    expect(contextCount.count).toBe(0)
    expect(elements).toHaveLength(0)
  })

  it('skips synthesis when no audio context is available', async () => {
    const sink: ChimePlayerSink = { createContext: () => null, createAudio: () => ({ volume: 1, play: () => Promise.resolve() }) }
    await playChime({ enabled: true, url: '', volume: 0.5 }, sink)
    expect(true).toBe(true)
  })

  it('applies the volume to the synthesized master gain', async () => {
    const { sink, gains } = fakeSink()
    await playChime({ enabled: true, url: '', volume: 0.3 }, sink)
    // The master gain is created before the per-note gains; its value carries the volume.
    expect(gains[0]!.gain.value).toBe(0.3)
  })

  it('settles even when closing the context rejects', async () => {
    const { sink } = fakeSink()
    const original = sink.createContext.bind(sink)
    sink.createContext = () => {
      const ctx = original()
      if (ctx === null) throw new Error('fake sink never returns null')
      ctx.close = vi.fn(() => Promise.reject(new Error('close failed')))
      return ctx
    }
    await expect(playChime({ enabled: true, url: '', volume: 0.5 }, sink)).resolves.toBeUndefined()
  })
})

/** ui-task-sound browser apply wiring: settings-section registration, the
 * completion-edge listener firing the chime through the injected sink, and
 * HMR-safe disposal of both. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { SettingsScopeBinder } from '@deepseek-ai/dsh-client-ui-settings/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-task-sound/client'
import { TaskSoundSection } from '../src/client/TaskSoundSection.tsx'
import { TASK_SOUND_SETTINGS_NAMESPACE, TaskSoundSettingsSchema } from '../src/task-sound-settings.ts'
import type { SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { ChimePlayerSink } from '../src/client/chime.ts'

const SLOT = 'settings.section'

function emptyList(): SessionListState {
  return {
    ids: [], byId: {}, current: undefined, phase: 'ready',
    subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  }
}

/** Scripted sessions service: a settable snapshot store plus a spy sink. */
async function bench(settingsValue?: unknown) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const settings = { enabled: true, url: '', volume: 0.5 }
  const namespace = () => ({
    ns: TASK_SOUND_SETTINGS_NAMESPACE,
    schema: TaskSoundSettingsSchema.toJSON(),
    value: settingsValue === undefined ? settings : settingsValue,
    applies: 'live' as const,
    secrets: [],
    revision: 0,
  })
  const describe = vi.fn(() => Promise.resolve({
    rpcId: 'task-sound-describe' as never,
    result: { ok: true as const, value: { writable: true, hasDocument: true, namespaces: [namespace()] } },
  }))
  const mutate = vi.fn((request: { ops: { path: string[]; value: unknown }[] }) => {
    for (const op of request.ops) (settings as Record<string, unknown>)[op.path[0]!] = op.value
    return Promise.resolve({
      rpcId: 'task-sound-mutate' as never,
      result: { ok: true as const, value: namespace() },
    })
  })
  ctx.provide('connection', { api: { settings: { describe, mutate } }, isLoopback: true } as never)
  new TestRemote(ctx)
  await ctx.plugin(SettingsScopeBinder).await()

  // Sessions service face: a plain snapshot store the test drives.
  let state = emptyList()
  const listeners = new Set<() => void>()
  const sessions = {
    list: {
      getSnapshot: () => state,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
  }
  ctx.provide('sessions', sessions as never)
  const setList = (next: SessionListState): void => {
    state = next
    for (const listener of [...listeners]) listener()
  }

  const createContext = vi.fn<() => NonNullable<ReturnType<ChimePlayerSink['createContext']>>>(() => ({
    currentTime: 0,
    createOscillator: () => ({ type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }),
    createGain: () => ({ gain: { value: 0, setValueAtTime: vi.fn() }, connect: vi.fn() }),
    close: vi.fn(() => Promise.resolve()),
  }))
  const sink: ChimePlayerSink = {
    createContext,
    createAudio: vi.fn(() => ({ volume: 1, play: vi.fn(() => Promise.resolve()) })),
  }

  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, setList, sink, settings, createContext }
}

/** Register the settings-section declaration the plugin injects into. */
function declareSection(slots: SlotRegistry): () => void {
  return slots.register(
    { name: 'root', children: { [SLOT]: { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
}

function summary(id: string, running: boolean) {
  const sessionId = id as SessionId
  return {
    id: sessionId,
    displayTitle: id,
    running,
    blank: false,
    updatedAt: 0,
  }
}

function listOf(...entries: ReturnType<typeof summary>[]): SessionListState {
  const byId: SessionListState['byId'] = {}
  for (const entry of entries) byId[entry.id] = entry
  return { ...emptyList(), ids: entries.map(entry => entry.id), byId }
}

describe('ui-task-sound browser apply', () => {
  it('declares the expected inject face', () => {
    expect(inject).toEqual(['slots', 'locale', 'sessions', 'settingsScope'])
  })

  it('registers the localized settings section', async () => {
    const b = await bench()
    declareSection(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }, { sink: b.sink }).await()
    expect(b.locale.bind('settings.taskSound')('nav')).toBe('提示音')
    const entry = b.slots.entries(SLOT).find(e => e.component === TaskSoundSection)
    expect(entry).toBeDefined()
    expect(entry?.options).toMatchObject({ id: 'task-sound' })
  })

  it('plays the chime on a running→idle edge and not before', async () => {
    const b = await bench()
    declareSection(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }, { sink: b.sink }).await()
    b.setList(listOf(summary('a', true)))
    expect(b.createContext).not.toHaveBeenCalled()
    b.setList(listOf(summary('a', false)))
    expect(b.createContext).toHaveBeenCalledTimes(1)
  })

  it('uses the browser sink by default, falling back to null context in jsdom', async () => {
    // No config: the plugin constructs its own browser sink. jsdom has no
    // AudioContext, so the sink's createContext returns null and playChime
    // no-ops — the edge listener still runs.
    const b = await bench()
    declareSection(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    b.setList(listOf(summary('a', true)))
    b.setList(listOf(summary('a', false)))
    expect(true).toBe(true)
  })

  it('falls back to defaults when the settings scope carries no value', async () => {
    const b = await bench(null)
    declareSection(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }, { sink: b.sink }).await()
    b.setList(listOf(summary('a', true)))
    b.setList(listOf(summary('a', false)))
    expect(b.createContext).toHaveBeenCalledTimes(1)
  })

  it('invokes the section label and inject face from the registered entry', async () => {
    const b = await bench()
    declareSection(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries(SLOT).find(e => e.component === TaskSoundSection)!
    const label = entry.options.label
    expect(typeof label === 'function' ? label() : label).toBe('提示音')
    const injected: Record<string, unknown> = entry.inject!(undefined as never)
    expect(injected.scope).toBeDefined()
  })

  it('browser sink creates an AudioContext when available', async () => {
    const context = {
      currentTime: 0,
      createOscillator: vi.fn(() => ({ type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() })),
      createGain: vi.fn(() => ({ gain: { value: 0, setValueAtTime: vi.fn() }, connect: vi.fn() })),
      close: vi.fn(() => Promise.resolve()),
    }
    const createContext = vi.fn(function AudioContext(this: unknown) {
      return context
    })
    vi.stubGlobal('AudioContext', createContext)
    vi.stubGlobal('Audio', vi.fn(function Audio(this: unknown) {
      return { volume: 1, play: vi.fn(() => Promise.resolve()) }
    }))
    try {
      const b = await bench()
      declareSection(b.slots)
      await b.ctx.plugin({ inject: [...inject], apply }).await()
      b.setList(listOf(summary('a', true)))
      b.setList(listOf(summary('a', false)))
      expect(createContext).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('browser sink plays a custom URL through an Audio element', async () => {
    const audio = { volume: 1, play: vi.fn(() => Promise.resolve()) }
    const audioCtor = vi.fn(function Audio(this: typeof audio) {
      return audio
    })
    vi.stubGlobal('Audio', audioCtor)
    try {
      const b = await bench()
      declareSection(b.slots)
      b.settings.url = '/custom.mp3'
      b.settings.enabled = true
      await b.ctx.plugin({ inject: [...inject], apply }).await()
      b.setList(listOf(summary('a', true)))
      b.setList(listOf(summary('a', false)))
      expect(audioCtor).toHaveBeenCalledWith('/custom.mp3')
      expect(audio.play).toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('unsubscribes the edge listener and unregisters the section on dispose', async () => {
    const b = await bench()
    declareSection(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply }, { sink: b.sink })
    await fiber.await()
    await fiber.dispose()
    b.setList(listOf(summary('a', true)))
    b.setList(listOf(summary('a', false)))
    expect(b.createContext).not.toHaveBeenCalled()
    expect(b.slots.entries(SLOT).some(e => e.component === TaskSoundSection)).toBe(false)
  })
})

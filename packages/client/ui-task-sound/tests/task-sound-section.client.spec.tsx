// @vitest-environment jsdom
/** TaskSoundSection behavior: renders from the scope snapshot, and each
 * control writes its field through the injected settings scope. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { TaskSoundSection, type TaskSoundSectionProps } from '../src/client/TaskSoundSection.tsx'
import type { TaskSoundSettings } from '../src/task-sound-settings.ts'

afterEach(cleanup)

const COPY: Record<string, string> = {
  'title': 'Task-completion chime',
  'description': 'Play a sound when a session finishes its task.',
  'enabled': 'Enable chime',
  'url': 'Custom audio URL',
  'url.placeholder': 'Leave empty for the default chime',
  'volume': 'Volume',
}

/** Scripted scope: fixed snapshot plus spies for set/unset/subscribe. */
function fakeScope(value?: TaskSoundSettings): {
  scope: SettingsScope<TaskSoundSettings>
  set: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  emit: (next: TaskSoundSettings) => void
  disposed: { count: number }
} {
  const listeners = new Set<() => void>()
  const disposed = { count: 0 }
  let snapshot: SettingsScopeSnapshot<TaskSoundSettings> = {
    status: value === undefined ? 'loading' : 'ready',
    value,
    base: undefined,
    user: undefined,
    revision: 0,
    writable: true,
    mode: 'host',
  }
  const set = vi.fn(() => Promise.resolve())
  const subscribe = vi.fn((listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener); disposed.count += 1 }
  })
  const scope: SettingsScope<TaskSoundSettings> = {
    getSnapshot: () => snapshot,
    subscribe,
    set,
    unset: vi.fn(() => Promise.resolve()),
  }
  return {
    scope,
    set,
    subscribe,
    emit: (next: TaskSoundSettings) => {
      snapshot = { ...snapshot, value: next, status: 'ready' }
      for (const listener of listeners) listener()
    },
    disposed,
  }
}

function mount(scope: SettingsScope<TaskSoundSettings>) {
  const props: TaskSoundSectionProps = {
    scope,
    t: (key: string) => COPY[key] ?? key,
  }
  render(<TaskSoundSection {...props} />)
}

describe('TaskSoundSection', () => {
  it('renders defaults while the scope is still loading', () => {
    const { scope } = fakeScope(undefined)
    mount(scope)
    expect(screen.getByText('Task-completion chime')).toBeDefined()
    const enabled = screen.getByRole('checkbox') as HTMLInputElement
    expect(enabled.checked).toBe(true)
    expect(screen.getByText('50%')).toBeDefined()
  })

  it('renders the persisted values when the scope is ready', () => {
    const { scope } = fakeScope({ enabled: false, url: '/ding.mp3', volume: 0.9 })
    mount(scope)
    expect(screen.getByRole<HTMLInputElement>('checkbox').checked).toBe(false)
    expect(screen.getByPlaceholderText<HTMLInputElement>('Leave empty for the default chime').value)
      .toBe('/ding.mp3')
    expect(screen.getByText('90%')).toBeDefined()
  })

  it('writes the enable switch through the scope', () => {
    const { scope, set } = fakeScope({ enabled: true, url: '', volume: 0.5 })
    mount(scope)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(set).toHaveBeenCalledWith('enabled', false)
  })

  it('writes the URL on blur, not on each keystroke', () => {
    const { scope, set } = fakeScope({ enabled: true, url: '', volume: 0.5 })
    mount(scope)
    const input = screen.getByPlaceholderText('Leave empty for the default chime')
    fireEvent.change(input, { target: { value: '/new.mp3' } })
    expect(set).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(set).toHaveBeenCalledWith('url', '/new.mp3')
  })

  it('re-renders from a new scope snapshot on emit', () => {
    const { scope, emit } = fakeScope({ enabled: true, url: '', volume: 0.5 })
    mount(scope)
    act(() => { emit({ enabled: false, url: '/new.mp3', volume: 0.2 }) })
    expect(screen.getByRole<HTMLInputElement>('checkbox').checked).toBe(false)
    expect(screen.getByText('20%')).toBeDefined()
  })

  it('subscribes on mount and unsubscribes on unmount', () => {
    const { scope, subscribe, disposed } = fakeScope({ enabled: true, url: '', volume: 0.5 })
    const view = render(<TaskSoundSection scope={scope} t={key => COPY[key] ?? key} />)
    expect(subscribe).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(disposed.count).toBe(1)
  })

  it('writes the volume range as a number', () => {
    const { scope, set } = fakeScope({ enabled: true, url: '', volume: 0.5 })
    mount(scope)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.75' } })
    expect(set).toHaveBeenCalledWith('volume', 0.75)
  })
})

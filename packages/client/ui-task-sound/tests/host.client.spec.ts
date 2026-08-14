import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { TASK_SOUND_SETTINGS_NAMESPACE, apply } from '@deepseek-ai/dsh-client-ui-task-sound'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('ui-task-sound host', () => {
  it('registers, validates, and disposes the durable task-sound namespace with its fiber', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    const ns = settingsNamespace(TASK_SOUND_SETTINGS_NAMESPACE)
    expect(ctx.settings.get(ns)).toEqual({ enabled: true, url: '', volume: 0.5 })
    await ctx.settings.update(ns, { enabled: false, url: '/ding.mp3', volume: 0.8 })
    expect(ctx.settings.get(ns)).toEqual({ enabled: false, url: '/ding.mp3', volume: 0.8 })
    await expect(ctx.settings.update(ns, { volume: 2 })).rejects.toThrow()
    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(ns)
  })

  it('is a no-op without the settings service', async () => {
    const ctx = new Context()
    await ctx.plugin({ apply }).await()
    expect(ctx.get('settings')).toBeUndefined()
  })
})

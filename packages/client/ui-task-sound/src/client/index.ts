/**
 * Task-completion chime plugin, browser half. Observes the sessions list for
 * running→idle edges and plays the configured chime; registers the
 * task-sound settings section. No React state outside the settings row, and
 * the audio sink is injected so specs run without a real AudioContext.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { CompletionEdgeTracker } from './completion-edge.ts'
import { playChime, type ChimePlayerSink } from './chime.ts'
import { TaskSoundSection } from './TaskSoundSection.tsx'
import { en, zh, type TaskSoundKey } from './locales.ts'
import { TASK_SOUND_SETTINGS_NAMESPACE, type TaskSoundSettings } from '../task-sound-settings.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Task-sound settings section copy. */
    'settings.taskSound': TaskSoundKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.taskSound'

/** Browser audio sink over the real Web Audio / element APIs. */
const browserSink: ChimePlayerSink = {
  createContext() {
    if (typeof AudioContext === 'undefined') return null
    return new AudioContext()
  },
  createAudio(url) {
    return new Audio(url)
  },
}

/** Task-sound plugin configuration (sink injectable for specs). */
export interface TaskSoundPluginConfig {
  /** Audio sink; defaults to the browser Web Audio / element APIs. */
  sink?: ChimePlayerSink
}

/** Services required by the task-sound plugin. */
export const inject = ['slots', 'locale', 'sessions', 'settingsScope']

/**
 * Register the settings row and the completion-edge listener.
 * @param ctx - client root context.
 * @param config - plugin configuration (sink override for tests).
 */
export function apply(ctx: ClientContext, config: TaskSoundPluginConfig = {}): void {
  const sink = config.sink ?? browserSink
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-task-sound: dictionaries')

  const scope = ctx.settingsScope.bind<TaskSoundSettings>({ namespace: TASK_SOUND_SETTINGS_NAMESPACE })

  ctx.effect(() => {
    const tracker = new CompletionEdgeTracker(() => {
      const value = scope.getSnapshot().value
      void playChime(value ?? { enabled: true, url: '', volume: 0.5 }, sink)
    })
    const observe = (): void => { tracker.observe(ctx.sessions.list.getSnapshot()) }
    const dispose = ctx.sessions.list.subscribe(observe)
    observe()
    return dispose
  }, 'ui-task-sound: completion-edge listener')

  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'task-sound',
    order: 60,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ scope }),
  }, TaskSoundSection))
}

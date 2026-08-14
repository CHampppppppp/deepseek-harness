/**
 * Task-completion chime preferences stored in the Host user-settings document.
 */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the task-sound plugin. */
export const TASK_SOUND_SETTINGS_NAMESPACE = 'ui-task-sound'

/** Default chime URL — absent, the plugin synthesizes a two-tone chime with Web Audio. */
export const DEFAULT_SOUND_URL = ''

/** Durable task-sound section shared by the browser scope. */
export interface TaskSoundSettings {
  /** Master switch: play the chime when a session completes. */
  enabled: boolean
  /** Custom audio URL (empty = the synthesized default chime). */
  url: string
  /** Playback volume, 0..1. */
  volume: number
}

/** Durable task-sound schema; also the wire envelope the browser scope validates against. */
export const TaskSoundSettingsSchema: z<TaskSoundSettings> = z.object({
  enabled: z.boolean().default(true),
  url: z.string().default(DEFAULT_SOUND_URL),
  volume: z.number().min(0).max(1).default(0.5),
})

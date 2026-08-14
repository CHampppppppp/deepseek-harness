/**
 * Task-completion chime plugin, node half. Registers the durable
 * `ui-task-sound` settings namespace so the browser scope can read and write
 * it; the browser half ships via exports["./client"], discovered through the
 * package.json dsh.client declaration.
 */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  TASK_SOUND_SETTINGS_NAMESPACE, TaskSoundSettingsSchema,
} from './task-sound-settings.ts'

export {
  DEFAULT_SOUND_URL, TASK_SOUND_SETTINGS_NAMESPACE, TaskSoundSettingsSchema,
  type TaskSoundSettings,
} from './task-sound-settings.ts'

const TASK_SOUND_NAMESPACE = settingsNamespace(TASK_SOUND_SETTINGS_NAMESPACE)

/**
 * Register the durable task-sound section when the settings service is
 * composed; the browser scope's reads and writes resolve against it.
 * @param ctx - Host context that may acquire the settings service.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(TASK_SOUND_NAMESPACE, TaskSoundSettingsSchema)
  })
}

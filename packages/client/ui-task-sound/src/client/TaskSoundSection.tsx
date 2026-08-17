/**
 * Task-sound settings section: enable switch, custom audio URL, and volume.
 * Writes route through the injected settings scope (Host-persisted); the
 * component stays a pure projection of the scope snapshot plus local draft
 * state while an input is being edited.
 */
import { useEffect, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { TaskSoundSettings } from '../task-sound-settings.ts'
import css from './TaskSoundSection.module.css'

/** Injected business face: the persisted settings scope plus a preview chime (t rides the standard locale seat). */
export interface TaskSoundSectionInjected {
  /** Settings scope bound to the `ui-task-sound` namespace. */
  scope: SettingsScope<TaskSoundSettings>
  /** Plays the chime at the given settings so a volume change can be heard immediately. */
  preview: (settings: TaskSoundSettings) => void
}

/** Full component props: runtime share + locale seat + injected face. */
export type TaskSoundSectionProps =
  PropsLocale<'settings.taskSound'> & TaskSoundSectionInjected

/** Resolved defaults used before the first settings read settles. */
const DEFAULTS: TaskSoundSettings = { enabled: true, url: '', volume: 0.5 }

/**
 * Render the task-sound settings row.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export function TaskSoundSection({ scope, preview, t }: TaskSoundSectionProps) {
  const [snapshot, setSnapshot] = useState(() => scope.getSnapshot())
  useEffect(() => scope.subscribe(() => { setSnapshot(scope.getSnapshot()) }), [scope])
  const settings = snapshot.value ?? DEFAULTS

  return (
    <div className={css.section}>
      <div className={css.heading}>
        <div className={css.title}>{t('title')}</div>
        <div className={css.description}>{t('description')}</div>
      </div>

      <label className={css.field}>
        <span className={css.fieldLabel}>{t('enabled')}</span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => { void scope.set('enabled', event.target.checked) }}
        />
      </label>

      <label className={css.field}>
        <span className={css.fieldLabel}>{t('url')}</span>
        <input
          type="text"
          className={css.textInput}
          placeholder={t('url.placeholder')}
          defaultValue={settings.url}
          onBlur={(event) => { void scope.set('url', event.target.value) }}
        />
      </label>

      <label className={css.field}>
        <span className={css.fieldLabel}>{t('volume')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          onChange={(event) => {
            const volume = Number(event.target.value)
            void scope.set('volume', volume)
            preview({ ...settings, volume })
          }}
        />
        <span className={css.volumeValue}>{Math.round(settings.volume * 100)}%</span>
      </label>
    </div>
  )
}

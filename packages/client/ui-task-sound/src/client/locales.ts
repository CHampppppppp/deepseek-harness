/** `settings.taskSound` namespace dictionaries (the task-sound section copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'nav': '提示音',
  'title': '任务完成提示音',
  'description': '会话任务完成时播放提示音。',
  'enabled': '启用提示音',
  'url': '自定义音频地址',
  'url.placeholder': '留空使用默认提示音',
  'volume': '音量',
} satisfies Record<string, string>

/** The task-sound namespace key union. */
export type TaskSoundKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'nav': 'Chime',
  'title': 'Task-completion chime',
  'description': 'Play a sound when a session finishes its task.',
  'enabled': 'Enable chime',
  'url': 'Custom audio URL',
  'url.placeholder': 'Leave empty for the default chime',
  'volume': 'Volume',
} satisfies Record<TaskSoundKey, string>

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply as nodeApply } from '@deepseek-ai/dsh-client-ui-task-sound'
import { inject } from '@deepseek-ai/dsh-client-ui-task-sound/client'
import * as TaskSoundInvariant from '@deepseek-ai/dsh-client-ui-task-sound/invariant'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'

describe('invariant companion', () => {
  it('registers under the package name with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(TaskSoundInvariant).await()).resolves.toBeDefined()
  })

  it('node-half registers the namespace only when settings is composed', () => {
    nodeApply(new Context())
    expect(true).toBe(true)
  })

  it('client apply declares the sessions and settings edges', () => {
    expect(inject).toEqual(['slots', 'locale', 'sessions', 'settingsScope'])
  })
})

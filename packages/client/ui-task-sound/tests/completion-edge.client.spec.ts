import { describe, expect, it, vi } from 'vitest'
import { CompletionEdgeTracker } from '../src/client/completion-edge.ts'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'

function summary(id: string, running: boolean): SessionSummary {
  return {
    id: id as SessionSummary['id'],
    displayTitle: id,
    running,
    blank: false,
    updatedAt: 0,
  }
}

function list(entries: SessionSummary[]): SessionListState {
  const byId: SessionListState['byId'] = {}
  for (const entry of entries) byId[entry.id] = entry
  return {
    ids: entries.map(entry => entry.id),
    byId,
    current: undefined,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

describe('CompletionEdgeTracker', () => {
  it('fires once per running→idle edge, including for the selected session', () => {
    const onEdge = vi.fn()
    const tracker = new CompletionEdgeTracker(onEdge)
    tracker.observe(list([summary('a', true), summary('b', false)]))
    expect(onEdge).not.toHaveBeenCalled()
    tracker.observe(list([summary('a', false), summary('b', false)]))
    expect(onEdge).toHaveBeenCalledTimes(1)
    expect(onEdge).toHaveBeenCalledWith({ sessionId: 'a' })
    // No second fire while idle.
    tracker.observe(list([summary('a', false)]))
    expect(onEdge).toHaveBeenCalledTimes(1)
  })

  it('does not fire for idle→running or running→running', () => {
    const onEdge = vi.fn()
    const tracker = new CompletionEdgeTracker(onEdge)
    tracker.observe(list([summary('a', false)]))
    tracker.observe(list([summary('a', true)]))
    tracker.observe(list([summary('a', true)]))
    expect(onEdge).not.toHaveBeenCalled()
  })

  it('drops the tracked bit when a session is removed', () => {
    const onEdge = vi.fn()
    const tracker = new CompletionEdgeTracker(onEdge)
    tracker.observe(list([summary('a', true)]))
    tracker.observe(list([]))
    // A removed session cannot fire; a new session with the same id starts fresh.
    tracker.observe(list([summary('a', false)]))
    expect(onEdge).not.toHaveBeenCalled()
    tracker.observe(list([summary('a', true)]))
    tracker.observe(list([summary('a', false)]))
    expect(onEdge).toHaveBeenCalledTimes(1)
  })
})

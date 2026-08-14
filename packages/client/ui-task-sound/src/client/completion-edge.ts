/**
 * Completion-edge tracker: observes session-list snapshots and reports the
 * running→idle edge of every session, selected or not. Pure of audio and of
 * the settings transport — the plugin's apply wires it to the chime sink.
 */

import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'

/** One observed running→idle completion edge. */
export interface CompletionEdge {
  /** The session that finished. */
  sessionId: string
}

/** Listener for one completion edge. */
export type CompletionListener = (edge: CompletionEdge) => void

/**
 * Detect running→idle edges across the session list. The first observation of
 * each session only records its running bit, so sessions already idle at load
 * never fire. A session that stays running fires nothing; a removal drops its
 * tracked bit.
 */
export class CompletionEdgeTracker {
  private readonly prevRunning = new Map<string, boolean>()

  /**
   * @param onEdge - invoked once per running→idle transition.
   */
  constructor(private readonly onEdge: CompletionListener) {}

  /**
   * Fold one list snapshot, firing the listener for every new completion edge.
   * @param snapshot - the latest session-list snapshot.
   */
  observe(snapshot: SessionListState): void {
    for (const summary of Object.values(snapshot.byId)) {
      const prev = this.prevRunning.get(summary.id)
      if (prev === undefined) {
        this.prevRunning.set(summary.id, summary.running)
        continue
      }
      if (prev && !summary.running) this.onEdge({ sessionId: summary.id })
      this.prevRunning.set(summary.id, summary.running)
    }
    for (const id of this.prevRunning.keys()) {
      if (!(id in snapshot.byId)) this.prevRunning.delete(id)
    }
  }
}

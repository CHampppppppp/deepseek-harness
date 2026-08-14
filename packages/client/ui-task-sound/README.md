# @deepseek-ai/dsh-client-ui-task-sound

English | [中文](README.zh.md)

Web task-completion chime: plays a sound when a session finishes its task, with a settings section to enable it, choose a custom audio URL, and set the volume. The node half registers the durable `ui-task-sound` settings namespace; the browser half observes the sessions list and plays through the injected audio sink.

The completion trigger is the running→idle edge of every session, selected or not: `CompletionEdgeTracker` folds each `ctx.sessions.list` snapshot, records each session's first observed running bit, and reports the transition exactly once per session. A session already idle at load never fires, a removal drops its tracked bit, and a new session reusing the id starts fresh. The listener rides the list store's subscription and is disposed with the apply fiber, so HMR removal leaves no edge observer behind.

Playback defaults to a synthesized two-tone chime (E5 then C5, sine oscillators with a soft envelope) generated with Web Audio, so the product ships with no audio asset. A configured URL plays through `new Audio(url)` instead, honoring the same volume. `enabled: false` suppresses both paths. The settings row is a `settings.section` entry: an enable checkbox writes `enabled`, the URL input commits on blur, and the volume range writes a 0..1 number. All writes route through the settings scope to the Host document (`$DSH_HOME/settings.yaml` by default), and the row re-renders from the scope snapshot.

## Model Experience

None, as this package plays audio for a human and touches no prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **The default chime is synthesized, not a shipped asset** — the Web Audio tones play only while the page is focused; background tabs may defer the context. A custom URL plays through an element and is subject to the browser's autoplay policy, so the first completion after a fresh load can be blocked until the user interacts with the page.
- **The chime fires per completion edge, not per user-visible turn** — a session that completes several turns (a multi-step task) plays once when its agent stops running, matching the sidebar's own completion signal rather than counting turns.

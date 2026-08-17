# Agent Note: The task-sound settings section was unexposed, so its writes silently reverted

Status: implemented

English | [中文](2026-08-16-task-sound-not-exposed.zh.md)

## Problem

The web task-completion chime shipped a settings row whose volume slider appeared broken: drag it, and it snapped back to 50% on the next render, with no error anywhere. Neither the enable switch nor the custom URL persisted either - only the volume was conspicuous, because the slider is the one control whose value renders from the scope snapshot on every drag.

The write path was sound end to end. The row writes through the settings scope, `settings.mutate` applies a single-field `set` op by spread-merge, and schemastery defaults fill only absent keys, so nothing along the seam drops a `volume`-only update. The failure sat one hop earlier: `ui-task-sound` was registered as a durable settings namespace by the plugin's node half but never added to the configuration-client allowlist in `dsh-apiproxy`, so `settings.mutate` answered `settings-not-exposed` and `settings.describe` omitted the namespace. The client scope treats a failed write as "re-read and settle": the re-read finds no view, the snapshot goes `unavailable`, and the row falls back to its hardcoded defaults - a silent revert instead of a refusal. Hand-written values in `settings.yaml` never reached the page either, for the same reason.

This is the failure mode the `agent-presets` note on that allowlist already names: a browser surface writing a namespace outside the boundary "moves and then silently forgets, which is worse than refusing the control". The chime shipped with exactly that defect because the exposure decision - which the apiproxy comment states belongs in the allowlist, not in the registering plugin - was never made alongside it.

## Decision

`ui-task-sound` joins `WEB_SETTINGS_NAMESPACES` in `dsh-apiproxy`, so the row's writes persist to the Host settings document and reads resolve. The exposure is the fix; no change was needed in the plugin, the scope, or the settings seam.

Beside it, the volume slider now previews: every change plays the chime at the dragged level, so the user hears what a level means instead of inferring it from a percentage. The preview rides the section's inject face (`preview(settings)`), plays through the same sink and the same `playChime` as the completion signal, and forces `enabled: true` for the preview call only - a user asking "how loud is 30%?" is not arming the completion chime, and a preview that stayed silent behind the master switch could not distinguish 0% from a disabled switch. The persisted `enabled` value is untouched.

## Alternatives considered

- **Reporting the failed write in the UI.** Worth having in general, but it would have dressed up the symptom: the correct state is a persisting write, not a visible refusal of a control the product itself renders.
- **Letting `settings.register()` declare exposure.** The apiproxy comment already defers this: exposure is a configuration-boundary decision owned by the proxy, and moving it per-plugin is a larger change than this fix.
- **Previewing through a `volumechange`-style scope subscription.** The preview must sound on the drag gesture with the dragged value, not when the Host round-trip lands - the scope snapshot may arrive frames later or (as this bug showed) not at all, and a subscription cannot distinguish the user's drag from any other writer. The inject-face callback keeps the gesture, the value, and the sink in one place.
- **Honoring `enabled: false` in the preview.** Rejected above: the preview answers "how loud is this", and silence is ambiguous between "quiet" and "off".

## Consequences

The task-sound row persists and re-renders from the Host document like every other Web preference; dragging the volume sounds the chime at that level each time. A plugin adding a settings section for the Web settings page still needs its namespace added to the apiproxy allowlist in the same change - the failure mode remains silent by design of the scope's recovery path, so the checklist for a new section is: register the namespace, expose it, and cover the round-trip with a test.

The known cost of the preview is repeated playback while dragging through many steps (each `change` fires one); at 220ms of synthesis per step this is the intended "scrubbing" feel, and the custom-URL path is subject to the browser autoplay policy exactly as the completion chime already is.

## Testing

`api-proxy-config.spec.ts` pins the exposure with a `ui-task-sound` `settings.mutate` round-trip that failed `settings-not-exposed` before the allowlist change. The section spec pins the preview callback receiving `{ ...settings, volume }` on a drag, and the apply spec pins the injected `preview` playing through the sink with the master switch off. Package suites pass unchanged otherwise.

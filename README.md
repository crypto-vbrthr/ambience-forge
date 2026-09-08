# Ambience Forge

Ambience Forge is a system-agnostic Foundry VTT module for orchestrating finished audio assets. It deliberately does not edit or process audio beyond volume and time-based fades.

## 0.1.0-alpha.4 foundation

This development slice establishes:

- system-agnostic module manifest for Foundry VTT 14
- English and German localization from the first UI surface onward
- public, versioned module API
- socket command foundation for GM-authoritative synchronized playback
- a direct Web Audio backend which decodes repeating tracks into `AudioBufferSourceNode` loops, avoiding Playlist repeat behavior
- loop, random, sequence, and intensity runtime controllers
- owner/reference tracking for optional integrations
- versioned ambience schema plus import/export helpers
- automated zero-dependency Node tests and CI
- a small GM Scene Control entry with status, quick-stop, and stop-all tools

The full composition editor and scene emitter tooling are intentionally not part of this first slice. The goal is to validate the foundation before building the editor on top of it.

## alpha.3 fixes

- Fix Foundry V14 Scene Control action lookup for the stop buttons: each tool record key now exactly matches its `name` (`stop-active` and `stop-all`). Foundry V14 resolves tools by name, so mismatched record keys caused the core `#onChangeTool` path to receive `undefined` and fail while reading `button`.
- Keep the alpha.2 DialogV2 trusted-content fix and hidden anchor tool.

## alpha.2 fixes

- Fix Foundry V14 DialogV2 status dialog by keeping the trusted outer content div attribute-free.
- Add a hidden non-interactive anchor for the custom control's default active tool.


## Alpha.4

The first usable composition workflow is included: Ambience Manager, create/edit/duplicate/delete compositions, add and edit loop tracks, Foundry audio file picker, local loop preview, playback start/stop, volume and fade settings, and optional loop start/end points.


## alpha.6 fix

- Reworked the Ambience Manager buttons to execute their actions directly from each DialogV2 button callback instead of routing callback results through the dialog-level `submit` handler.
- The selected ambience is now read first from the live DialogV2 form/DOM, with the tracked selection used only as a fallback. This prevents **Edit** from accidentally entering the new-composition path when Foundry does not expose the selection through `button.form` as expected.
- Added regression tests for live-selection precedence and direct manager action callbacks.

## Alpha 10

Adds the first Random track editor with sound lists, random minimum/maximum pauses, immediate-repeat avoidance, optional overlap, and immediate one-shot preview.

## Alpha 11

- Replaces the special "Loop" track concept with a general single-file **Audio track**.
- Audio tracks can play once or enable **Repeat (loop)**; existing legacy `type: "loop"` tracks migrate automatically to repeating audio tracks.
- The audio source field now has an inline folder icon. The Foundry V14 audio FilePicker writes the selected path directly into the visible field instead of closing and reopening the editor.
- Adds `previewAudio()` to the public API while keeping `previewLoop()` as a backwards-compatible alias.
- Schema version increased to 2.

## Alpha 13

- Moves the Random track editor from transient `DialogV2` submit/reopen flows into the same persistent `ApplicationV2` used by the Ambience Manager and Audio track editor.
- Choosing a Random sound now appends it directly to the visible list without rebuilding the editor, preserving name, volume, delay, and checkbox values.
- Random preview and stop-preview no longer close or rerender the editor, so all unsaved field values remain intact.
- Removing a sound updates the visible list in place.
- Adds regression tests for persistent Random editor state, FilePicker behavior, and non-destructive preview.

## Alpha 14

- Adds the persistent Sequence Track editor.
- Sequence tracks can play files in list order or randomized order.
- Configurable minimum/maximum pauses are applied between completed files.
- Randomized sequences can avoid immediate repetition.
- Sequence preview is exposed through the public API.
- Adds an MIT `LICENSE` and project `CHANGELOG.md`.

## Alpha 15 additions

- Composition-level master volume with live runtime control; track volume is multiplied by the master volume.
- Slider-based volume controls for composition and tracks.

## Alpha 16

- Adds the persistent Intensity Track editor.
- Intensity variants are ordered from low to high and crossfade over the configured transition time.
- Intensity preview can be changed live with the slider.
- Running compositions expose temporary live intensity sliders in the Ambience Manager.

## Alpha 17

- Adds a dedicated **Quick Control** window for live GM use.
- Start saved compositions without entering the editor.
- Adjust temporary master volume and Intensity Track values while playback is running.
- Stop individual or all active compositions from the same compact view.

## Alpha 20

- Adds first-stage Scene Emitters. A saved Ambience composition can be placed spatially on the active Scene with a position, hearing radius, maximum volume, and optional distance falloff.
- Emitters are backed by silent native Foundry Ambient Sound placeables, keeping Foundry's familiar map handles available while Ambience Forge performs the actual layered Web Audio playback.
- Spatial playback is evaluated locally for each client using listener token positions.
- Wall and door attenuation/blocking are planned for the next emitter development step.

## Alpha 22

- Adds small GM-only Ambience Forge emitter markers directly on the map, independent of Foundry's Sound layer visibility.
- Clicking a marker opens the Ambience Forge emitter editor for that exact source.
- Hovering a marker exposes quick Edit and Enable/Disable actions.
- Emitters now keep an explicit enabled state. Disabled emitters remain positioned on the Scene and visibly marked, but produce no playback.

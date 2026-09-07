# Ambience Forge

Ambience Forge is a system-agnostic Foundry VTT module for orchestrating finished audio assets. It deliberately does not edit or process audio beyond volume and time-based fades.

## 0.1.0-alpha.4 foundation

This development slice establishes:

- system-agnostic module manifest for Foundry VTT 14
- English and German localization from the first UI surface onward
- public, versioned module API
- socket command foundation for GM-authoritative synchronized playback
- a Foundry audio backend which uses `foundry.audio.Sound` with `forceBuffer: true` for loop tracks, avoiding Playlist repeat behavior
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

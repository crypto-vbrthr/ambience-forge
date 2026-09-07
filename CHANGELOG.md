# Changelog

All notable changes to **Ambience Forge** are documented in this file.

The project is currently in alpha development. Until the first stable release,
internal details may still change, while the public API is kept deliberately
versioned and compatibility-conscious.

## [0.1.0-alpha.16] - 2026-09-07

### Added
- Persistent **Intensity Track** editor.
- Ordered intensity variants from low to high with add/remove/reorder controls.
- Live preview that crossfades when the intensity slider changes.
- Live intensity controls in the Ambience Manager while a composition is playing.
- Public `previewIntensity()` and `setPreviewIntensity()` API methods.
- Runtime state now exposes current live intensity values for intensity tracks.

### Changed
- The Ambience Editor now exposes all four core track types: Audio, Random, Sequence, and Intensity.

## [0.1.0-alpha.15] - 2026-09-07

### Added
- Composition-level master volume with a saved default value.
- Live master-volume control in the Ambience Manager while a composition is playing.
- Public `setMasterVolume()` API method and synchronized socket command.
- `master-volume-v1` API capability.

### Changed
- Track volume is now relative to composition master volume (for example 50% × 50% = 25% effective output).
- Audio, Random, and Sequence volume controls now use sliders with live percentage readouts.
- Data schema increased to version 3.

## [0.1.0-alpha.14] - 2026-09-07

### Added
- Persistent **Sequence Track** editor.
- Sequence sound lists with Foundry audio file picking.
- Sequential or randomized playback order.
- Configurable minimum and maximum pauses between sequence items.
- Optional immediate-repeat avoidance for randomized sequences.
- Sequence preview support through the public API (`previewSequence`).
- `sequence-preview-v1` API capability.
- `LICENSE` file using the MIT License.
- This `CHANGELOG.md`.

### Changed
- Ambience Manager help text now explains Audio, Random, and Sequence tracks.
- Sequence tracks can now be created and edited from the Ambience Editor.

## [0.1.0-alpha.13] - 2026-09-07

### Fixed
- Random Track editing now uses the persistent `ApplicationV2` workflow.
- Choosing or removing Random sound files no longer clears unsaved form fields.
- Random preview no longer rebuilds or clears the editor.

## [0.1.0-alpha.12] - 2026-09-07

### Changed
- Repeating Audio Tracks now use direct Web Audio `AudioBufferSourceNode`
  playback instead of relying on Foundry playlist repeat behavior.
- Decoded audio buffers are cached for reuse.

### Fixed
- Audio preview no longer clears the Audio Track editor.
- Buffered loop playback no longer depends on Foundry selecting its buffered
  `Sound` path.

## [0.1.0-alpha.11] - 2026-09-07

### Added
- General-purpose **Audio Track** with optional Repeat (Loop).
- Inline Foundry audio file picker beside the audio source field.
- Public `previewAudio()` API method.

### Changed
- Legacy `loop` tracks migrate to repeating Audio Tracks.
- Data schema increased to version 2.

## [0.1.0-alpha.10] - 2026-09-07

### Added
- First usable **Random Track** editor.
- Random sound lists.
- Minimum and maximum random pauses.
- Immediate-repeat avoidance.
- Optional sound overlap.
- Random one-shot preview.

## [0.1.0-alpha.9] - 2026-09-07

### Changed
- Ambience Manager and Ambience Editor moved to one persistent `ApplicationV2`
  instance.

### Fixed
- Editing an existing Ambience no longer opens a new Ambience instead.

## [0.1.0-alpha.8] - 2026-09-07

### Changed
- Added explicit manager action diagnostics and cache-busting module filenames
  during investigation of Foundry ESM reload behavior.

## [0.1.0-alpha.7] - 2026-09-07

### Changed
- Manager actions were moved to ordinary content buttons rather than relying on
  `DialogV2` submit routing.

## [0.1.0-alpha.6] - 2026-09-07

### Changed
- Ambience Manager actions execute directly from button callbacks.
- Selection lookup was hardened against differing `DialogV2` form exposure.

## [0.1.0-alpha.5] - 2026-09-07

### Fixed
- Improved tracking of the selected Ambience in the Manager.
- Editing an unknown Ambience ID now fails instead of silently creating one.

## [0.1.0-alpha.4] - 2026-09-07

### Added
- First usable Ambience composition workflow.
- Create, edit, duplicate, and delete Ambiences.
- Initial Loop Track editor and local preview.
- Per-track volume, fade-in, fade-out, and optional loop points.

## [0.1.0-alpha.3] - 2026-09-07

### Fixed
- Foundry V14 Scene Control tool keys now exactly match tool names.

## [0.1.0-alpha.2] - 2026-09-07

### Fixed
- Foundry V14 `DialogV2` trusted-content compatibility for the status dialog.
- Hidden Scene Control anchor prevents Foundry from reading an undefined active
  tool when button-only controls are used.

## [0.1.0-alpha.1] - 2026-09-07

### Added
- Initial system-agnostic Foundry VTT 14 module foundation.
- English and German localization infrastructure.
- Versioned public API and module socket foundation.
- Audio backend abstraction and automated test infrastructure.
- Runtime support for Audio/Loop, Random, Sequence, and Intensity tracks.
- Owner/reference tracking for optional Forge integrations.
- Versioned Ambience data schema and import/export foundation.
- GM Scene Controls with status and stop actions.

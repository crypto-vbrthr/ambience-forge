# Changelog

## 0.2.0-alpha.7

- Quick Control now groups multiple external context values by provider, so one module such as Weather Forge appears once with its weather and wind values listed beneath it.
- Added the Forge Suite `wind` semantic convention with recommended `calm`, `breeze`, `windy`, `strong-wind`, and `gale` state keys.
- Updated integration documentation for providers that publish several independent context groups simultaneously.
- No data-schema or public-API changes.

## 0.2.0-alpha.6

- Fixed Quick Control state rows overflowing into neighboring state groups when an externally controlled state displayed its provider badge and synchronization hint.
- State groups in Quick Control now use a single-column list with a compact two-column internal layout, keeping provider metadata attached to the correct group.
- Added a narrow-window fallback that stacks state controls cleanly instead of allowing labels or selects to overlap.

## 0.2.0-alpha.5

- Quick Control now exposes persistent external context states, including the provider module and the currently supplied semantic group/state values.
- Active state groups show when their value is controlled by an external provider such as Weather Forge.
- External control remains manually overridable; the UI warns that the provider may restore its value on the next synchronization.

## [0.2.0-alpha.4] - 2026-09-08

### Added
- Persistent external semantic context through `setContextState()`, `clearContextState()`, and `getContextStates()`.
- `context-states-v1` capability and public API version 1.3.
- Context synchronization through the Ambience Forge socket so provider state is consistent across clients.
- Compatible ambiences started or introduced after a context update inherit the current provider state automatically.

### Changed
- Forge Suite integration guidance now recommends persistent context for long-lived providers such as Weather Forge and Calendar Forge, while keeping active-only state commands for deliberately scoped events.


## [0.2.0-alpha.3] - 2026-09-08

### Added
- Stable optional API keys for Ambience compositions, completing the semantic `composition / group / state` key hierarchy.
- Public `getStateCatalog()` discovery API and `getAmbiencesByKey()` lookup for integration UIs and user-configurable mappings.
- Public `setStateByKey()` / `clearStateByKey()` methods for composition-key based state control.
- Public `setStateForActiveAmbiences()` / `clearStateForActiveAmbiences()` methods. Compatible globally playing compositions and enabled Scene Emitters on the active Scene can now react to semantic state announcements without the calling module knowing internal Ambience IDs.
- `state-discovery-v1` and `semantic-state-control-v1` capabilities. Public API version increased compatibly from 1.1 to 1.2.
- `FORGE_SUITE_INTEGRATION.md`, a copy-ready Markdown convention document for the central Forge Suite repository.

### Changed
- Data schema increased from 4 to 5. Existing compositions automatically derive a semantic key from their display name.
- The Ambience editor now exposes an optional composition API key with automatic name-derived fallback.
- README and API documentation now describe semantic discovery, recommended Forge Suite keys, owner-aware control, and user-defined mappings.

### Tests
- Added regression coverage for composition-key normalization, state catalog discovery, compatible-state lookup, semantic API surface, active Scene-Emitter targeting, UI key fields, version/schema migration, and integration documentation.

## [0.2.0-alpha.2] - 2026-09-08

### Changed
- State/situation editor track overrides are now a compact three-column matrix (track, activation, volume factor) instead of nested form rows, reducing vertical height and eliminating the horizontal overflow seen with larger compositions.
- The explanation for multiplicative state volume factors is shown once above the track matrix instead of being repeated for every track.
- State-manager window width and responsive layout were adjusted for dense compositions.
- API keys are now explicitly labeled optional in the UI. New groups/states derive a key from their name automatically until the user enters a custom stable key.
- API-key help now explains that keys are intended for integrations/macros and gives examples such as `weather`, `rain`, `storm`, and `night`.

### Tests
- Added UI regression coverage for compact state rows, single multiplication guidance, and automatic optional API keys.

## [0.2.0-alpha.1] - 2026-09-08

### Added
- **Combinable States / Situations** inside an Ambience composition. State groups such as Time of Day, Weather, or Situation each select one state while different groups combine.
- State configuration UI with stable integration keys, per-state transition timing, tri-state track activation (`Unchanged`, `Activate`, `Deactivate`), and per-track volume factors from 0% to 300%.
- Quick Control selectors for changing active states during play.
- Public `setState()` and `clearState()` API methods plus the `states-v1` capability. API version increased compatibly from 1.0 to 1.1.
- State ownership metadata so an integration can avoid clearing a state that has since been replaced by another owner.
- Scene Emitters follow the desired state selections of their referenced composition, including live state changes.

### Changed
- Data schema increased from 3 to 4. Existing 0.1.0 compositions load unchanged with an empty state-group list.
- Ambience runtimes now create controllers for all tracks so a state can activate a track whose base definition is disabled.
- Live track volume remains the user-controlled base value; active state-group volume factors are resolved multiplicatively on top of it.
- State changes use the state-specific, group, or composition transition duration to fade track starts, stops, and volume changes.
- Quick Control lists all composition tracks so state-activated channels remain visible even if their base definition is disabled.

### Tests
- Added regression coverage for state normalization and key uniqueness, combined state resolution, default-state startup, state transitions, owner-safe clearing, socket/API routing, import ID remapping, Scene Emitter state propagation, and state UI contracts.

All notable changes to **Ambience Forge** are documented in this file.

Ambience Forge 0.1.0 is the first stable release. The public API remains deliberately versioned and compatibility-conscious.



## [0.1.0] - 2026-09-08

### Release
- Promoted the manually regression-tested `0.1.0-rc.1` build to the first stable Ambience Forge release.
- Finalized module and package metadata for `0.1.0`.
- Public API remains at version `1.0`; data schema remains at version `3`.
- No functional changes were introduced after the successful release-candidate test.

### Quality
- Final release requires the complete automated validation and regression suite to pass unchanged from the release candidate.

## [0.1.0-rc.1] - 2026-09-08

### Release Candidate
- Froze the 0.1.0 feature set after the alpha.31 architecture and regression review.
- Promoted the stable runtime paths, public API v1.0, schema v3, Scene Emitter workflow, Quick Control, all four track types, and JSON import/export to the first release candidate.
- Added `API.md` as the integration contract for optional consumers such as Weather Forge, Atmosphere Forge, Region Forge, and other Foundry modules.
- Updated README and package metadata for release-candidate status.

### Quality
- Release candidate is based on the manually regression-tested alpha.31 build.
- Full automated validation and test suite must pass before packaging.
- No new features are accepted between rc.1 and 0.1.0; only release-blocking fixes and release hygiene changes are in scope.

## [0.1.0-alpha.31] - 2026-09-08

### Changed
- Consolidated the runtime onto stable module paths (`scripts/main.js` and stable UI/service filenames) and removed obsolete alpha-specific JavaScript forks from the distribution.
- One-shot, Random, and Sequence playback now uses Foundry's `Sound` abstraction so long files can stream instead of always being decoded fully into memory. Seamless repeating ambience continues to use direct buffered Web Audio playback. One-shot `Sound` instances are explicitly non-singleton so intentional overlap remains possible.
- Seamless loop output now routes through Foundry's Environment audio master gain when available, so the normal Foundry Environment volume control also affects Ambience Forge.
- Buffered loops now reuse Foundry's shared audio buffer cache when available and only keep a small in-flight-load map internally.
- Ambience definitions sent with synchronized Play/Request commands are synchronized on receiving clients before playback, preventing stale definitions when a composition has just been edited.
- Scene Emitters now track Ambience definition revisions and restart their local runtime when the referenced composition changes.

### Fixed
- Scene Emitter playback failures now enter a bounded retry backoff instead of retrying a broken audio source on every 200 ms spatial update. A changed Ambience definition bypasses the old backoff and retries immediately.
- Failed intensity crossfades now stop and clean up the newly-created loop source before rethrowing the transition error, preventing silent/partial orphan sources.
- Owner/reference-counted requests no longer stop a composition that was also started explicitly. An explicit Stop remains a force-stop for that ambience and clears outstanding owner claims, keeping runtime and ownership state consistent.
- Finished one-shot handles are removed from long-running Random/Sequence controllers instead of accumulating for the lifetime of a composition.
- Random/Sequence scheduler callback failures are contained and reported instead of becoming unhandled promise rejections; scheduling continues after an individual playback failure.
- World-setting changes now reload the in-memory Ambience library and refresh active playback/Scene Emitters when definitions changed on another client.

### Tests / Maintenance
- Added regression coverage for client library synchronization, embedded socket definitions, Scene Emitter revision refresh, streamed one-shots, Foundry Environment master gain routing, shared buffer caching, ended-handle cleanup, and scheduler error containment.
- Hardened project validation to enforce stable entry points, version parity, JavaScript syntax, relative-import integrity, localization parity, and absence of obsolete alpha runtime files.

## [0.1.0-alpha.30] - 2026-09-08

### Fixed
- JSON export now uses Foundry V14's public `foundry.utils.saveDataToFile()` API instead of a browser `blob:` URL. This prevents the Foundry desktop client / Windows from handing the generated `blob:` link to the operating system as an external protocol.
- Export continues to produce the same portable `.ambience-forge.json` payload; only the download transport changed.

## [0.1.0-alpha.29] - 2026-09-08

### Added
- Ambience Manager actions for exporting a selected composition to a portable JSON file and importing a JSON composition from the local computer.
- Public `exportAmbience()` and `importAmbience()` API methods plus the `import-export-v1` capability.
- Audio-source collection helper for import/export diagnostics and future missing-file checks.

### Changed
- Imported compositions always receive fresh Ambience, Track, and Intensity Variant IDs, preventing cross-world ID collisions and allowing the same composition to be imported multiple times safely.
- Import validation now rejects wrong formats, future schema versions, missing payloads, and malformed compositions before persistence.

## [0.1.0-alpha.28] - 2026-09-08

### Changed
- A normal left click on a Scene Emitter marker no longer opens the editor.
- The main marker is now dedicated to drag-and-drop repositioning; editing remains available through the explicit hover Edit button.
- Updated the marker tooltip to describe drag-to-move only.

## [0.1.0-alpha.27] - 2026-09-08

### Fixed
- Dragging a Scene Emitter now persists its new position immediately without opening the emitter editor afterward.
- Scene Emitter hover actions remain visible while moving the pointer between the main marker, Edit, and Enable/Disable controls.

### Changed
- Scene Emitter drag gestures now use a short post-drag click-suppression window to avoid PIXI `pointertap` firing after `pointerup`.
- The PIXI marker container now owns a stable hover hit area and uses non-bubbling `pointerenter` / `pointerleave` events.

## [0.1.0-alpha.26] - 2026-09-08

### Added
- Scene Emitter wall/door behavior with three focused modes: **Ignore**, **Attenuate**, and **Block**.
- Configurable obstruction attenuation. For example, 70% attenuation leaves 30% of the otherwise calculated spatial volume.
- Open/closed doors and Foundry wall sound restrictions are evaluated through Foundry V14's native `PointSoundSource` geometry rather than custom wall intersection logic.
- Scene Emitters react to wall creation, updates (including door state changes), and deletion.
- `scene-emitter-obstruction-v1` public API capability.

### Changed
- Scene Emitter flag schema increased to version 3. Existing emitters remain compatible and default to **Ignore**.
- Silent AmbientSound proxies enable Foundry wall constraints only when the emitter uses Attenuate or Block mode.

## [0.1.0-alpha.25] - 2026-09-08

- Replaced the HTML/DOM Scene-emitter marker overlay with native PIXI markers attached directly to Foundry VTT's `InterfaceCanvasGroup`.
- Emitter markers now share the exact Scene transform used by Foundry placeables, preventing marker drift while zooming or panning.
- Kept map-based editing, enable/disable controls, and left-drag repositioning.
- Marker visuals use inverse zoom scaling so the controls remain a practical screen size while their position stays anchored to Scene coordinates.

## [0.1.0-alpha.24] - 2026-09-08

### Fixed
- Scene emitter map markers now stay anchored to their Scene coordinates while zooming and panning.
- Replaced the custom PIXI world-transform / DOM-canvas conversion with Foundry V14's public `clientCoordinatesFromCanvas()` and `canvasCoordinatesFromClient()` helpers.
- Dragging emitters now uses the same Foundry coordinate conversion path as marker rendering, preventing zoom-dependent coordinate drift.

## [0.1.0-alpha.23] - 2026-09-08

### Added
- Scene emitter map markers can now be repositioned directly with the left mouse button.
- Dragging provides live marker feedback and persists the new Scene coordinates on release.
- A short movement threshold preserves normal click-to-edit behavior.

### Changed
- The main emitter marker tooltip now explains click-to-edit and drag-to-move behavior.

## [0.1.0-alpha.22] - 2026-09-08

### Added
- GM-only map markers for Ambience Forge scene emitters, visible independently of Foundry's Sound layer.
- Direct map access to the Ambience Forge emitter editor.
- Hover controls on map markers to edit or enable/disable an emitter.
- Persistent enabled/disabled state for scene emitters. Disabled emitters remain placed but produce no playback.
- `setSceneEmitterEnabled()` public API method and `scene-emitter-markers-v1` capability.

### Changed
- Scene emitter flag schema increased to version 2. Existing emitters default to enabled.
- Scene emitter editor now exposes an Enabled checkbox.

## [0.1.0-alpha.21] - 2026-09-08

### Fixed
- Scene Emitters now react immediately to Token creation, movement, deletion, and control changes.
- A freshly placed Token is remembered as the GM listener position even if Foundry does not leave it selected after creation.
- When no Token is selected, GM preview falls back to player-owned Tokens, or to the only visible Token when the Scene contains exactly one.
- Spatial ambience therefore starts correctly when a Token is placed inside an emitter radius.

### Changed
- Scene Emitter help text now explains which Token Ambience Forge uses as the GM listener position.

## [0.1.0-alpha.20] - 2026-09-08

### Added
- First-stage **Scene Emitters** for spatial ambience playback.
- Place any saved Ambience composition at a Scene position with configurable radius, maximum volume, and distance falloff.
- Scene Emitter Manager with create/edit/delete, map focus, position picking, and local preview.
- Scene emitters use Foundry Ambient Sound documents as silent native position/radius proxies, so they can also be moved with Foundry's Sound layer.
- Client-local spatial playback follows controlled/owned token listener positions and continuously adjusts composition master volume by distance.
- Public API methods for listing, creating, updating, deleting, and previewing Scene Emitters.
- `scene-emitters-v1` API capability.
- Automated tests for radius conversion, attenuation, runtime start/stop, and emitter UI/API contracts.

### Notes
- This first emitter slice implements position, radius, distance falloff, movement, and preview. Wall/door attenuation and blocking are intentionally deferred to the next emitter step.

## [0.1.0-alpha.19] - 2026-09-07

### Changed
- Quick Control now displays the temporary-playback notice only once at the top of the window.
- Removed repeated per-composition and per-track live-volume hints to preserve vertical space.
- Tightened Quick Control spacing for large compositions with many tracks.

## [0.1.0-alpha.18] - 2026-09-07

### Added
- Per-track live volume sliders in **Quick Control** for every enabled track of a running composition.
- Per-track live start/stop toggle in Quick Control.
- Runtime state now exposes live track volumes and active/stopped track states.
- Public `setTrackActive()` API method and synchronized socket command.
- `track-live-control-v1` API capability.

### Changed
- Quick Control now shows each track as an individual live channel with its own controls.
- Live track-volume changes remain temporary and do not modify the saved composition.

## [0.1.0-alpha.17] - 2026-09-07

### Added
- Dedicated **Quick Control** ApplicationV2 for live session control.
- Scene Control button for opening Quick Control directly from the canvas toolbar.
- Quick start of any saved composition without entering the editor.
- Per-running-composition live master-volume sliders.
- Live intensity sliders for every active Intensity Track.
- Individual stop controls and a stop-active action.
- Compact display of the enabled tracks in each running composition.

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

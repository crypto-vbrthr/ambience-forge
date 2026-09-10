# Ambience Forge Public API

Ambience Forge exposes a versioned public API for optional integration by other Foundry VTT modules. Consumers should use this API rather than importing Ambience Forge internals.

## Access

```js
const api = game.modules.get("ambience-forge")?.api;
if (!api?.isReady()) return;
```

Ambience Forge also fires:

```js
Hooks.once("ambienceForgeReady", (api) => {
  // Integration may initialize here.
});
```

The module is intentionally optional infrastructure. Consumers should continue to function when Ambience Forge is absent or inactive.

## Versioning and capabilities

For Ambience Forge 0.3.0-alpha.3:

```js
api.version; // "1.5"
api.getModuleVersion(); // "0.3.0-alpha.3"
api.capabilities; // frozen array of supported capability strings
```

Prefer capability detection over private implementation checks:

```js
if (api.capabilities.includes("scene-emitter-obstruction-v1")) {
  // Safe to use the documented obstruction-aware emitter API.
}
```

Current capabilities:

- `ambience-v1`
- `tracks-v1`
- `owner-requests-v1`
- `intensity-v1`
- `synchronized-playback-v1`
- `audio-preview-v1`
- `loop-preview-v1`
- `random-preview-v1`
- `sequence-preview-v1`
- `intensity-preview-v1`
- `master-volume-v1`
- `track-live-control-v1`
- `track-runtime-status-v1`
- `scene-emitters-v1`
- `scene-emitter-markers-v1`
- `scene-emitter-obstruction-v1`
- `scene-emitter-keys-v1`
- `scene-emitter-live-control-v1`
- `import-export-v1`
- `states-v1`
- `state-discovery-v1`
- `semantic-state-control-v1`
- `context-states-v1`

## Ambience library

```js
api.getAmbiences();
api.getAmbience(id);
api.getAmbiencesByKey("forest");
api.getStateCatalog();
api.getState();

await api.upsertAmbience(ambience);
await api.deleteAmbience(id);
```

`upsertAmbience()` and `deleteAmbience()` persist world-level Ambience definitions. Integrations should avoid editing private world settings directly.

## Playback

```js
await api.playAmbience(ambienceId);
await api.stopAmbience(ambienceId);
await api.stopAll();
```

Playback commands synchronize through Ambience Forge's module socket by default. Methods that accept an options object support the public options exposed by the method signature, including `broadcast` where applicable.

### Optional-owner requests

For modules that want an Ambience only while some external condition is true, use reference-counted owner requests instead of force-playing and force-stopping it:

```js
await api.requestAmbience("rain", { owner: "weather-forge" });
// Later:
await api.releaseAmbience("rain", { owner: "weather-forge" });
```

Multiple owners may request the same Ambience. Releasing one owner does not stop playback while another owner still requires it. A manually started Ambience is not stopped merely because an optional owner releases its claim.

Owner strings should be stable module identifiers.

## Live controls

These operations change current playback only. They do not rewrite the saved composition.

```js
await api.setMasterVolume(ambienceId, 0.5);
await api.setTrackVolume(ambienceId, trackId, 0.5);
await api.setTrackActive(ambienceId, trackId, false);
await api.setTrackIntensity(ambienceId, trackId, 0.75);
```

Master and track volumes use normalized values from `0` to `1`. Effective track output is multiplicative. For example, master `0.5` and track volume `0.5` produce an effective track level of `0.25` before spatial attenuation and Foundry's Environment master volume are considered.

`setMasterVolume()` and `setTrackVolume()` optionally accept a transition duration:

```js
await api.setMasterVolume(ambienceId, 0.25, { durationMs: 1000 });
await api.setTrackVolume(ambienceId, trackId, 0.4, { durationMs: 500 });
```


## Combinable states / situations

Compositions can define state groups such as `time-of-day`, `weather`, or `situation`. Exactly one state per group may be selected at a time, while different groups combine. State and group keys are stable technical identifiers independent of their localized display names.

```js
await api.setState(ambienceId, "weather", "storm", {
  owner: "weather-forge"
});

await api.setState(ambienceId, "time-of-day", "night", {
  owner: "calendar-forge"
});

// Explicitly select no state in a group.
await api.clearState(ambienceId, "weather", {
  owner: "weather-forge"
});
```

State changes are synchronized by default and may be prepared even while a composition is not currently playing. The desired selection is used on its next start and is also applied to Scene Emitters referencing that composition.

Each state may:

- leave a track's activation unchanged, force it on, or force it off;
- apply a volume factor from 0% to 300%.

Volume factors from simultaneously active state groups multiply. For example, a base track volume of `0.6`, a Night factor of `0.5`, and a Rain factor of `0.8` resolve to `0.24` before composition master volume and spatial attenuation. Live per-track volume from Quick Control remains the base for these factors.

`getState()` exposes active state selections under `ambienceStates` using group/state keys and the most recent state owner under `ambienceStateOwners`. `setState()` and `clearState()` accept optional `durationMs` and `broadcast` options in addition to `owner`.

### Semantic discovery and key-based control

Compositions also have a stable semantic `key`, just like state groups and states. The editor can derive it automatically from the composition name or the user can supply a stable integration key such as `forest`, `tavern`, or `dungeon`.

Discover available mappings without reading private data:

```js
const catalog = api.getStateCatalog();
// { compositions: [{ id, key, name, groups: [{ id, key, name, states: [...] }] }] }

const forests = api.getAmbiencesByKey("forest");
```

Target a semantic composition key rather than a world-specific ID:

```js
await api.setStateByKey({
  ambience: "forest",
  group: "weather",
  state: "storm",
  owner: "weather-forge"
});

await api.clearStateByKey({
  ambience: "forest",
  group: "weather",
  owner: "weather-forge"
});
```

Apply a state to every currently relevant compatible composition:

```js
await api.setStateForActiveAmbiences({
  group: "weather",
  state: "storm",
  owner: "weather-forge"
});
```

For this method, "active" includes globally playing Ambiences and compositions referenced by enabled Scene Emitters on the current Scene. Compositions without the requested group/state are ignored. This lets Weather Forge announce `weather = storm` without knowing how each active composition implements storm audio.

Clear only state selections still owned by the caller:

```js
await api.clearStateForActiveAmbiences({
  group: "weather",
  owner: "weather-forge"
});
```

All semantic setters return the list of targeted Ambience IDs. They synchronize by default and accept the same `owner`, `durationMs`, and `broadcast` options as the lower-level state methods.

### Persistent external context

Environmental providers such as Weather Forge should usually use a persistent context state rather than targeting only compositions that are active at the moment of the update.

```js
await api.setContextState({
  group: "weather",
  state: "rain",
  owner: "pf2e-weather-forge"
});
```

Ambience Forge remembers the semantic context for the current session, applies it immediately to all compatible compositions, and also applies it when a compatible composition is started or introduced later. This solves the common case where the weather changes before a forest, tavern, or other ambience is started.

```js
api.getContextStates();
// { weather: { state: "rain", owner: "pf2e-weather-forge" } }

await api.clearContextState({
  group: "weather",
  owner: "pf2e-weather-forge"
});
```

Context ownership protects cleanup from unrelated callers. A clear request with a different owner is ignored. Per-composition manual changes remain possible and can temporarily override the current context until the provider publishes a new context state. Context is runtime/session state rather than exported composition data; provider modules should re-publish their current state after `ambienceForgeReady` or Foundry `ready`.

See [`FORGE_SUITE_INTEGRATION.md`](FORGE_SUITE_INTEGRATION.md) for the recommended Forge Suite key conventions and responsibility boundaries.


## Track runtime status

API 1.5 exposes read-only runtime observability for active tracks. This is local playback state and does not trigger socket traffic or persist anything to the world.

```js
const status = api.getTrackRuntimeStatus(ambienceId, trackId);
const ambienceStatus = api.getRuntimeStatus(ambienceId);
const allRuntime = api.getRuntimeStatus();
```

`getTrackRuntimeStatus()` returns `null` when the ambience or track has no active runtime. `getRuntimeStatus(ambienceId)` returns the active composition runtime or `null`; calling it without an ID returns all currently active composition runtimes. `getState()` also includes the same per-track snapshots under `trackRuntimeStatuses` for consumers that already use the general state snapshot.

Every track status includes the common fields:

```js
{
  trackId,
  type,
  active,
  phase,          // "stopped" | "idle" | "waiting" | "playing" | "crossfading" | "finished"
  source,
  startedAtMs,
  endsAtMs,
  durationMs,
  elapsedMs,
  remainingMs,
  progress,       // normalized 0..1 when a finite phase/cycle is known
  activeSounds
}
```

The values are intended for status displays and diagnostics. They are snapshots: consumers should query again when they need refreshed countdown/progress values. No polling faster than the UI actually needs is recommended.

Quick Control uses these snapshots directly and refreshes only the visible runtime indicators at a 500 ms interval. It does not re-render the whole window, persist data, or send socket messages for countdown/progress updates.

Track-specific additions include:

- **Audio:** `loop` and loop-cycle timing for repeating audio. A completed non-repeating Audio track reports `phase: "finished"`.
- **Random:** `activeSoundCount`, `activeSounds`, `nextEventAtMs`, and `nextEventInMs`. With overlap enabled, several active sounds may be reported while the next event is already counting down.
- **Sequence:** `sequenceIndex`, one-based `sequencePosition`, `sequenceLength`, plus the next scheduled event timing.
- **Intensity:** `intensity`, `variantIndex`, one-based `variantPosition`, `variantCount`, `variantName`, and a `transition` object while a variant crossfade is in progress.

This status API intentionally contains no controller handles, Web Audio nodes, Foundry `Sound` objects, or other private runtime objects. Integrations should check the `track-runtime-status-v1` capability before depending on it.

## Preview API

Preview methods are intended for local editing and tooling rather than synchronized session playback:

```js
await api.previewAudio(track);
await api.previewLoop(track); // compatibility alias for loop-oriented tooling
await api.previewRandom(track);
await api.previewSequence(track);
await api.previewIntensity(track);
await api.setPreviewIntensity(0.75);
await api.stopPreview();
```

## Import and export

```js
const envelope = api.exportAmbience(ambienceId);
const imported = await api.importAmbience(envelope);
```

Exports contain configuration and audio paths, not audio bytes. Imports validate the Ambience Forge envelope and create fresh IDs for the imported Ambience, tracks, and intensity variants.

## Scene Emitters

Scene Emitters place a saved Ambience spatially on a Foundry Scene.

```js
api.getSceneEmitters();
api.getSceneEmitter(id);
api.getSceneEmittersByKey("waterfall");

await api.createSceneEmitter(data);
await api.updateSceneEmitter(id, data);
await api.setSceneEmitterEnabled(id, true);
await api.deleteSceneEmitter(id);

await api.previewSceneEmitter(id);
await api.stopSceneEmitterPreview();
```

Emitter data supports position, radius, maximum volume, distance falloff, enabled state, semantic `key`, and the documented obstruction modes used by the current schema: ignore, attenuate, and block. Consumers should obtain an existing emitter through `getSceneEmitter()` before updating it rather than depending on private flag storage.

### Semantic emitter keys

Scene Emitters expose a stable technical `key` independent of their display name and Foundry document ID. New keys can be entered in the emitter editor and are normalized to the same lowercase hyphenated format used elsewhere in Ambience Forge. Existing emitters without a persisted key derive one from their emitter name (or referenced ambience) until next saved.

```js
const matches = api.getSceneEmittersByKey("waterfall");
```

Multiple emitters may intentionally share a key. Key-based live-control methods therefore target **all matching emitters on the active Scene**, which makes semantic group control possible without storing Foundry document IDs.

### Temporary Scene Emitter live control

The 0.3.0 line separates saved emitter configuration from temporary runtime control. These methods do **not** update the Foundry `AmbientSound` proxy or its flags:

```js
api.getSceneEmitterLiveState(id);
api.getSceneEmitterLiveStates();

await api.setSceneEmitterVolume(id, 0.35);
await api.setSceneEmitterActive(id, false);
await api.resetSceneEmitterLiveState(id);
```

`setSceneEmitterVolume()` temporarily replaces the emitter's saved maximum volume with a normalized `0..1` runtime value. `setSceneEmitterActive()` temporarily overrides the saved enabled state. `resetSceneEmitterLiveState()` clears both temporary overrides and immediately returns to the saved emitter values. Calls synchronize to connected clients by default; pass `{ broadcast: false }` for deliberate local-only tooling.

The state query makes the distinction explicit:

```js
api.getSceneEmitterLiveState(id);
// {
//   id, key,
//   active, volume,
//   activeOverride, volumeOverride,
//   baseEnabled, baseVolume
// }
```

Key-based variants apply the same operation to every matching emitter:

```js
await api.setSceneEmitterVolumeByKey("waterfall", 0.25);
await api.setSceneEmitterActiveByKey("machinery", false);
await api.resetSceneEmitterLiveStateByKey("waterfall");
```

Persistent configuration still uses `updateSceneEmitter()` or `setSceneEmitterEnabled()`. The current 0.3.0 alpha line still reserves owner arbitration and timed emitter fades for a later step.

## Integration guidance

A typical optional integration should:

1. Detect whether `game.modules.get("ambience-forge")?.active` is true.
2. Wait for `ambienceForgeReady` or verify `api.isReady()`.
3. Check the required capability string.
4. Use `requestAmbience()` / `releaseAmbience()` for condition-driven ownership.
5. Never import files from `ambience-forge/scripts/...` or manipulate its private settings/flags directly.
6. Degrade gracefully when Ambience Forge is not installed or not active.

Example:

```js
Hooks.once("ambienceForgeReady", async (api) => {
  if (!api.capabilities.includes("owner-requests-v1")) return;

  await api.requestAmbience("storm", {
    owner: "my-weather-module"
  });
});
```

## Compatibility promise for API v1.x

The 1.x public API is treated as an integration contract. API 1.5 extends 1.4 with read-only track runtime status and does not remove the earlier 1.0–1.4 methods. If a future release requires an incompatible public API change, it should expose a new API version or capability rather than silently changing existing documented methods.


## Multiple context groups from one provider

A provider may own several independent context groups at the same time. For example, Weather Forge can publish `weather = rain` and `wind = strong-wind` using the same owner id. Ambience Forge stores ownership per group, so each context remains independently replaceable and clearable.

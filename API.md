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

For Ambience Forge 0.2.0-alpha.2:

```js
api.version; // "1.1"
api.getModuleVersion(); // "0.2.0-alpha.2"
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
- `scene-emitters-v1`
- `scene-emitter-markers-v1`
- `scene-emitter-obstruction-v1`
- `import-export-v1`
- `states-v1`

## Ambience library

```js
api.getAmbiences();
api.getAmbience(id);
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

await api.createSceneEmitter(data);
await api.updateSceneEmitter(id, data);
await api.setSceneEmitterEnabled(id, true);
await api.deleteSceneEmitter(id);

await api.previewSceneEmitter(id);
await api.stopSceneEmitterPreview();
```

Emitter data supports position, radius, maximum volume, distance falloff, enabled state, and the documented obstruction modes used by the current schema: ignore, attenuate, and block. Consumers should obtain an existing emitter through `getSceneEmitter()` before updating it rather than depending on private flag storage.

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

During the 0.1.0 release-candidate cycle, the module feature set is frozen. The 1.x public API is treated as an integration contract. API 1.1 extends 1.0 with the optional `states-v1` capability and does not remove the 1.0 methods. If a future release requires an incompatible public API change, it should expose a new API version or capability rather than silently changing existing documented methods.

# Ambience Forge

Ambience Forge is a system-agnostic Foundry VTT module for orchestrating finished audio assets. It controls **what plays, when it plays, how loudly it plays, and which layers run in parallel**. It intentionally does not edit audio or apply EQ, reverb, filters, pitch changes, or other sound processing.


## Part of the Forge Suite

**Ambience Forge** is part of the **Forge Suite**, a growing collection of Foundry VTT modules and add-ons built for the busy Game Master. The suite is designed to reduce preparation and bookkeeping, make common GM tasks easier, and add useful tools that help make running and playing campaigns smoother and more enjoyable.

An overview of the Forge Suite, its modules, add-ons, and shared documentation is available here:

**Forge Suite:** https://github.com/crypto-vbrthr/pf2e-forge-suite


## Feedback, Bug Reports & Feature Requests

Found a bug, have an idea for an improvement, or would like to suggest a new feature?

Feedback is always welcome. Please feel free to open a new **GitHub Issue** at any time, whether you want to report a problem, suggest a quality-of-life improvement, propose a new feature, or share an idea for how the module could be made more useful.

When reporting a bug, please include as much relevant information as possible, such as the Foundry VTT version, PF2e system version, module version, steps to reproduce the issue, and any console errors or screenshots that may help identify the problem.

Suggestions and feature requests are equally welcome. Even small ideas can lead to useful improvements.

**Open an issue here:** https://github.com/crypto-vbrthr/ambience-forge/issues


## 0.3.0-rc.1 feature set

- Layered Ambience compositions with saved master volume.
- **Audio Tracks** for one-shot playback or seamless buffered Web Audio looping. Long one-shots use Foundry's streaming-capable `Sound` path; repeating ambience uses direct buffered Web Audio.
- **Random Tracks** with sound lists, randomized minimum/maximum pauses, repeat avoidance, and optional overlap.
- **Sequence Tracks** with sequential or randomized order and configurable pauses.
- **Intensity Tracks** with ordered variants and crossfades between intensity levels.
- Persistent `ApplicationV2` editors with inline Foundry audio file pickers and non-destructive preview.
- **Quick Control** for temporary live master volume, per-track volume, track start/stop, intensity changes, live state/situation switching, and per-track runtime feedback with countdowns and progress bars. Long Quick Control contents scroll vertically within the viewport. Ambience Forge also respects Foundry's Environment master-volume control.
- **Combinable States / Situations** inside a composition. Organize one-of-many groups such as `time-of-day`, `weather`, or `situation`; each state can activate/deactivate tracks and multiply their volume, while different groups combine.
- **Persistent external context states** for provider modules. Weather, calendar, encounter, or atmosphere integrations can publish a semantic state once and Ambience Forge applies it to compatible ambiences now and when they start later.
- **Scene Emitters** with position, radius, distance falloff, canvas markers, drag-and-drop movement, enable/disable, and Foundry-aware wall/door handling (`Ignore`, `Attenuate`, `Block`).
- **Semantic Scene Emitter keys** plus synchronized temporary live activation and maximum-volume overrides, controllable by emitter ID or key without rewriting the saved emitter configuration. Live overrides support provider ownership and timed fades.
- **Track runtime status** for integrations and Quick Control: playing/waiting/crossfading state, current source, timing/progress, Random overlap, Sequence position, loop-cycle progress, and Intensity variant transitions.
- Composition **JSON import/export** for reuse across Foundry worlds. Audio files are referenced by path and are not embedded in exports.
- English and German localization.
- Automated Node test suite and validation checks.
- MIT License, maintained `CHANGELOG.md`, and a documented versioned public API.

Ambience Forge 0.3.0-rc.1 is the feature-frozen release candidate for the 0.3.0 line. It includes the completed external Scene Emitter control block from alpha.4 and adds release-hardening around runtime lifecycle races, Scene Emitter tick serialization, and owner-safe state/context cleanup. Temporary emitter volume and active overrides retain independent owners and timed fades, while Quick Control remains viewport-bounded and preserves its scroll position during normal internal re-renders.

## Audio philosophy

Prepare sound files externally with the editor or audio tool of your choice. Ambience Forge only handles playback orchestration, volume, fades, and crossfades. For seamless ambience beds, prepared OGG loops are recommended.

## Public API

The public API is versioned independently from the module release. Ambience Forge 0.3.0-rc.1 exposes API version `1.6`. See [`API.md`](API.md) for the complete integration contract.


Other modules may access the versioned API through:

```js
const ambienceForge = game.modules.get("ambience-forge")?.api;
```

Important API areas include:

```js
ambienceForge.getAmbiences();
ambienceForge.getAmbience(id);
ambienceForge.getAmbiencesByKey("forest");
ambienceForge.getStateCatalog();
ambienceForge.playAmbience(id);
ambienceForge.stopAmbience(id);
ambienceForge.requestAmbience(id, { owner: "another-module" });
ambienceForge.releaseAmbience(id, { owner: "another-module" });

ambienceForge.setMasterVolume(id, 0.5);
ambienceForge.setTrackVolume(id, trackId, 0.5);
ambienceForge.setTrackActive(id, trackId, false);
ambienceForge.setTrackIntensity(id, trackId, 0.75);

const trackStatus = ambienceForge.getTrackRuntimeStatus(id, trackId);
const ambienceRuntime = ambienceForge.getRuntimeStatus(id);

ambienceForge.setState(id, "weather", "storm", { owner: "weather-forge" });
ambienceForge.setState(id, "time-of-day", "night", { owner: "calendar-forge" });

await ambienceForge.setStateByKey({
  ambience: "forest",
  group: "weather",
  state: "storm",
  owner: "weather-forge"
});

await ambienceForge.setStateForActiveAmbiences({
  group: "time-of-day",
  state: "night",
  owner: "calendar-forge"
});

const waterfalls = ambienceForge.getSceneEmittersByKey("waterfall");
await ambienceForge.setSceneEmitterVolumeByKey("waterfall", 0.35, { owner: "weather-forge", durationMs: 1200 });
await ambienceForge.setSceneEmitterActiveByKey("waterfall", false, { owner: "weather-forge", durationMs: 1200 });
await ambienceForge.resetSceneEmitterLiveStateByKey("waterfall", { owner: "weather-forge", durationMs: 800 });

const exported = ambienceForge.exportAmbience(id);
const imported = await ambienceForge.importAmbience(exported);
```

Scene-emitter methods are also available through the same API. Scene Emitters expose a stable `key` for optional integrations. `setSceneEmitterVolume()` and `setSceneEmitterActive()` are temporary live controls with optional provider ownership and timed fades; persistent emitter configuration remains the responsibility of `updateSceneEmitter()` and `setSceneEmitterEnabled()`. Owner-scoped resets release only values still owned by that provider, while ownerless calls remain deliberate manual/global overrides. Key-based variants affect every matching emitter on the active Scene, which is useful for semantic groups such as several emitters sharing `torch`, `waterfall`, or `machinery`. Consumers should check `api.capabilities` rather than depending on private implementation details.

Ambience Forge fires `ambienceForgeReady` when its public API is ready for integrations.

## Semantic integration keys

Compositions, state groups, and states may expose stable technical keys. Display names can be localized or renamed without breaking integrations. A typical Forge Suite mapping is:

```text
Composition: Silberwald  -> forest
Group: Wetter            -> weather
State: Gewitter          -> storm
```

Recommended Forge Suite conventions include `weather`, `time-of-day`, and `situation` groups with short state keys such as `rain`, `storm`, `night`, `calm`, or `combat`. These are conventions rather than requirements; integrations should prefer `getStateCatalog()` and user-configurable mappings over hard-coded assumptions.

`setStateForActiveAmbiences()` applies a semantic state to compatible compositions that are currently playing or referenced by enabled Scene Emitters on the active Scene. Compositions that do not expose the requested group/state are ignored.

A standalone Markdown copy of the Forge Suite integration convention is included as [`FORGE_SUITE_INTEGRATION.md`](FORGE_SUITE_INTEGRATION.md) for use in the central Forge Suite repository.

## Optional integration model

Ambience Forge is designed to be optional infrastructure for modules such as Weather Forge, Atmosphere Forge, Region Forge, and other Foundry modules. Integrations should detect Ambience Forge at runtime and continue to function normally when it is absent.


### Multi-provider / multi-context display

Quick Control groups external context by provider. A provider may supply several independent semantic groups at once, such as Weather Forge publishing `weather = rain` and `wind = strong-wind`. The recommended Forge Suite wind keys are `calm`, `breeze`, `windy`, `strong-wind`, and `gale`.

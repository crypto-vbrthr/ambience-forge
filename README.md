# Ambience Forge

Ambience Forge is a system-agnostic Foundry VTT module for orchestrating finished audio assets. It controls **what plays, when it plays, how loudly it plays, and which layers run in parallel**. It intentionally does not edit audio or apply EQ, reverb, filters, pitch changes, or other sound processing.

## 0.2.0-alpha.2 feature set

- Layered Ambience compositions with saved master volume.
- **Audio Tracks** for one-shot playback or seamless buffered Web Audio looping. Long one-shots use Foundry's streaming-capable `Sound` path; repeating ambience uses direct buffered Web Audio.
- **Random Tracks** with sound lists, randomized minimum/maximum pauses, repeat avoidance, and optional overlap.
- **Sequence Tracks** with sequential or randomized order and configurable pauses.
- **Intensity Tracks** with ordered variants and crossfades between intensity levels.
- Persistent `ApplicationV2` editors with inline Foundry audio file pickers and non-destructive preview.
- **Quick Control** for temporary live master volume, per-track volume, track start/stop, intensity changes, and live state/situation switching. Ambience Forge also respects Foundry's Environment master-volume control.
- **Combinable States / Situations** inside a composition. Organize one-of-many groups such as `time-of-day`, `weather`, or `situation`; each state can activate/deactivate tracks and multiply their volume, while different groups combine.
- **Scene Emitters** with position, radius, distance falloff, canvas markers, drag-and-drop movement, enable/disable, and Foundry-aware wall/door handling (`Ignore`, `Attenuate`, `Block`).
- Composition **JSON import/export** for reuse across Foundry worlds. Audio files are referenced by path and are not embedded in exports.
- English and German localization.
- Automated Node test suite and validation checks.
- MIT License, maintained `CHANGELOG.md`, and a documented versioned public API.

Ambience Forge 0.2.0-alpha.2 begins the next development line on top of the stable 0.1.0 foundation. The new state system is intentionally integration-first so modules such as Weather Forge or Calendar Forge can control the same composition without duplicating audio setups.

## Audio philosophy

Prepare sound files externally with the editor or audio tool of your choice. Ambience Forge only handles playback orchestration, volume, fades, and crossfades. For seamless ambience beds, prepared OGG loops are recommended.

## Public API

The public API is versioned independently from the module release. Ambience Forge 0.2.0-alpha.2 exposes API version `1.1`. See [`API.md`](API.md) for the complete integration contract.


Other modules may access the versioned API through:

```js
const ambienceForge = game.modules.get("ambience-forge")?.api;
```

Important API areas include:

```js
ambienceForge.getAmbiences();
ambienceForge.getAmbience(id);
ambienceForge.playAmbience(id);
ambienceForge.stopAmbience(id);
ambienceForge.requestAmbience(id, { owner: "another-module" });
ambienceForge.releaseAmbience(id, { owner: "another-module" });

ambienceForge.setMasterVolume(id, 0.5);
ambienceForge.setTrackVolume(id, trackId, 0.5);
ambienceForge.setTrackActive(id, trackId, false);
ambienceForge.setTrackIntensity(id, trackId, 0.75);

ambienceForge.setState(id, "weather", "storm", { owner: "weather-forge" });
ambienceForge.setState(id, "time-of-day", "night", { owner: "calendar-forge" });

const exported = ambienceForge.exportAmbience(id);
const imported = await ambienceForge.importAmbience(exported);
```

Scene-emitter methods are also available through the same API. Consumers should check `api.capabilities` rather than depending on private implementation details.

Ambience Forge fires `ambienceForgeReady` when its public API is ready for integrations.

## Optional integration model

Ambience Forge is designed to be optional infrastructure for modules such as Weather Forge, Atmosphere Forge, Region Forge, and other Foundry modules. Integrations should detect Ambience Forge at runtime and continue to function normally when it is absent.

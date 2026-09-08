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


## 0.1.0 feature set

- Layered Ambience compositions with saved master volume.
- **Audio Tracks** for one-shot playback or seamless buffered Web Audio looping. Long one-shots use Foundry's streaming-capable `Sound` path; repeating ambience uses direct buffered Web Audio.
- **Random Tracks** with sound lists, randomized minimum/maximum pauses, repeat avoidance, and optional overlap.
- **Sequence Tracks** with sequential or randomized order and configurable pauses.
- **Intensity Tracks** with ordered variants and crossfades between intensity levels.
- Persistent `ApplicationV2` editors with inline Foundry audio file pickers and non-destructive preview.
- **Quick Control** for temporary live master volume, per-track volume, track start/stop, and intensity changes. Ambience Forge also respects Foundry's Environment master-volume control.
- **Scene Emitters** with position, radius, distance falloff, canvas markers, drag-and-drop movement, enable/disable, and Foundry-aware wall/door handling (`Ignore`, `Attenuate`, `Block`).
- Composition **JSON import/export** for reuse across Foundry worlds. Audio files are referenced by path and are not embedded in exports.
- English and German localization.
- Automated Node test suite and validation checks.
- MIT License, maintained `CHANGELOG.md`, and a documented versioned public API.

Ambience Forge 0.1.0 is the first stable feature release. Future development should preserve the documented public API and schema compatibility wherever practical.

## Audio philosophy

Prepare sound files externally with the editor or audio tool of your choice. Ambience Forge only handles playback orchestration, volume, fades, and crossfades. For seamless ambience beds, prepared OGG loops are recommended.

## Public API

The public API is versioned independently from the module release. Ambience Forge 0.1.0 exposes API version `1.0`. See [`API.md`](API.md) for the complete integration contract.


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

const exported = ambienceForge.exportAmbience(id);
const imported = await ambienceForge.importAmbience(exported);
```

Scene-emitter methods are also available through the same API. Consumers should check `api.capabilities` rather than depending on private implementation details.

Ambience Forge fires `ambienceForgeReady` when its public API is ready for integrations.

## Optional integration model

Ambience Forge is designed to be optional infrastructure for modules such as Weather Forge, Atmosphere Forge, Region Forge, and other Foundry modules. Integrations should detect Ambience Forge at runtime and continue to function normally when it is absent.

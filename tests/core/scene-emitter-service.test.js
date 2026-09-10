import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAmbience } from "../../scripts/data/schema.js";
import { SceneEmitterService } from "../../scripts/scene/scene-emitter-service.js";
import { FakeAudioBackend } from "../helpers/fake-audio-backend.js";

function emitterDocument() {
  return {
    id: "e1",
    x: 0,
    y: 0,
    radius: 10,
    volume: 0.5,
    easing: true,
    flags: {
      "ambience-forge": {
        emitter: { ambienceId: "forest", name: "Forest source" }
      }
    },
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
  };
}

test("scene emitter runtime starts inside radius, follows distance volume and stops outside", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    id: "forest",
    name: "Forest",
    masterVolume: 0.8,
    tracks: [{ id: "bed", name: "Bed", type: "audio", source: "forest.ogg", repeat: true, volume: 0.5, fadeOutMs: 0 }]
  });
  const ambienceService = { getAmbience: (id) => id === "forest" ? structuredClone(ambience) : null };
  const listener = { x: 0, y: 0 };
  const scene = { grid: { size: 100, distance: 5 }, sounds: new Map([["e1", emitterDocument()]]) };
  const service = new SceneEmitterService({
    getAmbienceService: () => ambienceService,
    backend,
    getListeners: () => [listener],
    setIntervalFn: null,
    clearIntervalFn: null,
    tickMs: 200
  });

  await service.activateScene(scene, { monitor: false });
  const start = backend.events.find((event) => event.type === "startLoop");
  assert.equal(start.options.volume, 0.2); // 0.8 master × 0.5 emitter × 0.5 track

  listener.x = 100; // halfway through a 200px radius
  await service.tick();
  const volume = backend.events.filter((event) => event.type === "setVolume").at(-1);
  assert.equal(volume.volume, 0.1);
  assert.equal(volume.options.durationMs, 200);

  listener.x = 201;
  await service.tick();
  assert.equal(service.runtimes.size, 0);
  assert.ok(backend.events.some((event) => event.type === "stop"));
});

test("scene emitter creation writes a silent Foundry AmbientSound proxy with module flags", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({ id: "forest", name: "Forest", tracks: [] });
  const ambienceService = { getAmbience: (id) => id === "forest" ? structuredClone(ambience) : null };
  let createdType = null;
  let createdData = null;
  const scene = {
    grid: { size: 100, distance: 5 },
    sounds: new Map(),
    async createEmbeddedDocuments(type, data) {
      createdType = type;
      createdData = data[0];
      const doc = {
        id: "e-created",
        ...data[0],
        getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
      };
      this.sounds.set(doc.id, doc);
      return [doc];
    }
  };
  globalThis.game = { user: { isGM: true } };
  try {
    const service = new SceneEmitterService({
      getAmbienceService: () => ambienceService,
      backend,
      getListeners: () => [],
      setIntervalFn: null,
      clearIntervalFn: null
    });
    await service.activateScene(scene, { monitor: false });
    const emitter = await service.createEmitter({ ambienceId: "forest", name: "Falls", x: 10, y: 20, radius: 30, volume: 0.6, easing: true }, scene);
    assert.equal(createdType, "AmbientSound");
    assert.equal(createdData.path, "modules/ambience-forge/assets/silence.ogg");
    assert.equal(createdData.walls, false);
    assert.equal(createdData.radius, 30);
    assert.equal(createdData.flags["ambience-forge"].emitter.ambienceId, "forest");
    assert.equal(createdData.flags["ambience-forge"].emitter.key, "falls");
    assert.equal(createdData.flags["ambience-forge"].emitter.enabled, true);
    assert.equal(emitter.id, "e-created");
  } finally {
    delete globalThis.game;
  }
});

test("GM uses a single unselected Token as an emitter listener", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    id: "forest",
    name: "Forest",
    tracks: [{ id: "bed", name: "Bed", type: "audio", source: "forest.ogg", repeat: true, volume: 1, fadeOutMs: 0 }]
  });
  const ambienceService = { getAmbience: (id) => id === "forest" ? structuredClone(ambience) : null };
  const scene = { grid: { size: 100, distance: 5 }, sounds: new Map([["e1", emitterDocument()]]) };
  const token = { id: "t1", center: { x: 0, y: 0 }, document: { id: "t1", hidden: false }, actor: { hasPlayerOwner: false, isOwner: true } };
  globalThis.game = { user: { isGM: true } };
  globalThis.canvas = { scene, tokens: { controlled: [], placeables: [token] } };
  try {
    const service = new SceneEmitterService({
      getAmbienceService: () => ambienceService,
      backend,
      setIntervalFn: null,
      clearIntervalFn: null
    });
    await service.activateScene(scene, { monitor: false });
    assert.equal(service.runtimes.size, 1);
    assert.ok(backend.events.some((event) => event.type === "startLoop"));
  } finally {
    delete globalThis.canvas;
    delete globalThis.game;
  }
});

test("GM preferred Token resolves an otherwise ambiguous listener position", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    id: "forest",
    name: "Forest",
    tracks: [{ id: "bed", name: "Bed", type: "audio", source: "forest.ogg", repeat: true, volume: 1, fadeOutMs: 0 }]
  });
  const ambienceService = { getAmbience: (id) => id === "forest" ? structuredClone(ambience) : null };
  const scene = { grid: { size: 100, distance: 5 }, sounds: new Map([["e1", emitterDocument()]]) };
  const near = { id: "near", center: { x: 0, y: 0 }, document: { id: "near", hidden: false }, actor: { hasPlayerOwner: false, isOwner: true } };
  const far = { id: "far", center: { x: 1000, y: 1000 }, document: { id: "far", hidden: false }, actor: { hasPlayerOwner: false, isOwner: true } };
  globalThis.game = { user: { isGM: true } };
  globalThis.canvas = { scene, tokens: { controlled: [], placeables: [near, far] } };
  try {
    const service = new SceneEmitterService({
      getAmbienceService: () => ambienceService,
      backend,
      setIntervalFn: null,
      clearIntervalFn: null
    });
    service.setPreferredListenerToken("near");
    await service.activateScene(scene, { monitor: false });
    assert.equal(service.runtimes.size, 1);
  } finally {
    delete globalThis.canvas;
    delete globalThis.game;
  }
});

test("disabling a scene emitter stops its runtime while keeping the emitter document", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    id: "forest",
    name: "Forest",
    tracks: [{ id: "bed", name: "Bed", type: "audio", source: "forest.ogg", repeat: true, volume: 1, fadeOutMs: 0 }]
  });
  const ambienceService = { getAmbience: (id) => id === "forest" ? structuredClone(ambience) : null };
  const doc = emitterDocument();
  doc.flags["ambience-forge"].emitter.enabled = true;
  doc.update = async function(changes) {
    if (changes["flags.ambience-forge.emitter"]) this.flags["ambience-forge"].emitter = changes["flags.ambience-forge.emitter"];
    Object.assign(this, Object.fromEntries(Object.entries(changes).filter(([key]) => !key.startsWith("flags."))));
  };
  const scene = { grid: { size: 100, distance: 5 }, sounds: new Map([["e1", doc]]) };
  globalThis.game = { user: { isGM: true } };
  try {
    const service = new SceneEmitterService({
      getAmbienceService: () => ambienceService,
      backend,
      getListeners: () => [{ x: 0, y: 0 }],
      setIntervalFn: null,
      clearIntervalFn: null
    });
    await service.activateScene(scene, { monitor: false });
    assert.equal(service.runtimes.size, 1);
    await service.setEmitterEnabled("e1", false, scene);
    assert.equal(service.getEmitter("e1", scene).enabled, false);
    assert.equal(service.runtimes.size, 0);
    assert.equal(scene.sounds.has("e1"), true);
  } finally {
    delete globalThis.game;
  }
});

test("active scene emitter restarts when its ambience definition revision changes", async () => {
  const backend = new FakeAudioBackend();
  let revision = 1;
  let source = "forest-old.ogg";
  const ambienceService = {
    getAmbience: () => normalizeAmbience({
      id: "forest",
      name: "Forest",
      tracks: [{ id: "bed", name: "Bed", type: "audio", source, repeat: true, volume: 1, fadeOutMs: 0 }]
    }),
    getAmbienceRevision: () => revision
  };
  const scene = { grid: { size: 100, distance: 5 }, sounds: new Map([["e1", emitterDocument()]]) };
  const service = new SceneEmitterService({
    getAmbienceService: () => ambienceService,
    backend,
    getListeners: () => [{ x: 0, y: 0 }],
    setIntervalFn: null,
    clearIntervalFn: null
  });

  await service.activateScene(scene, { monitor: false });
  assert.equal(service.runtimes.get("e1")?.revision, 1);
  source = "forest-new.ogg";
  revision = 2;
  await service.tick();

  assert.equal(service.runtimes.get("e1")?.revision, 2);
  assert.deepEqual(backend.events.filter((event) => event.type === "startLoop").map((event) => event.options.src), ["forest-old.ogg", "forest-new.ogg"]);
  assert.ok(backend.events.some((event) => event.type === "stop"));
});

test("scene emitter playback failures back off instead of retrying every spatial tick", async () => {
  let attempts = 0;
  class FailingBackend extends FakeAudioBackend {
    async startLoop(options) {
      attempts += 1;
      throw new Error(`missing audio: ${options.src}`);
    }
  }
  const backend = new FailingBackend();
  const ambience = normalizeAmbience({
    id: "forest",
    name: "Forest",
    tracks: [{ id: "bed", name: "Bed", type: "audio", source: "missing.ogg", repeat: true, volume: 1 }]
  });
  const ambienceService = {
    getAmbience: (id) => id === "forest" ? structuredClone(ambience) : null,
    getAmbienceRevision: () => 1
  };
  const scene = { grid: { size: 100, distance: 5 }, sounds: new Map([["e1", emitterDocument()]]) };
  let now = 1000;
  const errors = [];
  const service = new SceneEmitterService({
    getAmbienceService: () => ambienceService,
    backend,
    getListeners: () => [{ x: 0, y: 0 }],
    setIntervalFn: null,
    clearIntervalFn: null,
    tickMs: 200,
    retryMs: 5000,
    nowFn: () => now,
    onError: (error, context) => errors.push({ error, context })
  });

  await service.activateScene(scene, { monitor: false });
  assert.equal(attempts, 1);
  assert.equal(errors.length, 1);
  assert.equal(service.runtimes.size, 0);
  assert.equal(service.failures.get("e1")?.retryAt, 6000);

  // Many normal 200ms spatial ticks during the backoff window do not hit the
  // broken source again and do not spam the error callback.
  now = 1200;
  await service.tick();
  now = 3000;
  await service.tick();
  now = 5999;
  await service.tick();
  assert.equal(attempts, 1);
  assert.equal(errors.length, 1);

  // Once the retry window expires, playback is attempted again exactly once.
  now = 6000;
  await service.tick();
  assert.equal(attempts, 2);
  assert.equal(errors.length, 2);
});

test("scene emitter definition changes bypass a previous playback backoff", async () => {
  let attempts = 0;
  class RecoveringBackend extends FakeAudioBackend {
    async startLoop(options) {
      attempts += 1;
      if (options.src === "missing.ogg") throw new Error("missing audio");
      return super.startLoop(options);
    }
  }
  const backend = new RecoveringBackend();
  let revision = 1;
  let source = "missing.ogg";
  const ambienceService = {
    getAmbience: () => normalizeAmbience({
      id: "forest",
      name: "Forest",
      tracks: [{ id: "bed", name: "Bed", type: "audio", source, repeat: true, volume: 1 }]
    }),
    getAmbienceRevision: () => revision
  };
  const scene = { grid: { size: 100, distance: 5 }, sounds: new Map([["e1", emitterDocument()]]) };
  let now = 1000;
  const service = new SceneEmitterService({
    getAmbienceService: () => ambienceService,
    backend,
    getListeners: () => [{ x: 0, y: 0 }],
    setIntervalFn: null,
    clearIntervalFn: null,
    retryMs: 5000,
    nowFn: () => now,
    onError: () => {}
  });

  await service.activateScene(scene, { monitor: false });
  assert.equal(attempts, 1);
  source = "fixed.ogg";
  revision = 2;
  // Still inside the previous retry window, but the changed definition should
  // be tried immediately rather than waiting for the old source's backoff.
  now = 1100;
  await service.tick();
  assert.equal(attempts, 2);
  assert.equal(service.runtimes.size, 1);
  assert.equal(service.failures.has("e1"), false);
});

test("scene emitter applies changed ambience states without restarting the whole emitter", async () => {
  const backend = new FakeAudioBackend();
  let stateRevision = 0;
  let desired = {};
  const ambience = normalizeAmbience({
    id: "forest",
    name: "Forest",
    tracks: [
      { id: "wind", name: "Wind", type: "audio", source: "wind.ogg", repeat: true, volume: 0.5 },
      { id: "rain", name: "Rain", type: "audio", source: "rain.ogg", repeat: true, volume: 0.8, enabled: false }
    ],
    stateGroups: [{
      id: "weather-group", key: "weather", name: "Weather", transitionMs: 1200,
      states: [{ id: "storm-state", key: "storm", name: "Storm", trackOverrides: [{ trackId: "rain", active: "on" }] }]
    }]
  });
  const ambienceService = {
    getAmbience: () => structuredClone(ambience),
    getAmbienceRevision: () => 1,
    getAmbienceStateRevision: () => stateRevision,
    getDesiredStateSelections: () => structuredClone(desired)
  };
  const scene = { grid: { size: 100, distance: 5 }, sounds: new Map([["e1", emitterDocument()]]) };
  const service = new SceneEmitterService({
    getAmbienceService: () => ambienceService,
    backend,
    getListeners: () => [{ x: 0, y: 0 }],
    setIntervalFn: null,
    clearIntervalFn: null
  });

  await service.activateScene(scene, { monitor: false });
  assert.equal(backend.events.filter((event) => event.type === "startLoop" && event.options.src === "rain.ogg").length, 0);
  desired = { weather: "storm" };
  stateRevision = 1;
  await service.tick();
  assert.equal(backend.events.filter((event) => event.type === "startLoop" && event.options.src === "rain.ogg").length, 1);
  assert.equal(service.runtimes.get("e1")?.stateRevision, 1);
});

test("scene emitter live volume overrides the saved maximum volume without persisting it", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    id: "forest",
    name: "Forest",
    masterVolume: 1,
    tracks: [{ id: "bed", name: "Bed", type: "audio", source: "forest.ogg", repeat: true, volume: 1 }]
  });
  const ambienceService = { getAmbience: () => structuredClone(ambience) };
  const doc = emitterDocument();
  doc.volume = 0.8;
  const scene = { grid: { size: 100, distance: 5 }, sounds: new Map([["e1", doc]]) };
  const service = new SceneEmitterService({
    getAmbienceService: () => ambienceService,
    backend,
    getListeners: () => [{ x: 0, y: 0 }],
    setIntervalFn: null,
    clearIntervalFn: null
  });

  await service.activateScene(scene, { monitor: false });
  assert.equal(service.getEmitterLiveState("e1", scene).volume, 0.8);
  await service.setEmitterLiveVolume("e1", 0.25, scene);
  assert.equal(service.getEmitterLiveState("e1", scene).volume, 0.25);
  assert.equal(service.getEmitter("e1", scene).volume, 0.8);
  const volumeEvent = backend.events.filter((event) => event.type === "setVolume").at(-1);
  assert.equal(volumeEvent.volume, 0.25);
});

test("scene emitter live active override can temporarily stop and restart an enabled emitter", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    id: "forest",
    name: "Forest",
    tracks: [{ id: "bed", name: "Bed", type: "audio", source: "forest.ogg", repeat: true, volume: 1 }]
  });
  const ambienceService = { getAmbience: () => structuredClone(ambience) };
  const scene = { grid: { size: 100, distance: 5 }, sounds: new Map([["e1", emitterDocument()]]) };
  const service = new SceneEmitterService({
    getAmbienceService: () => ambienceService,
    backend,
    getListeners: () => [{ x: 0, y: 0 }],
    setIntervalFn: null,
    clearIntervalFn: null
  });

  await service.activateScene(scene, { monitor: false });
  assert.equal(service.runtimes.size, 1);
  await service.setEmitterLiveActive("e1", false, scene);
  assert.equal(service.runtimes.size, 0);
  assert.equal(service.getEmitter("e1", scene).enabled, true);
  assert.equal(service.getEmitterLiveState("e1", scene).activeOverride, false);

  await service.setEmitterLiveActive("e1", true, scene);
  assert.equal(service.runtimes.size, 1);
  assert.equal(service.getEmitterLiveState("e1", scene).active, true);
});

test("resetting scene emitter live state restores saved enabled and volume values", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({ id: "forest", name: "Forest", tracks: [] });
  const ambienceService = { getAmbience: () => structuredClone(ambience) };
  const doc = emitterDocument();
  doc.volume = 0.6;
  const scene = { grid: { size: 100, distance: 5 }, sounds: new Map([["e1", doc]]) };
  const service = new SceneEmitterService({
    getAmbienceService: () => ambienceService,
    backend,
    getListeners: () => [],
    setIntervalFn: null,
    clearIntervalFn: null
  });
  await service.activateScene(scene, { monitor: false });
  await service.setEmitterLiveVolume("e1", 0.1, scene);
  await service.setEmitterLiveActive("e1", false, scene);
  const restored = await service.resetEmitterLiveState("e1", scene);
  assert.equal(restored.volume, 0.6);
  assert.equal(restored.active, true);
  assert.equal(restored.volumeOverride, null);
  assert.equal(restored.activeOverride, null);
});

test("scene emitters can be discovered by semantic API key", async () => {
  const backend = new FakeAudioBackend();
  const ambienceService = { getAmbience: () => null };
  const first = emitterDocument();
  first.id = "e1";
  first.flags["ambience-forge"].emitter.key = "waterfall";
  const second = emitterDocument();
  second.id = "e2";
  second.flags["ambience-forge"].emitter.key = "waterfall";
  const third = emitterDocument();
  third.id = "e3";
  third.flags["ambience-forge"].emitter.key = "forge";
  const scene = { sounds: new Map([["e1", first], ["e2", second], ["e3", third]]) };
  const service = new SceneEmitterService({ getAmbienceService: () => ambienceService, backend, setIntervalFn: null, clearIntervalFn: null });
  assert.deepEqual(service.getEmittersByKey("waterfall", scene).map((emitter) => emitter.id), ["e1", "e2"]);
});

test("scene emitter live overrides are scoped by Scene as well as embedded document id", async () => {
  const backend = new FakeAudioBackend();
  const ambienceService = { getAmbience: () => null };
  const a = emitterDocument();
  const b = emitterDocument();
  const sceneA = { id: "scene-a", sounds: new Map([["e1", a]]) };
  const sceneB = { id: "scene-b", sounds: new Map([["e1", b]]) };
  const scenes = new Map([[sceneA.id, sceneA], [sceneB.id, sceneB]]);
  globalThis.game = { scenes };
  try {
    const service = new SceneEmitterService({ getAmbienceService: () => ambienceService, backend, setIntervalFn: null, clearIntervalFn: null });
    await service.setEmitterLiveVolume("e1", 0.2, sceneA);
    assert.equal(service.getEmitterLiveState("e1", sceneA).volume, 0.2);
    assert.equal(service.getEmitterLiveState("e1", sceneB).volume, 0.5);
    await service.setEmitterLiveActive("e1", false, "scene-b");
    assert.equal(service.getEmitterLiveState("e1", sceneA).active, true);
    assert.equal(service.getEmitterLiveState("e1", sceneB).active, false);
  } finally {
    delete globalThis.game;
  }
});

test("scene emitter live owners are independent and owner-scoped reset cannot erase a newer override", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({ id: "forest", name: "Forest", tracks: [] });
  const ambienceService = { getAmbience: () => structuredClone(ambience) };
  const doc = emitterDocument();
  doc.volume = 0.6;
  const scene = { id: "scene-a", grid: { size: 100, distance: 5 }, sounds: new Map([["e1", doc]]) };
  const service = new SceneEmitterService({
    getAmbienceService: () => ambienceService,
    backend,
    getListeners: () => [],
    setIntervalFn: null,
    clearIntervalFn: null
  });

  await service.activateScene(scene, { monitor: false });
  await service.setEmitterLiveVolume("e1", 0.25, scene, { owner: "weather-forge" });
  await service.setEmitterLiveActive("e1", false, scene, { owner: "encounter-forge" });
  let state = service.getEmitterLiveState("e1", scene);
  assert.equal(state.volumeOwner, "weather-forge");
  assert.equal(state.activeOwner, "encounter-forge");

  const partial = await service.resetEmitterLiveState("e1", scene, { owner: "weather-forge" });
  assert.equal(partial.volumeOverride, null);
  assert.equal(partial.volume, 0.6);
  assert.equal(partial.activeOverride, false);
  assert.equal(partial.activeOwner, "encounter-forge");

  await service.setEmitterLiveVolume("e1", 0.4, scene, { owner: "weather-forge" });
  await service.setEmitterLiveVolume("e1", 0.75, scene); // deliberate manual takeover
  assert.equal(await service.resetEmitterLiveState("e1", scene, { owner: "weather-forge" }), false);
  state = service.getEmitterLiveState("e1", scene);
  assert.equal(state.volume, 0.75);
  assert.equal(state.volumeOwner, null);
  assert.equal(state.activeOwner, "encounter-forge");
});

test("scene emitter live volume uses the requested fade duration", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    id: "forest",
    name: "Forest",
    masterVolume: 1,
    tracks: [{ id: "bed", name: "Bed", type: "audio", source: "forest.ogg", repeat: true, volume: 1, fadeInMs: 0 }]
  });
  const ambienceService = { getAmbience: () => structuredClone(ambience) };
  const scene = { id: "scene-a", grid: { size: 100, distance: 5 }, sounds: new Map([["e1", emitterDocument()]]) };
  let now = 1000;
  const service = new SceneEmitterService({
    getAmbienceService: () => ambienceService,
    backend,
    getListeners: () => [{ x: 0, y: 0 }],
    setIntervalFn: null,
    clearIntervalFn: null,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
    nowFn: () => now
  });

  await service.activateScene(scene, { monitor: false });
  await service.setEmitterLiveVolume("e1", 0.2, scene, { owner: "weather-forge", durationMs: 800 });
  const faded = backend.events.filter((event) => event.type === "setVolume").at(-1);
  assert.equal(faded.volume, 0.2);
  assert.equal(faded.options.durationMs, 800);
  assert.equal(service.getEmitterLiveState("e1", scene).volumeOwner, "weather-forge");

  now = 1400;
  await service.tick();
  const retargeted = backend.events.filter((event) => event.type === "setVolume").at(-1);
  assert.equal(retargeted.volume, 0.2);
  assert.equal(retargeted.options.durationMs, 400);
});

test("scene emitter active fade-out keeps playback alive until the transition completes", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    id: "forest",
    name: "Forest",
    tracks: [{ id: "bed", name: "Bed", type: "audio", source: "forest.ogg", repeat: true, volume: 1, fadeInMs: 0, fadeOutMs: 0 }]
  });
  const ambienceService = { getAmbience: () => structuredClone(ambience) };
  const scene = { id: "scene-a", grid: { size: 100, distance: 5 }, sounds: new Map([["e1", emitterDocument()]]) };
  let now = 1000;
  const service = new SceneEmitterService({
    getAmbienceService: () => ambienceService,
    backend,
    getListeners: () => [{ x: 0, y: 0 }],
    setIntervalFn: null,
    clearIntervalFn: null,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
    nowFn: () => now
  });

  await service.activateScene(scene, { monitor: false });
  await service.setEmitterLiveActive("e1", false, scene, { owner: "encounter-forge", durationMs: 1200 });
  assert.equal(service.getEmitterLiveState("e1", scene).active, false);
  assert.equal(service.getEmitterLiveState("e1", scene).activeOwner, "encounter-forge");
  assert.equal(service.runtimes.size, 1);
  const fade = backend.events.filter((event) => event.type === "setVolume").at(-1);
  assert.equal(fade.volume, 0);
  assert.equal(fade.options.durationMs, 1200);

  now = 2199;
  await service.tick();
  assert.equal(service.runtimes.size, 1);
  now = 2200;
  await service.tick();
  assert.equal(service.runtimes.size, 0);
  assert.ok(backend.events.some((event) => event.type === "stop"));
});

test("scene emitter active fade-in starts at zero master gain and ramps to the spatial target", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    id: "forest",
    name: "Forest",
    tracks: [{ id: "bed", name: "Bed", type: "audio", source: "forest.ogg", repeat: true, volume: 1, fadeInMs: 0, fadeOutMs: 0 }]
  });
  const ambienceService = { getAmbience: () => structuredClone(ambience) };
  const scene = { id: "scene-a", grid: { size: 100, distance: 5 }, sounds: new Map([["e1", emitterDocument()]]) };
  let now = 1000;
  const service = new SceneEmitterService({
    getAmbienceService: () => ambienceService,
    backend,
    getListeners: () => [{ x: 0, y: 0 }],
    setIntervalFn: null,
    clearIntervalFn: null,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
    nowFn: () => now
  });

  await service.activateScene(scene, { monitor: false });
  await service.setEmitterLiveActive("e1", false, scene);
  backend.events.length = 0;
  await service.setEmitterLiveActive("e1", true, scene, { owner: "weather-forge", durationMs: 1000 });

  const start = backend.events.find((event) => event.type === "startLoop");
  assert.equal(start.options.volume, 0);
  const fade = backend.events.filter((event) => event.type === "setVolume").at(-1);
  assert.equal(fade.volume, 0.5);
  assert.equal(fade.options.durationMs, 1000);
  assert.equal(service.runtimes.size, 1);
});

test("owner-scoped reset can fade from a temporary disabled state back to saved activation", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    id: "forest",
    name: "Forest",
    tracks: [{ id: "bed", name: "Bed", type: "audio", source: "forest.ogg", repeat: true, volume: 1, fadeInMs: 0, fadeOutMs: 0 }]
  });
  const ambienceService = { getAmbience: () => structuredClone(ambience) };
  const scene = { id: "scene-a", grid: { size: 100, distance: 5 }, sounds: new Map([["e1", emitterDocument()]]) };
  const service = new SceneEmitterService({
    getAmbienceService: () => ambienceService,
    backend,
    getListeners: () => [{ x: 0, y: 0 }],
    setIntervalFn: null,
    clearIntervalFn: null,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
    nowFn: () => 1000
  });

  await service.activateScene(scene, { monitor: false });
  await service.setEmitterLiveActive("e1", false, scene, { owner: "weather-forge" });
  backend.events.length = 0;
  const restored = await service.resetEmitterLiveState("e1", scene, { owner: "weather-forge", durationMs: 600 });
  assert.equal(restored.active, true);
  assert.equal(restored.activeOverride, null);
  const start = backend.events.find((event) => event.type === "startLoop");
  assert.equal(start.options.volume, 0);
  const fade = backend.events.filter((event) => event.type === "setVolume").at(-1);
  assert.equal(fade.volume, 0.5);
  assert.equal(fade.options.durationMs, 600);
});

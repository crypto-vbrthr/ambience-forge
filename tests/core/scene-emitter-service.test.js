import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAmbience } from "../../scripts/data/schema.js";
import { SceneEmitterService } from "../../scripts/scene/scene-emitter-service-alpha22.js";
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

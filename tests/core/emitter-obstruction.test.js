import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAmbience } from "../../scripts/data/schema.js";
import {
  EMITTER_OBSTRUCTION_MODES,
  applyEmitterObstruction,
  normalizeEmitterData
} from "../../scripts/scene/emitter-model.js";
import { SceneEmitterService } from "../../scripts/scene/scene-emitter-service.js";
import { FakeAudioBackend } from "../helpers/fake-audio-backend.js";

function ambience() {
  return normalizeAmbience({
    id: "tavern",
    name: "Tavern",
    masterVolume: 1,
    tracks: [{ id: "bed", name: "Bed", type: "audio", source: "crowd.ogg", repeat: true, volume: 1, fadeOutMs: 0 }]
  });
}

function emitterDocument({ mode = "ignore", attenuation = 0.7, audible = true } = {}) {
  return {
    id: "e1",
    x: 0,
    y: 0,
    radius: 10,
    volume: 1,
    easing: false,
    walls: mode !== "ignore",
    object: {
      source: {
        testPoint() { return audible; }
      }
    },
    flags: {
      "ambience-forge": {
        emitter: {
          ambienceId: "tavern",
          name: "Tavern source",
          enabled: true,
          obstructionMode: mode,
          obstructionAttenuation: attenuation
        }
      }
    },
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
  };
}

test("legacy emitters default to ignoring walls", () => {
  const emitter = normalizeEmitterData({ ambienceId: "x" });
  assert.equal(emitter.obstructionMode, EMITTER_OBSTRUCTION_MODES.IGNORE);
  assert.equal(emitter.obstructionAttenuation, 0.7);
});

test("obstruction attenuation reduces only obstructed gain", () => {
  const emitter = normalizeEmitterData({ obstructionMode: "attenuate", obstructionAttenuation: 0.7 });
  assert.equal(applyEmitterObstruction(0.8, emitter, false), 0.8);
  assert.ok(Math.abs(applyEmitterObstruction(0.8, emitter, true) - 0.24) < 1e-9);
});

test("blocking obstruction removes gain", () => {
  const emitter = normalizeEmitterData({ obstructionMode: "block" });
  assert.equal(applyEmitterObstruction(0.8, emitter, true), 0);
});

test("attenuate mode uses Foundry sound-source wall test", async () => {
  const backend = new FakeAudioBackend();
  const amb = ambience();
  const doc = emitterDocument({ mode: "attenuate", attenuation: 0.7, audible: false });
  const scene = { grid: { size: 100, distance: 5 }, sounds: new Map([[doc.id, doc]]) };
  const service = new SceneEmitterService({
    getAmbienceService: () => ({ getAmbience: (id) => id === amb.id ? structuredClone(amb) : null }),
    backend,
    getListeners: () => [{ x: 0, y: 0 }],
    setIntervalFn: null,
    clearIntervalFn: null
  });
  await service.activateScene(scene, { monitor: false });
  const start = backend.events.find((event) => event.type === "startLoop");
  assert.ok(Math.abs(start.options.volume - 0.3) < 1e-9);
});

test("block mode stops playback when Foundry sound source excludes listener", async () => {
  const backend = new FakeAudioBackend();
  const amb = ambience();
  const doc = emitterDocument({ mode: "block", audible: false });
  const scene = { grid: { size: 100, distance: 5 }, sounds: new Map([[doc.id, doc]]) };
  const service = new SceneEmitterService({
    getAmbienceService: () => ({ getAmbience: (id) => id === amb.id ? structuredClone(amb) : null }),
    backend,
    getListeners: () => [{ x: 0, y: 0 }],
    setIntervalFn: null,
    clearIntervalFn: null
  });
  await service.activateScene(scene, { monitor: false });
  assert.equal(service.runtimes.size, 0);
  assert.equal(backend.events.some((event) => event.type === "startLoop"), false);
});

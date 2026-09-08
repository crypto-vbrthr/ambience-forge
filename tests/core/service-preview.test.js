import test from "node:test";
import assert from "node:assert/strict";
import { AmbienceService } from "../../scripts/core/ambience-service.js";
import { FakeAudioBackend } from "../helpers/fake-audio-backend.js";

class MemoryStore {
  constructor(items = []) { this.items = items; }
  async loadAll() { return this.items; }
  async saveAll(items) { this.items = items; }
}

test("audio preview loops when Repeat is enabled and can be stopped", async () => {
  const backend = new FakeAudioBackend();
  const service = new AmbienceService({ store: new MemoryStore(), backend });
  await service.initialize();
  await service.previewAudio({ source: "rain.ogg", repeat: true, volume: 0.42, fadeInMs: 500, loopStart: 1.25, loopEnd: 9.5 });
  const start = backend.events.find((event) => event.type === "startLoop");
  assert.equal(start.options.src, "rain.ogg");
  assert.equal(start.options.volume, 0.42);
  assert.equal(start.options.loopStart, 1.25);
  assert.equal(start.options.loopEnd, 9.5);
  await service.stopPreview();
  const stop = backend.events.find((event) => event.type === "stop");
  assert.equal(stop.options.fadeOutMs, 150);
});

test("audio preview plays once when Repeat is disabled", async () => {
  const backend = new FakeAudioBackend();
  const service = new AmbienceService({ store: new MemoryStore(), backend });
  await service.initialize();
  await service.previewAudio({ source: "door.ogg", repeat: false, volume: 0.6, fadeInMs: 100 });
  const play = backend.events.find((event) => event.type === "playOneShot");
  assert.equal(play.options.src, "door.ogg");
  assert.equal(play.options.volume, 0.6);
});

test("legacy previewLoop remains a looping compatibility alias", async () => {
  const backend = new FakeAudioBackend();
  const service = new AmbienceService({ store: new MemoryStore(), backend });
  await service.initialize();
  await service.previewLoop({ source: "legacy.ogg" });
  assert.equal(backend.events.find((event) => event.type === "startLoop")?.options.src, "legacy.ogg");
});

test("editing an active ambience restarts it with the updated definition", async () => {
  const backend = new FakeAudioBackend();
  const store = new MemoryStore([{ id: "a", name: "Rain", tracks: [{ id: "t", name: "Rain", type: "loop", source: "old.ogg" }] }]);
  const service = new AmbienceService({ store, backend });
  await service.initialize();
  await service.playAmbience("a");
  await service.upsertAmbience({ id: "a", name: "Rain", tracks: [{ id: "t", name: "Rain", type: "audio", source: "new.ogg", repeat: true }] });
  const starts = backend.events.filter((event) => event.type === "startLoop").map((event) => event.options.src);
  assert.deepEqual(starts, ["old.ogg", "new.ogg"]);
  assert.deepEqual(service.getState().activeAmbienceIds, ["a"]);
});

test("random preview chooses immediately and avoids direct repetition", async () => {
  const backend = new FakeAudioBackend();
  const service = new AmbienceService({ store: new MemoryStore(), backend, random: () => 0 });
  await service.initialize();
  const track = { sources: ["owl.ogg", "wolf.ogg"], volume: 0.35, avoidImmediateRepeat: true };
  const first = await service.previewRandom(track);
  const second = await service.previewRandom(track);
  assert.equal(first, "owl.ogg");
  assert.equal(second, "wolf.ogg");
  const played = backend.events.filter((event) => event.type === "playOneShot").map((event) => event.options);
  assert.deepEqual(played.map((event) => event.src), ["owl.ogg", "wolf.ogg"]);
  assert.deepEqual(played.map((event) => event.volume), [0.35, 0.35]);
});


test("sequence preview follows list order or randomized order", async () => {
  const backend = new FakeAudioBackend();
  const service = new AmbienceService({ store: new MemoryStore(), backend, random: () => 0 });
  await service.initialize();
  const sequential = await service.previewSequence({ sources: ["song1.ogg", "song2.ogg"], order: "sequential", volume: 0.5 });
  assert.equal(sequential, "song1.ogg");
  const randomFirst = await service.previewSequence({ sources: ["song1.ogg", "song2.ogg"], order: "random", avoidImmediateRepeat: true, volume: 0.5 });
  const randomSecond = await service.previewSequence({ sources: ["song1.ogg", "song2.ogg"], order: "random", avoidImmediateRepeat: true, volume: 0.5 });
  assert.equal(randomFirst, "song1.ogg");
  assert.equal(randomSecond, "song2.ogg");
});

test("intensity preview crossfades between ordered variants", async () => {
  const backend = new FakeAudioBackend();
  const service = new AmbienceService({ store: new MemoryStore(), backend });
  await service.initialize();
  const track = {
    name: "Rain",
    volume: 0.6,
    intensity: 0,
    transitionMs: 2500,
    variants: [
      { name: "Light", source: "light.ogg" },
      { name: "Medium", source: "medium.ogg" },
      { name: "Heavy", source: "heavy.ogg" }
    ]
  };
  const first = await service.previewIntensity(track);
  assert.equal(first, "light.ogg");
  await service.setPreviewIntensity(1);
  const fade = backend.events.find((event) => event.type === "crossfade");
  assert.equal(fade.options.src, "heavy.ogg");
  assert.equal(fade.options.volume, 0.6);
  assert.equal(fade.options.durationMs, 2500);
});


test("service state exposes live per-track volume and active state", async () => {
  const backend = new FakeAudioBackend();
  const store = new MemoryStore([{ id: "a", name: "Forest", tracks: [{ id: "t", name: "Wind", type: "audio", source: "wind.ogg", repeat: true, volume: 0.7 }] }]);
  const service = new AmbienceService({ store, backend });
  await service.initialize();
  await service.playAmbience("a");
  assert.equal(service.getState().trackVolumes.a.t, 0.7);
  assert.equal(service.getState().trackActiveStates.a.t, true);
  await service.setTrackVolume("a", "t", 0.3);
  await service.setTrackActive("a", "t", false);
  assert.equal(service.getState().trackVolumes.a.t, 0.3);
  assert.equal(service.getState().trackActiveStates.a.t, false);
});

test("reloadFromStore refreshes changed definitions and restarts active ambience", async () => {
  const backend = new FakeAudioBackend();
  const store = new MemoryStore([{ id: "a", name: "Rain", tracks: [{ id: "t", name: "Rain", type: "audio", source: "old.ogg", repeat: true }] }]);
  const changed = [];
  const service = new AmbienceService({ store, backend, onLibraryChanged: async (ids) => changed.push(ids) });
  await service.initialize();
  const revisionBefore = service.getAmbienceRevision("a");
  await service.playAmbience("a");

  store.items = [{ id: "a", name: "Rain", tracks: [{ id: "t", name: "Rain", type: "audio", source: "new.ogg", repeat: true }] }];
  const didChange = await service.reloadFromStore();

  assert.equal(didChange, true);
  assert.equal(service.getAmbience("a").tracks[0].source, "new.ogg");
  assert.ok(service.getAmbienceRevision("a") > revisionBefore);
  assert.deepEqual(service.getState().activeAmbienceIds, ["a"]);
  assert.deepEqual(backend.events.filter((event) => event.type === "startLoop").map((event) => event.options.src), ["old.ogg", "new.ogg"]);
  assert.deepEqual(changed, [["a"]]);
});

test("syncAmbienceDefinition updates an active client definition without persisting it", async () => {
  const backend = new FakeAudioBackend();
  const store = new MemoryStore([{ id: "a", name: "Rain", tracks: [{ id: "t", name: "Rain", type: "audio", source: "old.ogg", repeat: true }] }]);
  const service = new AmbienceService({ store, backend });
  await service.initialize();
  await service.playAmbience("a");
  const revisionBefore = service.getAmbienceRevision("a");

  const didChange = await service.syncAmbienceDefinition({ id: "a", name: "Rain", tracks: [{ id: "t", name: "Rain", type: "audio", source: "socket-new.ogg", repeat: true }] });

  assert.equal(didChange, true);
  assert.equal(service.getAmbience("a").tracks[0].source, "socket-new.ogg");
  assert.ok(service.getAmbienceRevision("a") > revisionBefore);
  assert.equal(store.items[0].tracks[0].source, "old.ogg");
  assert.deepEqual(backend.events.filter((event) => event.type === "startLoop").map((event) => event.options.src), ["old.ogg", "socket-new.ogg"]);
});

test("owner request and release do not stop an explicitly started ambience", async () => {
  const backend = new FakeAudioBackend();
  const store = new MemoryStore([{ id: "a", name: "Rain", tracks: [{ id: "t", name: "Rain", type: "audio", source: "rain.ogg", repeat: true, fadeOutMs: 0 }] }]);
  const service = new AmbienceService({ store, backend });
  await service.initialize();

  await service.playAmbience("a");
  await service.requestAmbience("a", "weather-forge");
  await service.releaseAmbience("a", "weather-forge");

  assert.deepEqual(service.getState().activeAmbienceIds, ["a"]);
  assert.equal(backend.events.filter((event) => event.type === "stop").length, 0);
});

test("owner-only ambience stops after the final owner releases", async () => {
  const backend = new FakeAudioBackend();
  const store = new MemoryStore([{ id: "a", name: "Rain", tracks: [{ id: "t", name: "Rain", type: "audio", source: "rain.ogg", repeat: true, fadeOutMs: 0 }] }]);
  const service = new AmbienceService({ store, backend });
  await service.initialize();

  assert.equal(await service.requestAmbience("a", "weather-forge"), 1);
  assert.equal(await service.requestAmbience("a", "atmosphere-forge"), 2);
  assert.equal(await service.releaseAmbience("a", "weather-forge"), 1);
  assert.deepEqual(service.getState().activeAmbienceIds, ["a"]);
  assert.equal(await service.releaseAmbience("a", "atmosphere-forge"), 0);
  assert.deepEqual(service.getState().activeAmbienceIds, []);
});

test("explicit stop clears outstanding owner requests and runtime state", async () => {
  const backend = new FakeAudioBackend();
  const store = new MemoryStore([{ id: "a", name: "Rain", tracks: [{ id: "t", name: "Rain", type: "audio", source: "rain.ogg", repeat: true, fadeOutMs: 0 }] }]);
  const service = new AmbienceService({ store, backend });
  await service.initialize();

  await service.requestAmbience("a", "weather-forge");
  assert.deepEqual(service.getState().owners.a, ["weather-forge"]);
  await service.stopAmbience("a");
  assert.deepEqual(service.getState().activeAmbienceIds, []);
  assert.equal(service.getState().owners.a, undefined);
});

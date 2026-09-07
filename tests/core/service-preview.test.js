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

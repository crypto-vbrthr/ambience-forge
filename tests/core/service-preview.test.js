import test from "node:test";
import assert from "node:assert/strict";
import { AmbienceService } from "../../scripts/core/ambience-service.js";
import { FakeAudioBackend } from "../helpers/fake-audio-backend.js";

class MemoryStore {
  constructor(items = []) { this.items = items; }
  async loadAll() { return this.items; }
  async saveAll(items) { this.items = items; }
}

test("loop preview uses buffered loop backend settings and can be stopped", async () => {
  const backend = new FakeAudioBackend();
  const service = new AmbienceService({ store: new MemoryStore(), backend });
  await service.initialize();
  await service.previewLoop({ source: "rain.ogg", volume: 0.42, fadeInMs: 500, loopStart: 1.25, loopEnd: 9.5 });
  const start = backend.events.find((event) => event.type === "startLoop");
  assert.equal(start.options.src, "rain.ogg");
  assert.equal(start.options.volume, 0.42);
  assert.equal(start.options.loopStart, 1.25);
  assert.equal(start.options.loopEnd, 9.5);
  await service.stopPreview();
  const stop = backend.events.find((event) => event.type === "stop");
  assert.equal(stop.options.fadeOutMs, 150);
});

test("editing an active ambience restarts it with the updated definition", async () => {
  const backend = new FakeAudioBackend();
  const store = new MemoryStore([{ id: "a", name: "Rain", tracks: [{ id: "t", name: "Rain", type: "loop", source: "old.ogg" }] }]);
  const service = new AmbienceService({ store, backend });
  await service.initialize();
  await service.playAmbience("a");
  await service.upsertAmbience({ id: "a", name: "Rain", tracks: [{ id: "t", name: "Rain", type: "loop", source: "new.ogg" }] });
  const starts = backend.events.filter((event) => event.type === "startLoop").map((event) => event.options.src);
  assert.deepEqual(starts, ["old.ogg", "new.ogg"]);
  assert.deepEqual(service.getState().activeAmbienceIds, ["a"]);
});

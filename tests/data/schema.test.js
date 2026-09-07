import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAmbience, normalizeTrack, validateAmbience } from "../../scripts/data/schema.js";

test("normalization clamps volume and delay values", () => {
  const ambience = normalizeAmbience({
    name: "Test",
    tracks: [{ type: "random", name: "Events", volume: 5, minDelayMs: 2000, maxDelayMs: 1000, sources: ["a.ogg"] }]
  }, { idFactory: (prefix) => `${prefix}-id` });
  const track = ambience.tracks[0];
  assert.equal(track.volume, 1);
  assert.equal(track.minDelayMs, 2000);
  assert.equal(track.maxDelayMs, 2000);
  assert.deepEqual(validateAmbience(ambience), []);
});

test("legacy loop tracks migrate to repeating audio tracks", () => {
  const track = normalizeTrack({ id: "legacy", type: "loop", source: "rain.ogg" }, { idFactory: (prefix) => `${prefix}-id` });
  assert.equal(track.type, "audio");
  assert.equal(track.repeat, true);
  assert.equal(track.source, "rain.ogg");
});

test("audio tracks can explicitly disable repetition", () => {
  const track = normalizeTrack({ type: "audio", source: "intro.ogg", repeat: false }, { idFactory: (prefix) => `${prefix}-id` });
  assert.equal(track.type, "audio");
  assert.equal(track.repeat, false);
});


test("ambience master volume defaults to one and is clamped", () => {
  assert.equal(normalizeAmbience({ name: "A" }).masterVolume, 1);
  assert.equal(normalizeAmbience({ name: "A", masterVolume: 0.5 }).masterVolume, 0.5);
  assert.equal(normalizeAmbience({ name: "A", masterVolume: 2 }).masterVolume, 1);
});

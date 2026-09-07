import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAmbience, validateAmbience } from "../../scripts/data/schema.js";

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

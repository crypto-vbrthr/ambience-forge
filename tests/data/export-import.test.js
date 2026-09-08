import test from "node:test";
import assert from "node:assert/strict";
import { collectAmbienceAudioSources, exportAmbienceEnvelope, importAmbienceEnvelope } from "../../scripts/data/export-import.js";
import { normalizeAmbience } from "../../scripts/data/schema.js";

test("export and import preserve the composition but create fresh ids", () => {
  const ambience = normalizeAmbience({
    id: "original",
    name: "Tavern",
    tracks: [{ id: "crowd", name: "Crowd", type: "loop", source: "crowd.ogg" }]
  });
  const envelope = exportAmbienceEnvelope(ambience, "0.1.0");
  let n = 0;
  const imported = importAmbienceEnvelope(envelope, { idFactory: (prefix) => `${prefix}-${++n}` });
  assert.equal(imported.name, "Tavern");
  assert.notEqual(imported.id, ambience.id);
  assert.notEqual(imported.tracks[0].id, ambience.tracks[0].id);
  assert.equal(imported.tracks[0].source, "crowd.ogg");
});

test("default import also regenerates ambience, track, and variant ids", () => {
  const ambience = normalizeAmbience({
    id: "old-ambience",
    name: "Storm",
    tracks: [{
      id: "old-track",
      name: "Rain",
      type: "intensity",
      variants: [{ id: "old-variant", name: "Light", source: "light.ogg" }]
    }]
  });
  const imported = importAmbienceEnvelope(exportAmbienceEnvelope(ambience, "0.1.0"));
  assert.notEqual(imported.id, "old-ambience");
  assert.notEqual(imported.tracks[0].id, "old-track");
  assert.notEqual(imported.tracks[0].variants[0].id, "old-variant");
});

test("import rejects wrong formats, future schemas, and missing ambience payloads", () => {
  assert.throws(() => importAmbienceEnvelope({ format: "other", schemaVersion: 1, ambience: {} }), /format mismatch/);
  assert.throws(() => importAmbienceEnvelope({ format: "ambience-forge", schemaVersion: 999, ambience: {} }), /newer/);
  assert.throws(() => importAmbienceEnvelope({ format: "ambience-forge", schemaVersion: 1 }), /contains no ambience/);
});

test("audio source collection covers every track model without duplicates", () => {
  const ambience = normalizeAmbience({
    name: "Mixed",
    tracks: [
      { name: "Bed", type: "audio", source: "bed.ogg" },
      { name: "Random", type: "random", sources: ["owl.ogg", "bed.ogg"] },
      { name: "Sequence", type: "sequence", sources: ["song.ogg"] },
      { name: "Intensity", type: "intensity", variants: [{ name: "Low", source: "low.ogg" }, { name: "High", source: "high.ogg" }] }
    ]
  });
  assert.deepEqual(collectAmbienceAudioSources(ambience).sort(), ["bed.ogg", "high.ogg", "low.ogg", "owl.ogg", "song.ogg"]);
});

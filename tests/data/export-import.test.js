import test from "node:test";
import assert from "node:assert/strict";
import { exportAmbienceEnvelope, importAmbienceEnvelope } from "../../scripts/data/export-import.js";
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

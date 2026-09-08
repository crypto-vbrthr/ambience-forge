import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const overlay = fs.readFileSync(new URL("../scripts/ui/emitter-overlay-alpha23.js", import.meta.url), "utf8");
const manager = fs.readFileSync(new URL("../scripts/ui/emitter-manager-alpha22.js", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../scripts/main-alpha23.js", import.meta.url), "utf8");

test("scene emitter overlay exposes edit and enable-disable controls on the map", () => {
  assert.match(overlay, /ambience-forge-emitter-marker/);
  assert.match(overlay, /data-af-emitter-marker-action/);
  assert.match(overlay, /openEmitterEditor/);
  assert.match(overlay, /setSceneEmitterEnabled/);
  assert.match(overlay, /canvasPan/);
});

test("emitter editor exposes persistent enabled state", () => {
  assert.match(manager, /AMBIENCE_FORGE\.Emitter\.Enabled/);
  assert.match(manager, /checkbox\("enabled"/);
  assert.match(manager, /enabled: checked\("enabled"\)/);
});

test("alpha 23 registers draggable map emitter overlay after scene emitter service is ready", () => {
  assert.match(main, /registerEmitterOverlay/);
  assert.match(main, /scene-emitter-service-alpha22\.js/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const manager = fs.readFileSync(new URL("../scripts/ui/emitter-manager-alpha26.js", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../scripts/scene/scene-emitter-service-alpha26.js", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../scripts/main-alpha26.js", import.meta.url), "utf8");

test("emitter editor exposes ignore, attenuate and block wall modes", () => {
  assert.match(manager, /ObstructionMode/);
  assert.match(manager, /value: "ignore"/);
  assert.match(manager, /value: "attenuate"/);
  assert.match(manager, /value: "block"/);
  assert.match(manager, /obstructionAttenuationPercent/);
});

test("scene emitter service delegates wall semantics to Foundry PointSoundSource", () => {
  assert.match(service, /document\?\.object\?\.source/);
  assert.match(service, /source\.testPoint\(point\)/);
  assert.match(service, /createWall/);
  assert.match(service, /updateWall/);
  assert.match(service, /deleteWall/);
  assert.match(service, /walls: emitter\.obstructionMode !== EMITTER_OBSTRUCTION_MODES\.IGNORE/);
});

test("alpha 26 wires obstruction-aware emitter service and UI", () => {
  assert.match(main, /scene-emitter-service-alpha26\.js/);
  assert.match(main, /scene-controls-alpha26\.js/);
  assert.match(main, /emitter-overlay-alpha26\.js/);
});

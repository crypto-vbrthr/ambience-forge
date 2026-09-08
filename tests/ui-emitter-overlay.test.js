import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const overlay = fs.readFileSync(new URL("../scripts/ui/emitter-overlay-alpha28.js", import.meta.url), "utf8");
const manager = fs.readFileSync(new URL("../scripts/ui/emitter-manager-alpha22.js", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../scripts/main-alpha28.js", import.meta.url), "utf8");

test("scene emitter overlay exposes edit and enable-disable controls on the canvas", () => {
  assert.match(overlay, /openEmitterEditor/);
  assert.match(overlay, /setSceneEmitterEnabled/);
  assert.match(overlay, /canvasPan/);
  assert.match(overlay, /pointerdown/);
  assert.match(overlay, /edit\.on\("pointertap"/);
});

test("emitter editor exposes persistent enabled state", () => {
  assert.match(manager, /AMBIENCE_FORGE\.Emitter\.Enabled/);
  assert.match(manager, /checkbox\("enabled"/);
  assert.match(manager, /enabled: checked\("enabled"\)/);
});

test("alpha 28 registers native canvas emitter overlay after scene emitter service is ready", () => {
  assert.match(main, /registerEmitterOverlay/);
  assert.match(main, /emitter-overlay-alpha28\.js/);
  assert.match(main, /scene-emitter-service-alpha26\.js/);
});

test("emitter markers are scene-bound PIXI children rather than viewport DOM elements", () => {
  assert.match(overlay, /canvasInterface\.addChild\(this\.root\)/);
  assert.match(overlay, /new globalThis\.PIXI\.Container/);
  assert.match(overlay, /marker\.position\.set\(Number\(emitter\.x\)/);
  assert.match(overlay, /marker\.scale\.set\(inverseZoom\)/);
  assert.doesNotMatch(overlay, /document\.createElement/);
  assert.doesNotMatch(overlay, /document\.body/);
  assert.doesNotMatch(overlay, /clientCoordinatesFromCanvas/);
});

test("dragging persists new scene coordinates without viewport-position styling", () => {
  assert.match(overlay, /canvasCoordinatesFromClient/);
  assert.match(overlay, /drag\.marker\.position\.set\(drag\.x, drag\.y\)/);
  assert.match(overlay, /updateSceneEmitter\(drag\.emitterId, \{ x: drag\.x, y: drag\.y \}\)/);
  assert.doesNotMatch(overlay, /style\.left/);
  assert.doesNotMatch(overlay, /style\.top/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const overlay = fs.readFileSync(new URL("../scripts/ui/emitter-overlay-alpha28.js", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../scripts/main-alpha28.js", import.meta.url), "utf8");

test("alpha 28 keeps emitter hover actions stable across child controls", () => {
  assert.match(overlay, /marker\.interactive = true/);
  assert.match(overlay, /marker\.eventMode = "static"/);
  assert.match(overlay, /marker\.hitArea = new PIXI\.Rectangle/);
  assert.match(overlay, /pointerenter/);
  assert.match(overlay, /pointerleave/);
  assert.doesNotMatch(overlay, /marker\.on\("pointerover"/);
  assert.doesNotMatch(overlay, /marker\.on\("pointerout"/);
});

test("alpha 28 uses the main emitter marker only for drag while persisting immediately", () => {
  const mainStart = overlay.indexOf('main.on("pointerdown"');
  const editStart = overlay.indexOf('const edit = makeActionButton');
  const mainBlock = overlay.slice(mainStart, editStart);
  assert.match(mainBlock, /#dragStart/);
  assert.doesNotMatch(mainBlock, /pointertap/);
  assert.doesNotMatch(mainBlock, /openEmitterEditor/);
  assert.match(overlay, /updateSceneEmitter\(drag\.emitterId, \{ x: drag\.x, y: drag\.y \}\)/);
  assert.doesNotMatch(overlay, /_afSuppressClickUntil/);
});

test("alpha 28 retains explicit Edit and Enable\/Disable hover actions", () => {
  assert.match(overlay, /const edit = makeActionButton/);
  assert.match(overlay, /edit\.on\("pointertap"/);
  assert.match(overlay, /openEmitterEditor\(this\.api, emitter\.id\)/);
  assert.match(overlay, /const toggle = makeActionButton/);
  assert.match(overlay, /toggle\.on\("pointertap"/);
});

test("alpha 28 main entry loads the drag-only canvas marker implementation", () => {
  assert.match(main, /emitter-overlay-alpha28\.js/);
});

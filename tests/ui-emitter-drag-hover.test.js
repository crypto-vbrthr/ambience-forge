import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const overlay = fs.readFileSync(new URL("../scripts/ui/emitter-overlay.js", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");

test("emitter hover actions stay stable across child controls", () => {
  assert.match(overlay, /marker\.interactive = true/);
  assert.match(overlay, /marker\.eventMode = "static"/);
  assert.match(overlay, /marker\.hitArea = new PIXI\.Rectangle/);
  assert.match(overlay, /pointerenter/);
  assert.match(overlay, /pointerleave/);
  assert.doesNotMatch(overlay, /marker\.on\("pointerover"/);
  assert.doesNotMatch(overlay, /marker\.on\("pointerout"/);
});

test("main emitter marker is drag-only and persists movement immediately", () => {
  const mainStart = overlay.indexOf('main.on("pointerdown"');
  const editStart = overlay.indexOf('const edit = makeActionButton');
  const mainBlock = overlay.slice(mainStart, editStart);
  assert.match(mainBlock, /#dragStart/);
  assert.doesNotMatch(mainBlock, /pointertap/);
  assert.doesNotMatch(mainBlock, /openEmitterEditor/);
  assert.match(overlay, /updateSceneEmitter\(drag\.emitterId, \{ x: drag\.x, y: drag\.y \}\)/);
  assert.doesNotMatch(overlay, /_afSuppressClickUntil/);
});

test("emitter marker retains explicit Edit and Enable\/Disable hover actions", () => {
  assert.match(overlay, /const edit = makeActionButton/);
  assert.match(overlay, /edit\.on\("pointertap"/);
  assert.match(overlay, /openEmitterEditor\(this\.api, emitter\.id\)/);
  assert.match(overlay, /const toggle = makeActionButton/);
  assert.match(overlay, /toggle\.on\("pointertap"/);
});

test("main entry loads the drag-only canvas marker implementation", () => {
  assert.match(main, /emitter-overlay\.js/);
});
